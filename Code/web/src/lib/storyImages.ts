import { prisma } from "@/lib/prisma";
import { getImageModel, getTextModel } from "@/lib/config";
import { DEFAULT_ILLUSTRATION_STYLE } from "@/lib/illustrationStyles";
import { generateValidatedImage } from "@/lib/imageGeneration";
import type { ImageEvaluation } from "@/lib/imageQuality";
import {
  buildCharacterProfilePrompt,
  buildCoverImagePromptFromContext,
  buildFinalImagePromptFromContext,
  buildSharedImageGenerationContext,
} from "@/lib/prompts";
import {
  createSupabaseServerClient,
  getStoragePathFromPublicUrl,
  uploadBase64Image,
} from "@/lib/supabase-server";
import type {
  CharacterPhotoInput,
  CharacterProfile,
  StoredImageGenerationContext,
  StoredPageImage,
  StoredStoryData,
  StoryInput,
} from "@/types/storybook";

// Server-only: generate and persist a saved story's cover/page images from
// what's stored in the DB, so missing images can always be filled later.

export type StoryImageTarget = "cover" | number;

interface StoryRecord {
  id: string;
  userId: string;
  title: string;
  theme: string;
  coverImageUrl: string | null;
  storyJson: unknown;
  pageImagesJson: unknown;
}

// ── Persistence (atomic, so concurrent page fills can't clobber each other) ──

export async function setStoryCoverImage(storyId: string, coverImageUrl: string): Promise<void> {
  await prisma.story.update({ where: { id: storyId }, data: { coverImageUrl } });
}

export async function setStoryPageImage(storyId: string, pageNumber: number, entry: StoredPageImage): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Story"
    SET "pageImagesJson" = jsonb_set(
      COALESCE("pageImagesJson", '{}'::jsonb),
      ARRAY[${String(pageNumber)}],
      ${JSON.stringify(entry)}::jsonb,
      true
    )
    WHERE id = ${storyId}`;
}

export function compactQuality(evaluation: ImageEvaluation | undefined): StoredPageImage["quality"] {
  if (!evaluation) return undefined;
  return { passed: evaluation.passed, scores: evaluation.scores, flags: evaluation.flags };
}

// ── Generation context ───────────────────────────────────────────────────────

/** Strips photo bytes so the context can be stored in storyJson. */
export function toStoredGenerationContext(context: {
  characterNames: string[];
  characterProfiles: CharacterProfile[];
  sharedContextPrompt: string;
  illustrationStyle?: StoredImageGenerationContext["illustrationStyle"];
}): StoredImageGenerationContext {
  return {
    characterNames: context.characterNames,
    characterProfiles: context.characterProfiles,
    sharedContextPrompt: context.sharedContextPrompt,
    illustrationStyle: context.illustrationStyle,
  };
}

function safeJsonParse<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function deriveCharacterProfileFromPhoto(
  characterName: string,
  photo: { base64: string; mimeType: string },
  theme: string
): Promise<CharacterProfile> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const input: StoryInput = {
    childName: characterName,
    theme: theme as StoryInput["theme"],
    traits: [],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getTextModel()}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: photo.mimeType, data: photo.base64 } },
            { text: buildCharacterProfilePrompt(input, characterName, [characterName]) },
          ],
        }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini profile error: ${res.status}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No profile text returned");
  return safeJsonParse<CharacterProfile>(text);
}

/** Downloads each persisted character photo (private bucket → signed URL). */
export async function downloadCharacterPhotos(storyData: StoredStoryData): Promise<CharacterPhotoInput[]> {
  const supabase = createSupabaseServerClient();
  const photos: CharacterPhotoInput[] = [];

  for (const charPhoto of storyData.characterPhotos ?? []) {
    if (!charPhoto.persistedPhotoUrl) continue;
    try {
      const path = getStoragePathFromPublicUrl("child-photos", charPhoto.persistedPhotoUrl) ?? charPhoto.persistedPhotoUrl;
      const { data: signed } = await supabase.storage.from("child-photos").createSignedUrl(path, 300);
      const res = await fetch(signed?.signedUrl ?? charPhoto.persistedPhotoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      photos.push({
        characterName: charPhoto.characterName,
        uploadedImageBase64: Buffer.from(await res.arrayBuffer()).toString("base64"),
        uploadedImageMimeType: res.headers.get("content-type") ?? "image/jpeg",
        persistedPhotoUrl: charPhoto.persistedPhotoUrl,
      });
    } catch (err) {
      console.error(`[story-images] photo download failed for ${charPhoto.characterName}:`, err);
    }
  }

  return photos;
}

/**
 * Loads the stored generation context, or rebuilds it from the stored photos
 * for stories saved before contexts were persisted (and stores the result).
 */
export async function resolveGenerationContext(story: StoryRecord, options?: { rederiveProfiles?: boolean }) {
  const storyData = story.storyJson as StoredStoryData;
  const characterPhotos = await downloadCharacterPhotos(storyData);
  const illustrationStyle =
    storyData.imageGenerationContext?.illustrationStyle ?? storyData.illustrationStyle ?? DEFAULT_ILLUSTRATION_STYLE;

  const stored = storyData.imageGenerationContext;
  if (stored?.characterProfiles?.length && !options?.rederiveProfiles) {
    return { ...stored, illustrationStyle, characterPhotos };
  }

  const characterProfiles: CharacterProfile[] = [];
  for (const photo of characterPhotos) {
    try {
      characterProfiles.push(await deriveCharacterProfileFromPhoto(
        photo.characterName,
        { base64: photo.uploadedImageBase64!, mimeType: photo.uploadedImageMimeType! },
        story.theme
      ));
    } catch (err) {
      console.error(`[story-images] profile derivation failed for ${photo.characterName}:`, err);
    }
  }
  if (characterProfiles.length === 0) {
    throw new Error("Could not derive character profiles from stored photos");
  }

  const context = toStoredGenerationContext({
    characterNames: characterProfiles.map((p) => p.characterName),
    characterProfiles,
    sharedContextPrompt: buildSharedImageGenerationContext(characterProfiles, illustrationStyle),
    illustrationStyle,
  });
  await prisma.story.update({
    where: { id: story.id },
    data: { storyJson: { ...storyData, imageGenerationContext: context } as object },
  });
  return { ...context, characterPhotos };
}

// ── Generate + persist one image ─────────────────────────────────────────────

export interface StoryImageResult {
  target: StoryImageTarget;
  imageUrl?: string;
  quality?: StoredPageImage["quality"];
  error?: string;
}

export async function generateAndPersistStoryImage(
  story: StoryRecord,
  target: StoryImageTarget,
  context: Awaited<ReturnType<typeof resolveGenerationContext>>,
  options?: { model?: string; timestamp?: number }
): Promise<StoryImageResult> {
  const storyData = story.storyJson as StoredStoryData;
  const model = options?.model ?? await getImageModel();
  const timestamp = options?.timestamp ?? Date.now();
  const imageOptions = {
    characterProfiles: context.characterProfiles,
    characterPhotos: context.characterPhotos,
  };

  if (target === "cover") {
    const prompt = buildCoverImagePromptFromContext(
      context.sharedContextPrompt, storyData.title, context.characterNames, context.illustrationStyle
    );
    const image = await generateValidatedImage(model, 0, prompt, {
      ...imageOptions,
      aspectRatio: "16:9",
      evaluation: {
        kind: "cover",
        sceneText: storyData.title,
        characterNames: context.characterNames,
        illustrationStyle: context.illustrationStyle,
      },
    });
    if (image.isPlaceholder || !image.imageUrl) return { target, error: image.error ?? "Generation failed" };
    const url = await uploadBase64Image("story-images", `${story.userId}/${timestamp}/cover.jpg`, image.imageUrl);
    await setStoryCoverImage(story.id, url);
    return { target, imageUrl: url, quality: compactQuality(image.evaluation) };
  }

  const page = storyData.pages.find((p) => p.pageNumber === target);
  if (!page) return { target, error: `Page ${target} not found` };

  const prompt = buildFinalImagePromptFromContext(context.sharedContextPrompt, page, {
    reinforceConsistency: page.pageNumber > 1,
    illustrationStyle: context.illustrationStyle,
  });
  const image = await generateValidatedImage(model, page.pageNumber, prompt, {
    ...imageOptions,
    evaluation: {
      kind: "page",
      sceneText: page.text,
      characterNames: context.characterNames,
      illustrationStyle: context.illustrationStyle,
    },
  });
  if (image.isPlaceholder || !image.imageUrl) return { target, error: image.error ?? "Generation failed" };

  const url = await uploadBase64Image(
    "story-images",
    `${story.userId}/${timestamp}/page-${page.pageNumber}.jpg`,
    image.imageUrl
  );
  const quality = compactQuality(image.evaluation);
  await setStoryPageImage(story.id, page.pageNumber, { imageUrl: url, ...(quality ? { quality } : {}) });
  return { target, imageUrl: url, quality };
}

/** Which images a saved story is still missing. */
export function getMissingImageTargets(story: Pick<StoryRecord, "coverImageUrl" | "storyJson" | "pageImagesJson">): StoryImageTarget[] {
  const storyData = story.storyJson as StoredStoryData;
  const pageImages = (story.pageImagesJson ?? {}) as Record<string, StoredPageImage | undefined>;
  const missing: StoryImageTarget[] = story.coverImageUrl ? [] : ["cover"];
  for (const page of storyData.pages ?? []) {
    if (!pageImages[page.pageNumber]?.imageUrl) missing.push(page.pageNumber);
  }
  return missing;
}
