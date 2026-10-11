import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_ILLUSTRATION_STYLE } from "@/lib/illustrationStyles";
import {
  buildFinalImagePrompt,
  buildFinalImagePromptFromContext,
  buildSharedImageGenerationContext,
} from "@/lib/prompts";
import { getImageModel } from "@/lib/config";
import { generatePlaceholderImageUrl, generateValidatedImage } from "@/lib/imageGeneration";
import type {
  CharacterProfile,
  CharacterPhotoInput,
  GeneratedStory,
  IllustrationStyle,
  PageImagePrompt,
  CoverImagePrompt,
  GeneratedStoryImage,
  StoryImageGenerationContext,
} from "@/types/storybook";

export const runtime = "nodejs";
// Each image call may take up to 2 minutes with retries; Pro models are slow.
export const maxDuration = 300;

// ── Request / response types ──────────────────────────────────────────────────

interface GenerateStoryImagesRequest {
  imageGenerationContext?: StoryImageGenerationContext;
  characterProfiles?: CharacterProfile[];
  characterProfile?: CharacterProfile;
  characterPhotos?: CharacterPhotoInput[];
  illustrationStyle?: IllustrationStyle;
  story?: GeneratedStory;
  imagePrompts?: PageImagePrompt[];
  coverImagePrompt?: CoverImagePrompt;
}

interface GenerateStoryImagesResponse {
  images: GeneratedStoryImage[];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const imageModel = await getImageModel();
    const body = (await request.json()) as GenerateStoryImagesRequest;
    const { story, imagePrompts, coverImagePrompt, characterPhotos } = body;
    const imageGenerationContext = body.imageGenerationContext;
    const illustrationStyle = imageGenerationContext?.illustrationStyle ?? body.illustrationStyle ?? DEFAULT_ILLUSTRATION_STYLE;
    const characterProfiles = imageGenerationContext?.characterProfiles ?? body.characterProfiles ?? (body.characterProfile ? [body.characterProfile] : undefined);
    const resolvedCharacterPhotos = imageGenerationContext?.characterPhotos ?? characterPhotos;
    const characterNames = characterProfiles?.map((p) => p.characterName) ?? [];
    const sharedContext =
      imageGenerationContext?.sharedContextPrompt ||
      (characterProfiles ? buildSharedImageGenerationContext(characterProfiles, illustrationStyle) : undefined);

    // Cover image request
    if (coverImagePrompt && !imagePrompts) {
      const coverImage = await generateValidatedImage(imageModel, 0, coverImagePrompt.prompt, {
        aspectRatio: "16:9",
        characterProfiles,
        characterPhotos: resolvedCharacterPhotos,
        evaluation: { kind: "cover", sceneText: "", characterNames, illustrationStyle },
      });
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

    // Generate each page sequentially; generateValidatedImage handles retry/backoff.
    const images: GeneratedStoryImage[] = [];
    for (const ip of imagePrompts) {
      const storyPage = story.pages.find((p) => p.pageNumber === ip.pageNumber);
      if (!storyPage) {
        images.push({ pageNumber: ip.pageNumber, error: `Page ${ip.pageNumber} not found` });
        continue;
      }

      const promptOptions = { reinforceConsistency: ip.pageNumber > 1, illustrationStyle };
      const prompt = sharedContext
        ? buildFinalImagePromptFromContext(sharedContext, storyPage, promptOptions)
        : buildFinalImagePrompt(characterProfiles, storyPage, promptOptions);

      let image: GeneratedStoryImage;
      try {
        image = await generateValidatedImage(imageModel, ip.pageNumber, prompt, {
          characterProfiles,
          characterPhotos: resolvedCharacterPhotos,
          evaluation: { kind: "page", sceneText: storyPage.text, characterNames, illustrationStyle },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[Page ${ip.pageNumber}] Fatal error:`, message);
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
    console.error("generate-story-images error:", error);
    return NextResponse.json(
      { error: "Failed to generate story images." },
      { status: 500 }
    );
  }
}
