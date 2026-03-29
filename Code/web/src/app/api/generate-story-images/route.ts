import { NextRequest, NextResponse } from "next/server";
import type {
  CharacterProfile,
  GeneratedStory,
  PageImagePrompt,
  GeneratedStoryImage,
} from "@/types/storybook";

// ── Request / response types ──────────────────────────────────────────────────

interface GenerateStoryImagesRequest {
  characterProfile: CharacterProfile;
  story: GeneratedStory;
  imagePrompts: PageImagePrompt[];
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

function validateImageQuality(base64Data: string): { valid: boolean; reason?: string } {
  try {
    // Decode first few bytes to check image properties
    const buffer = Buffer.from(base64Data.substring(0, 500), 'base64');
    const uint8Array = new Uint8Array(buffer);
    
    // Check for PNG signature (137 80 78 71 = \x89PNG)
    if (uint8Array[0] === 137 && uint8Array[1] === 80 && uint8Array[2] === 78 && uint8Array[3] === 71) {
      // PNG detected - basic validation passed
      // Note: Deep color analysis would require full image processing
      // For now, we assume Imagen 4.0 produces high-quality colorful images
      return { valid: true };
    }

    // Check for JPEG signature (255 216 = \xFFD8)
    if (uint8Array[0] === 255 && uint8Array[1] === 216) {
      return { valid: true };
    }

    return { valid: false, reason: "Unsupported image format" };
  } catch (err) {
    // If parsing fails, assume valid (will be caught by other checks)
    return { valid: true };
  }
}

// ── Per-page image generation with retry logic ──────────────────────────────

async function generatePageImage(
  prompt: PageImagePrompt,
  maxRetries: number = 2
): Promise<GeneratedStoryImage> {
  const MAX_ATTEMPTS = maxRetries + 1;
  let lastError: string = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set.");
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `Generating image for page ${prompt.pageNumber}${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ""}...`
        );
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout

      try {
        // Use Imagen 4.0 generate model with predict endpoint
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instances: [
                {
                  prompt: prompt.prompt,
                },
              ],
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const statusCode = response.status;

          if (process.env.NODE_ENV === "development") {
            console.log(`Imagen API error (${statusCode})`);
          }

          // If Imagen not available, use placeholder
          if (statusCode === 404 || statusCode === 403 || statusCode === 400) {
            if (process.env.NODE_ENV === "development") {
              console.log(
                `Imagen API not available (${statusCode}). Using placeholder image.`
              );
            }

            return {
              pageNumber: prompt.pageNumber,
              imageUrl: generatePlaceholderImageUrl(prompt.pageNumber, prompt.prompt),
              isPlaceholder: true,
            };
          }

          lastError = `API error (${statusCode}): ${errorText}`;
          
          if (attempt < MAX_ATTEMPTS) {
            // Wait before retrying (exponential backoff: 1s, 2s)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        const data = (await response.json()) as any;
        if (process.env.NODE_ENV === "development") {
          console.log(
            `Response for page ${prompt.pageNumber}:`,
            JSON.stringify(data).substring(0, 200)
          );
        }

        // Extract image from Imagen predict response
        // Response format: { predictions: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] }
        const prediction = data.predictions?.[0];
        if (!prediction || !prediction.bytesBase64Encoded) {
          const errorDetail =
            data.error?.message ||
            `No image generated. Response: ${JSON.stringify(data)}`;
          lastError = `Image generation failed: ${errorDetail}`;
          
          if (attempt < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        // Validate image quality
        const validation = validateImageQuality(prediction.bytesBase64Encoded);
        if (!validation.valid) {
          lastError = `Image validation failed: ${validation.reason}`;
          
          if (attempt < MAX_ATTEMPTS) {
            if (process.env.NODE_ENV === "development") {
              console.log(`Image validation failed for page ${prompt.pageNumber}, retrying...`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            continue;
          }
          
          throw new Error(lastError);
        }

        const imageUrl = `data:${
          prediction.mimeType || "image/png"
        };base64,${prediction.bytesBase64Encoded}`;

        if (process.env.NODE_ENV === "development" && attempt > 1) {
          console.log(`✓ Image generated successfully on attempt ${attempt}/page ${prompt.pageNumber}`);
        }

        return {
          pageNumber: prompt.pageNumber,
          imageUrl,
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image generation failed.";
      lastError = message;

      if (attempt === MAX_ATTEMPTS) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            `✗ Image generation failed for page ${prompt.pageNumber} after ${MAX_ATTEMPTS} attempts:`,
            message
          );
        }

        // Fallback to placeholder image after all retries
        return {
          pageNumber: prompt.pageNumber,
          imageUrl: generatePlaceholderImageUrl(prompt.pageNumber, prompt.pageNumber.toString()),
          isPlaceholder: true,
          error: message,
        };
      }
    }
  }

  // Fallback (should not reach here)
  return {
    pageNumber: prompt.pageNumber,
    imageUrl: generatePlaceholderImageUrl(prompt.pageNumber, prompt.pageNumber.toString()),
    isPlaceholder: true,
    error: lastError || "Image generation failed.",
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateStoryImagesRequest;

    const { characterProfile, story, imagePrompts } = body;

    if (!characterProfile || !story || !Array.isArray(imagePrompts) || imagePrompts.length === 0) {
      return NextResponse.json(
        { error: "Request must include characterProfile, story, and a non-empty imagePrompts array." },
        { status: 400 }
      );
    }

    // Generate all page images concurrently; per-page errors are captured, not thrown.
    const images = await Promise.all(imagePrompts.map(generatePageImage));

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
