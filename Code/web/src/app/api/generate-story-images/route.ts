import { NextRequest, NextResponse } from "next/server";
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ prompt }] }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const statusCode = response.status;
      let errorDetail = `HTTP ${statusCode}`;
      try {
        const text = await response.text();
        errorDetail = `HTTP ${statusCode}: ${text.substring(0, 300)}`;
      } catch {
        // ignore
      }
      if (process.env.NODE_ENV === "development") {
        console.log(`[Page ${pageNumber}] API error — ${errorDetail}`);
      }
      return {
        pageNumber,
        isPlaceholder: true,
        error: errorDetail,
        imageUrl: generatePlaceholderImageUrl(pageNumber, prompt),
      };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const predictions = data.predictions as Array<Record<string, unknown>> | undefined;
    const prediction = predictions?.[0];

    if (!prediction?.bytesBase64Encoded) {
      const errMsg =
        (data.error as Record<string, unknown>)?.message?.toString() ??
        "No image data returned";
      if (process.env.NODE_ENV === "development") {
        console.log(`[Page ${pageNumber}] Empty response — ${errMsg}`);
      }
      return {
        pageNumber,
        isPlaceholder: true,
        error: errMsg,
        imageUrl: generatePlaceholderImageUrl(pageNumber, prompt),
      };
    }

    const mimeType = (prediction.mimeType as string | undefined) ?? "image/png";
    const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;

    if (process.env.NODE_ENV === "development") {
      console.log(`[Page ${pageNumber}] ✓ Generated`);
    }

    return { pageNumber, imageUrl };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err instanceof Error ? err.message : "Generation failed";
    if (process.env.NODE_ENV === "development") {
      console.error(`[Page ${pageNumber}] ✗`, message);
    }
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instances: [{ prompt: currentPrompt }] }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        const statusCode = response.status;

        if (statusCode === 404 || statusCode === 403 || statusCode === 400) {
          return {
            pageNumber,
            isPlaceholder: true,
            error: `API unavailable (${statusCode})`,
            imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
          };
        }

        if (statusCode === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const backoffMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(5000 * Math.pow(2, attempt - 1), 30_000);
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          return {
            pageNumber,
            isPlaceholder: true,
            error: "Rate limited",
            imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
          };
        }

        lastError = `API error (${statusCode})`;
        if (attempt < MAX_ATTEMPTS) {
          currentPrompt = buildRetryImagePrompt(initialPrompt, lastInvalidReason);
          await new Promise((r) => setTimeout(r, 2000 * attempt));
          continue;
        }
        break;
      }

      const data = (await response.json()) as Record<string, unknown>;
      const predictions = data.predictions as Array<Record<string, unknown>> | undefined;
      const prediction = predictions?.[0];

      if (!prediction?.bytesBase64Encoded) {
        lastError = "No image data returned";
        if (attempt < MAX_ATTEMPTS) {
          currentPrompt = buildRetryImagePrompt(initialPrompt, lastInvalidReason);
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        break;
      }

      const mimeType = (prediction.mimeType as string | undefined) ?? "image/png";
      const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
      return { pageNumber, imageUrl };
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err.message : "Unknown error";
      if (attempt === MAX_ATTEMPTS) break;
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
      const coverImage = await generatePageImage(0, coverImagePrompt.prompt);
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

    // Generate each page sequentially with a 3-second gap to respect rate limits.
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

      const image = await generatePageImage(ip.pageNumber, prompt);
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
