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

// ── Per-page image generation ─────────────────────────────────────────────────

async function generatePageImage(prompt: PageImagePrompt): Promise<GeneratedStoryImage> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }

    if (process.env.NODE_ENV === "development") {
      console.log(`Generating image for page ${prompt.pageNumber}...`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-001:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt.prompt,
                  },
                ],
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
        
        // If Imagen not available, use placeholder
        if (statusCode === 404 || statusCode === 403 || statusCode === 400) {
          if (process.env.NODE_ENV === "development") {
            console.log(`Imagen API not available (${statusCode}). Using placeholder image.`);
          }
          
          return {
            pageNumber: prompt.pageNumber,
            imageUrl: generatePlaceholderImageUrl(prompt.pageNumber, prompt.prompt),
            isPlaceholder: true,
          };
        }
        
        throw new Error(`API error (${statusCode}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      if (process.env.NODE_ENV === "development") {
        console.log(`Response for page ${prompt.pageNumber}:`, JSON.stringify(data));
      }

      // Extract image URL from Imagen API response structure
      const imageUrl = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType
        ? `data:${data.candidates[0].content.parts[0].inlineData.mimeType};base64,${data.candidates[0].content.parts[0].inlineData.data}`
        : data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!imageUrl) {
        const errorDetail = data.error?.message || `No image generated. Response: ${JSON.stringify(data)}`;
        throw new Error(`Image generation failed: ${errorDetail}`);
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
    if (process.env.NODE_ENV === "development") {
      console.error(`Page ${prompt.pageNumber} image error:`, message);
    }
    
    // Fallback to placeholder image on error
    return {
      pageNumber: prompt.pageNumber,
      imageUrl: generatePlaceholderImageUrl(prompt.pageNumber, prompt.pageNumber.toString()),
      isPlaceholder: true,
      error: message,
    };
  }
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
