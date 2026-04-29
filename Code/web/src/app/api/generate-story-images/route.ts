import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { buildFinalImagePrompt, buildCoverImagePrompt, buildRetryImagePrompt } from "@/lib/prompts";
import type {
  CharacterProfile,
  GeneratedStory,
  PageImagePrompt,
  CoverImagePrompt,
  GeneratedStoryImage,
} from "@/types/storybook";

// ── Request / response types ──────────────────────────────────────────────────

interface GenerateStoryImagesRequest {
  characterProfile?: CharacterProfile;
  story?: GeneratedStory;
  imagePrompts?: PageImagePrompt[];
  coverImagePrompt?: CoverImagePrompt;
}

interface GenerateStoryImagesResponse {
  images: GeneratedStoryImage[];
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function generatePlaceholderImageUrl(pageNumber: number, seed: string): string {
  const b64 = Buffer.from(seed).toString("base64").substring(0, 20);
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(`page-${pageNumber}-${b64}`)}&scale=80&backgroundColor=FCF7EE`;
}

const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.0-flash-preview-image-generation";

function extractGeneratedImagePart(response: any):
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
  });

  console.log("[Gemini] Raw response candidates:", JSON.stringify(response?.candidates?.map((c: any) => ({
    parts: c?.content?.parts?.map((p: any) => ({
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


// ── Baseline image generation — one attempt, no retry loops, no heuristics ───
//
// Only treats a page as failed when:
//   1. The API returns a non-OK HTTP status
//   2. The response contains no base64 image data
//   3. A network/timeout error occurs
//
// No quality heuristics, no automatic retries, no rejection based on image size.

async function generatePageImage(
  pageNumber: number,
  prompt: string
): Promise<GeneratedStoryImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      pageNumber,
      isPlaceholder: true,
      error: "GEMINI_API_KEY not configured",
      imageUrl: generatePlaceholderImageUrl(pageNumber, prompt),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const abortHandler = () => controller.abort();
    controller.signal.addEventListener("abort", abortHandler, { once: true });
    const generatedImagePromise = generateGeminiImage(prompt);
    const generatedImage = await Promise.race([
      generatedImagePromise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => reject(new Error("This operation was aborted")),
          { once: true }
        );
      }),
    ]);
    clearTimeout(timeoutId);
    controller.signal.removeEventListener("abort", abortHandler);
    const imageUrl = `data:${generatedImage.mimeType};base64,${generatedImage.data}`;

    if (process.env.NODE_ENV === "development") {
      console.log(`[Page ${pageNumber}] ✓ Generated`);
    }

    return { pageNumber, imageUrl };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : "Generation failed";
    console.error(`[Page ${pageNumber}] ✗ GEMINI ERROR:`, message, err);
    return {
      pageNumber,
      isPlaceholder: true,
      error: message,
      imageUrl: generatePlaceholderImageUrl(pageNumber, prompt),
    };
  }
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
    const { characterProfile, story, imagePrompts, coverImagePrompt } = body;

    // Cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverImage = await _generateValidatedPageImage(0, coverImagePrompt.prompt);
      return NextResponse.json({ images: [coverImage] } satisfies GenerateStoryImagesResponse);
    }

    // Page images request
    if (
      !characterProfile ||
      !story ||
      !Array.isArray(imagePrompts) ||
      imagePrompts.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Request must include either (characterProfile, story, imagePrompts) or (coverImagePrompt).",
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

      const prompt = buildFinalImagePrompt(characterProfile, storyPage, {
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
