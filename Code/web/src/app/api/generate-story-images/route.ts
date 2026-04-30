import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  buildFinalImagePrompt,
  buildFinalImagePromptFromContext,
  buildRetryImagePrompt,
  buildSharedImageGenerationContext,
} from "@/lib/prompts";
import type {
  CharacterProfile,
  CharacterPhotoInput,
  GeneratedStory,
  PageImagePrompt,
  CoverImagePrompt,
  GeneratedStoryImage,
  StoryImageGenerationContext,
} from "@/types/storybook";

export const runtime = "nodejs";

// ── Request / response types ──────────────────────────────────────────────────

interface GenerateStoryImagesRequest {
  imageGenerationContext?: StoryImageGenerationContext;
  characterProfiles?: CharacterProfile[];
  characterProfile?: CharacterProfile;
  characterPhotos?: CharacterPhotoInput[];
  story?: GeneratedStory;
  imagePrompts?: PageImagePrompt[];
  coverImagePrompt?: CoverImagePrompt;
}

type GeminiRequestPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GenerateStoryImagesResponse {
  images: GeneratedStoryImage[];
}

interface GeminiCandidatePart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiCandidatePart[];
    };
  }>;
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function generatePlaceholderImageUrl(pageNumber: number, seed: string): string {
  const b64 = Buffer.from(seed).toString("base64").substring(0, 20);
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(`page-${pageNumber}-${b64}`)}&scale=80&backgroundColor=FCF7EE`;
}

const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const TARGET_PAGE_IMAGE_WIDTH = 1024;
const TARGET_PAGE_IMAGE_HEIGHT = 1280;
const TARGET_COVER_IMAGE_WIDTH = 1600;
const TARGET_COVER_IMAGE_HEIGHT = 900;
const STORYBOOK_BACKGROUND = { r: 251, g: 241, b: 227, alpha: 1 };

function extractGeneratedImagePart(response: GeminiImageResponse):
  | { mimeType: string; data: string }
  | undefined {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }

  for (const part of parts) {
    if (part?.thought) {
      continue;
    }

    const inlineData = part?.inlineData;
    if (inlineData?.data) {
      return {
        mimeType: inlineData.mimeType ?? "image/png",
        data: inlineData.data,
      };
    }
  }

  return undefined;
}

async function normalizeGeneratedImage(image: {
  mimeType: string;
  data: string;
}, options?: {
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
}): Promise<{ mimeType: string; data: string }> {
  const sharp = (await import("sharp")).default;
  const inputBuffer = Buffer.from(image.data, "base64");
  const width = options?.width ?? TARGET_PAGE_IMAGE_WIDTH;
  const height = options?.height ?? TARGET_PAGE_IMAGE_HEIGHT;
  const fit = options?.fit ?? "cover";

  const normalizedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(width, height, {
      fit,
      position: "center",
      background: STORYBOOK_BACKGROUND,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return {
    mimeType: "image/jpeg",
    data: normalizedBuffer.toString("base64"),
  };
}

function buildReferenceImageParts(
  characterProfiles: CharacterProfile[] | undefined,
  characterPhotos: CharacterPhotoInput[] | undefined
): GeminiRequestPart[] {
  if (!characterProfiles || !characterPhotos) {
    return [];
  }

  const parts: GeminiRequestPart[] = [];

  for (const characterProfile of characterProfiles) {
    const matchingPhoto = characterPhotos.find(
      (characterPhoto) =>
        characterPhoto.characterName === characterProfile.characterName &&
        characterPhoto.uploadedImageBase64 &&
        characterPhoto.uploadedImageMimeType
    );

    if (!matchingPhoto?.uploadedImageBase64 || !matchingPhoto.uploadedImageMimeType) {
      continue;
    }

    parts.push({
      text: `Reference photo for ${characterProfile.characterName}. Treat this image as the canonical identity reference. Preserve the same face, hairline, hair density, hairstyle, skin tone, and age appearance in the generated illustration.`,
    });
    parts.push({
      inlineData: {
        mimeType: matchingPhoto.uploadedImageMimeType,
        data: matchingPhoto.uploadedImageBase64,
      },
    });
  }

  return parts;
}

async function generateGeminiImage(
  prompt: string,
  characterProfiles?: CharacterProfile[],
  characterPhotos?: CharacterPhotoInput[]
): Promise<{ mimeType: string; data: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const client = new GoogleGenAI({ apiKey });
  const contents = [{
    role: "user" as const,
    parts: [
      ...buildReferenceImageParts(characterProfiles, characterPhotos),
      { text: prompt },
    ],
  }];
  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  }) as GeminiImageResponse;

  console.log("[Gemini] Raw response candidates:", JSON.stringify(response?.candidates?.map((c) => ({
    parts: c?.content?.parts?.map((p) => ({
      hasText: !!p?.text,
      hasInlineData: !!p?.inlineData,
      inlineDataMime: p?.inlineData?.mimeType,
      inlineDataLen: p?.inlineData?.data?.length,
      thought: p?.thought,
      keys: Object.keys(p || {}),
    }))
  })), null, 2));

  const generatedImage = extractGeneratedImagePart(response);
  if (!generatedImage) {
    console.error("[Gemini] No image in response. Full response:", JSON.stringify(response, null, 2));
    throw new Error("No image data returned");
  }

  return generatedImage;
}

// ── Advanced generation (disabled by default) ─────────────────────────────────
// Re-enable by calling _generateValidatedPageImage() instead of generatePageImage().
// Includes: automatic selective retry, quality heuristics, exponential backoff on 429.

async function _generateValidatedPageImage(
  pageNumber: number,
  initialPrompt: string,
  characterProfiles?: CharacterProfile[],
  characterPhotos?: CharacterPhotoInput[],
  normalizationOptions?: {
    width?: number;
    height?: number;
    fit?: "cover" | "contain";
  }
): Promise<GeneratedStoryImage> {
  const MAX_ATTEMPTS = 2;
  let currentPrompt = initialPrompt;
  let lastError = "";
  let lastInvalidReason: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const generatedImage = await Promise.race([
        generateGeminiImage(currentPrompt, characterProfiles, characterPhotos),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new Error("This operation was aborted")),
            { once: true }
          );
        }),
      ]);
      clearTimeout(timeoutId);
      const normalizedImage = await normalizeGeneratedImage(generatedImage, normalizationOptions);
      const imageUrl = `data:${normalizedImage.mimeType};base64,${normalizedImage.data}`;
      return { pageNumber, imageUrl };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : "Unknown error";

      if (
        lastError.includes("429") ||
        lastError.toLowerCase().includes("rate") ||
        lastError.toLowerCase().includes("quota")
      ) {
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, Math.min(5000 * Math.pow(2, attempt - 1), 30_000)));
          continue;
        }

        return {
          pageNumber,
          isPlaceholder: true,
          error: "Rate limited",
          imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
        };
      }

      if (attempt === MAX_ATTEMPTS) break;
      currentPrompt = buildRetryImagePrompt(initialPrompt, lastInvalidReason);
    }
  }

  return {
    pageNumber,
    isPlaceholder: true,
    error: lastError || "Generation failed",
    imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateStoryImagesRequest;
    const { story, imagePrompts, coverImagePrompt, characterPhotos } = body;
    const imageGenerationContext = body.imageGenerationContext;
    const characterProfiles = imageGenerationContext?.characterProfiles ?? body.characterProfiles ?? (body.characterProfile ? [body.characterProfile] : undefined);
    const resolvedCharacterPhotos = imageGenerationContext?.characterPhotos ?? characterPhotos;
    const sharedContextPrompt = imageGenerationContext?.sharedContextPrompt
      || (characterProfiles ? buildSharedImageGenerationContext(characterProfiles) : undefined);

    // Cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverImage = await _generateValidatedPageImage(
        0,
        coverImagePrompt.prompt,
        characterProfiles,
        resolvedCharacterPhotos,
        {
          width: TARGET_COVER_IMAGE_WIDTH,
          height: TARGET_COVER_IMAGE_HEIGHT,
          fit: "contain",
        }
      );
      return NextResponse.json({ images: [coverImage] } satisfies GenerateStoryImagesResponse);
    }

    // Page images request
    if (
      !characterProfiles ||
      !story ||
      !Array.isArray(imagePrompts) ||
      imagePrompts.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Request must include either (characterProfiles, story, imagePrompts) or (coverImagePrompt).",
        },
        { status: 400 }
      );
    }

    // Generate each page sequentially using advanced retry/backoff logic.
    const images: GeneratedStoryImage[] = [];
    for (const ip of imagePrompts) {
      const storyPage = story.pages.find((p) => p.pageNumber === ip.pageNumber);
      if (!storyPage) {
        images.push({ pageNumber: ip.pageNumber, error: `Page ${ip.pageNumber} not found` });
        continue;
      }

      const prompt = sharedContextPrompt
        ? buildFinalImagePromptFromContext(sharedContextPrompt, storyPage, {
            reinforceConsistency: ip.pageNumber > 1,
          })
        : buildFinalImagePrompt(characterProfiles, storyPage, {
            reinforceConsistency: ip.pageNumber > 1,
          });

      let image: GeneratedStoryImage;
      try {
        image = await _generateValidatedPageImage(ip.pageNumber, prompt, characterProfiles, resolvedCharacterPhotos);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (process.env.NODE_ENV === "development") {
          console.error(`[Page ${ip.pageNumber}] Fatal error:`, message);
        }
        image = {
          pageNumber: ip.pageNumber,
          isPlaceholder: true,
          error: message,
          imageUrl: generatePlaceholderImageUrl(ip.pageNumber, prompt),
        };
      }
      images.push(image);

      // 3-second gap between pages to stay within API rate limits
      if (ip !== imagePrompts[imagePrompts.length - 1]) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    return NextResponse.json({ images } satisfies GenerateStoryImagesResponse);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("generate-story-images error:", error);
    }
    return NextResponse.json(
      { error: "Failed to generate story images." },
      { status: 500 }
    );
  }
}
