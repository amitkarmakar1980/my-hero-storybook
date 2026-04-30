import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildFinalImagePrompt, buildRetryImagePrompt } from "@/lib/prompts";
import type {
  CharacterProfile,
  GeneratedStory,
  PageImagePrompt,
  CoverImagePrompt,
  GeneratedStoryImage,
} from "@/types/storybook";

// ── Request / response types ──────────────────────────────────────────────────

interface GenerateStoryImagesRequest {
  characterProfiles?: CharacterProfile[];
  characterProfile?: CharacterProfile;
  story?: GeneratedStory;
  imagePrompts?: PageImagePrompt[];
  coverImagePrompt?: CoverImagePrompt;
}

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
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview";

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

async function generateGeminiImage(prompt: string): Promise<{ mimeType: string; data: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: prompt,
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
  initialPrompt: string
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
        generateGeminiImage(currentPrompt),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new Error("This operation was aborted")),
            { once: true }
          );
        }),
      ]);
      clearTimeout(timeoutId);
      const imageUrl = `data:${generatedImage.mimeType};base64,${generatedImage.data}`;
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
    const { story, imagePrompts, coverImagePrompt } = body;
    const characterProfiles = body.characterProfiles ?? (body.characterProfile ? [body.characterProfile] : undefined);

    // Cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverImage = await _generateValidatedPageImage(0, coverImagePrompt.prompt);
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

      const prompt = buildFinalImagePrompt(characterProfiles, storyPage, {
        reinforceConsistency: ip.pageNumber > 1,
      });

      let image: GeneratedStoryImage;
      try {
        image = await _generateValidatedPageImage(ip.pageNumber, prompt);
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
