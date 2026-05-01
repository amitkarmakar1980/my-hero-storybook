import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  buildFinalImagePrompt,
  buildFinalImagePromptFromContext,
  buildImagenPagePrompt,
  buildImagenCoverPrompt,
  buildRetryImagePrompt,
  buildSharedImageGenerationContext,
  buildImagenSharedContext,
  buildCoverImagePromptFromContext,
} from "@/lib/prompts";
import { getImageModel } from "@/lib/config";
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

// 3:4 portrait — matches the "3:4" aspectRatio sent to Imagen
const TARGET_PAGE_IMAGE_WIDTH = 1024;
const TARGET_PAGE_IMAGE_HEIGHT = 1365;
// 16:9 landscape — matches the "16:9" aspectRatio sent to Imagen for the cover
const TARGET_COVER_IMAGE_WIDTH = 1600;
const TARGET_COVER_IMAGE_HEIGHT = 900;
const STORYBOOK_BACKGROUND = { r: 251, g: 241, b: 227, alpha: 1 };

function isImagenModel(model: string): boolean {
  return model.startsWith("imagen-");
}

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

async function generateImage(
  model: string,
  prompt: string,
  aspectRatio: "3:4" | "16:9",
  characterProfiles?: CharacterProfile[],
  characterPhotos?: CharacterPhotoInput[]
): Promise<{ mimeType: string; data: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const client = new GoogleGenAI({ apiKey });

  if (isImagenModel(model)) {
    const response = await client.models.generateImages({
      model,
      prompt,
      config: { numberOfImages: 1, aspectRatio },
    });
    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) throw new Error("No image bytes returned from Imagen");
    return { mimeType: "image/jpeg", data: imageBytes };
  }

  // Gemini multimodal — supports reference photo injection
  const contents = [{
    role: "user" as const,
    parts: [
      ...buildReferenceImageParts(characterProfiles, characterPhotos),
      { text: prompt },
    ],
  }];
  const response = await client.models.generateContent({
    model,
    contents,
    config: { responseModalities: ["TEXT", "IMAGE"] },
  }) as GeminiImageResponse;

  const generatedImage = extractGeneratedImagePart(response);
  if (!generatedImage) throw new Error("No image data returned from Gemini");
  return generatedImage;
}

// ── Advanced generation (disabled by default) ─────────────────────────────────
// Re-enable by calling _generateValidatedPageImage() instead of generatePageImage().
// Includes: automatic selective retry, quality heuristics, exponential backoff on 429.

async function _generateValidatedPageImage(
  model: string,
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
  const aspectRatio = normalizationOptions?.width === TARGET_COVER_IMAGE_WIDTH ? "16:9" : "3:4";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);

    try {
      const generatedImage = await Promise.race([
        generateImage(model, currentPrompt, aspectRatio, characterProfiles, characterPhotos),
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
    const GEMINI_IMAGE_MODEL = await getImageModel();
    const body = (await request.json()) as GenerateStoryImagesRequest;
    const { story, imagePrompts, coverImagePrompt, characterPhotos } = body;
    const imageGenerationContext = body.imageGenerationContext;
    const characterProfiles = imageGenerationContext?.characterProfiles ?? body.characterProfiles ?? (body.characterProfile ? [body.characterProfile] : undefined);
    const resolvedCharacterPhotos = imageGenerationContext?.characterPhotos ?? characterPhotos;
    const useImagen = isImagenModel(GEMINI_IMAGE_MODEL);
    const imagenSharedContext = useImagen && characterProfiles
      ? buildImagenSharedContext(characterProfiles)
      : undefined;
    const geminiSharedContext = !useImagen
      ? (imageGenerationContext?.sharedContextPrompt || (characterProfiles ? buildSharedImageGenerationContext(characterProfiles) : undefined))
      : undefined;

    // Cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverPrompt = useImagen && imagenSharedContext && characterProfiles
        ? buildImagenCoverPrompt(imagenSharedContext, "", characterProfiles.map(p => p.characterName))
        : coverImagePrompt.prompt;

      const coverImage = await _generateValidatedPageImage(
        GEMINI_IMAGE_MODEL,
        0,
        coverPrompt,
        characterProfiles,
        resolvedCharacterPhotos,
        { width: TARGET_COVER_IMAGE_WIDTH, height: TARGET_COVER_IMAGE_HEIGHT, fit: "cover" }
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
        { error: "Request must include either (characterProfiles, story, imagePrompts) or (coverImagePrompt)." },
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

      // Route to the correct prompt builder based on model type
      const prompt = useImagen && imagenSharedContext
        ? buildImagenPagePrompt(imagenSharedContext, storyPage)
        : geminiSharedContext
          ? buildFinalImagePromptFromContext(geminiSharedContext, storyPage, { reinforceConsistency: ip.pageNumber > 1 })
          : buildFinalImagePrompt(characterProfiles, storyPage, { reinforceConsistency: ip.pageNumber > 1 });

      let image: GeneratedStoryImage;
      try {
        image = await _generateValidatedPageImage(GEMINI_IMAGE_MODEL, ip.pageNumber, prompt, characterProfiles, resolvedCharacterPhotos);
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
