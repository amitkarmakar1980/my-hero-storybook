import { NextRequest, NextResponse } from "next/server";
import { buildFinalImagePrompt, buildRetryImagePrompt } from "@/lib/prompts";
import type {
  CharacterProfile,
  GeneratedStory,
  PageImagePrompt,
  CoverImagePrompt,
  GeneratedStoryImage,
  InvalidImageReason,
  PageImageQuality,
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

// ── Generate a placeholder image using DiceBear avatars API ──────────────────

function generatePlaceholderImageUrl(pageNumber: number, prompt: string): string {
  // Create a deterministic seed based on page number and prompt
  const seed = `page-${pageNumber}-${Buffer.from(prompt).toString('base64').substring(0, 20)}`;
  
  // Use DiceBear Avatars API (free, no auth required) to generate colorful placeholder
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}&scale=80&backgroundColor=FCF7EE`;
}

// ── Image validation ──────────────────────────────────────────────────────────

function validateImageFormat(base64Data: string): { valid: boolean; reason?: string } {
  try {
    const buffer = Buffer.from(base64Data.substring(0, 500), 'base64');
    const uint8Array = new Uint8Array(buffer);
    
    // Check for PNG signature (137 80 78 71 = \x89PNG)
    if (uint8Array[0] === 137 && uint8Array[1] === 80 && uint8Array[2] === 78 && uint8Array[3] === 71) {
      return { valid: true };
    }

    // Check for JPEG signature (255 216 = \xFFD8)
    if (uint8Array[0] === 255 && uint8Array[1] === 216) {
      return { valid: true };
    }

    return { valid: false, reason: "Unsupported image format" };
  } catch (err) {
    return { valid: true }; // If parsing fails, assume valid
  }
}

// ── Per-page image validation and quality assessment ────────────────────────

/**
 * Assess generated image quality based on heuristics.
 * Returns quality assessment with specific failure reasons for retry targeting.
 */
function assessImageQuality(
  imageUrl: string | undefined,
  base64Data: string | undefined,
  pageNumber: number
): PageImageQuality {
  // If no image or placeholder, mark as invalid
  if (!imageUrl || imageUrl.includes("dicebear")) {
    return {
      isValid: false,
      invalidReason: "placeholder",
      attempts: 0,
      maxAttempts: 2,
    };
  }

  // Check image size as proxy for content richness
  if (base64Data && base64Data.length < 5000) {
    return {
      isValid: false,
      invalidReason: "low_information_scene",
      qualityFlags: ["sparse_content"],
      attempts: 0,
      maxAttempts: 2,
    };
  }

  // Assume valid if format is correct and size is reasonable
  return {
    isValid: true,
    attempts: 1,
    maxAttempts: 2,
  };
}

/**
 * Generate a single page image with automatic selective retry.
 * Max attempts: 2 per page (1 initial + 1 retry if invalid)
 *
 * Flow:
 * 1. Generate image with initial prompt
 * 2. Assess quality
 * 3. If valid, return immediately
 * 4. If invalid, build a retry prompt with targeted reinforcement
 * 5. Generate again (retry)
 * 6. Assess quality again
 * 7. Return result (accept or fail with quality info)
 */
async function generateValidatedPageImage(
  pageNumber: number,
  initialPrompt: string
): Promise<GeneratedStoryImage> {
  const MAX_ATTEMPTS = 2;
  let currentPrompt = initialPrompt;
  let lastError: string = "";
  let lastQuality: PageImageQuality | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set.");
      }

      if (process.env.NODE_ENV === "development") {
        console.log(`[Page ${pageNumber}] Attempt ${attempt}/${MAX_ATTEMPTS}`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        // Call Imagen API
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [{ prompt: currentPrompt }],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const statusCode = response.status;

          // API not available — use placeholder
          if (statusCode === 404 || statusCode === 403 || statusCode === 400) {
            if (process.env.NODE_ENV === "development") {
              console.log(
                `[Page ${pageNumber}] Imagen API not available (${statusCode}). Using placeholder.`
              );
            }

            return {
              pageNumber,
              imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
              isPlaceholder: true,
              attempts: attempt,
              quality: {
                isValid: false,
                invalidReason: "generation_failed",
                attempts: attempt,
                maxAttempts: MAX_ATTEMPTS,
              },
            };
          }

          lastError = `API error (${statusCode})`;
          
          if (attempt < MAX_ATTEMPTS) {
            // Retry with reinforced prompt
            currentPrompt = buildRetryImagePrompt(
              initialPrompt,
              lastQuality?.invalidReason,
              lastQuality?.qualityFlags
            );
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        const data = (await response.json()) as any;
        const prediction = data.predictions?.[0];

        if (!prediction || !prediction.bytesBase64Encoded) {
          lastError = data.error?.message || "No image generated";
          
          if (attempt < MAX_ATTEMPTS) {
            currentPrompt = buildRetryImagePrompt(
              initialPrompt,
              lastQuality?.invalidReason,
              lastQuality?.qualityFlags
            );
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        // Validate format
        const formatValidation = validateImageFormat(prediction.bytesBase64Encoded);
        if (!formatValidation.valid) {
          lastError = `Format validation failed: ${formatValidation.reason}`;
          
          if (attempt < MAX_ATTEMPTS) {
            currentPrompt = buildRetryImagePrompt(
              initialPrompt,
              lastQuality?.invalidReason,
              lastQuality?.qualityFlags
            );
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        const imageUrl = `data:${
          prediction.mimeType || "image/png"
        };base64,${prediction.bytesBase64Encoded}`;

        // Assess quality
        const quality = assessImageQuality(
          imageUrl,
          prediction.bytesBase64Encoded,
          pageNumber
        );

        // If valid, return immediately
        if (quality.isValid) {
          if (process.env.NODE_ENV === "development") {
            console.log(`[Page ${pageNumber}] ✓ Valid image generated on attempt ${attempt}`);
          }

          return {
            pageNumber,
            imageUrl,
            attempts: attempt,
            quality,
          };
        }

        // Store quality for retry decision
        lastQuality = quality;

        // If invalid and we have retries left, build targeted retry prompt
        if (attempt < MAX_ATTEMPTS) {
          if (process.env.NODE_ENV === "development") {
            console.log(
              `[Page ${pageNumber}] Invalid: ${quality.invalidReason} — retrying with reinforcement`
            );
          }

          currentPrompt = buildRetryImagePrompt(
            initialPrompt,
            quality.invalidReason,
            quality.qualityFlags
          );
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        // Max attempts reached, return failed result
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[Page ${pageNumber}] ✗ Failed after ${attempt} attempts: ${quality.invalidReason}`
          );
        }

        return {
          pageNumber,
          imageUrl,
          attempts: attempt,
          quality,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      lastError = message;

      if (attempt === MAX_ATTEMPTS) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[Page ${pageNumber}] ✗ Generation failed after ${MAX_ATTEMPTS} attempts`,
            lastError
          );
        }

        // Return failed result with fallback placeholder
        return {
          pageNumber,
          imageUrl: generatePlaceholderImageUrl(pageNumber, pageNumber.toString()),
          isPlaceholder: true,
          error: message,
          attempts: MAX_ATTEMPTS,
          quality: {
            isValid: false,
            invalidReason: "generation_failed",
            attempts: MAX_ATTEMPTS,
            maxAttempts: MAX_ATTEMPTS,
          },
        };
      }
    }
  }

  // Fallback (should not reach)
  return {
    pageNumber,
    imageUrl: generatePlaceholderImageUrl(pageNumber, pageNumber.toString()),
    isPlaceholder: true,
    error: lastError || "Generation failed",
    attempts: MAX_ATTEMPTS,
    quality: {
      isValid: false,
      invalidReason: "generation_failed",
      attempts: MAX_ATTEMPTS,
      maxAttempts: MAX_ATTEMPTS,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateStoryImagesRequest;

    const { characterProfile, story, imagePrompts, coverImagePrompt } = body;

    // Handle cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverImage = await generateValidatedPageImage(0, coverImagePrompt.prompt);
      const responseBody: GenerateStoryImagesResponse = { images: [coverImage] };
      return NextResponse.json(responseBody);
    }

    // Handle page images request
    if (!characterProfile || !story || !Array.isArray(imagePrompts) || imagePrompts.length === 0) {
      return NextResponse.json(
        { error: "Request must include either (characterProfile, story, imagePrompts) or (coverImagePrompt)." },
        { status: 400 }
      );
    }

    // Build Imagen prompts from the canonical builder, then generate concurrently with auto-retry.
    const images = await Promise.all(
      imagePrompts.map((ip) => {
        const storyPage = story.pages.find((p) => p.pageNumber === ip.pageNumber);
        if (!storyPage) {
          return Promise.resolve<GeneratedStoryImage>({
            pageNumber: ip.pageNumber,
            error: `Page ${ip.pageNumber} not found in story`,
          });
        }
        const builtPrompt = buildFinalImagePrompt(characterProfile, storyPage, {
          reinforceConsistency: ip.pageNumber > 1,
        });
        return generateValidatedPageImage(ip.pageNumber, builtPrompt);
      })
    );

    const responseBody: GenerateStoryImagesResponse = { images };
    return NextResponse.json(responseBody);
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
