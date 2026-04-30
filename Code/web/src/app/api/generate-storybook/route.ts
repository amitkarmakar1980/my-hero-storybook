import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildCharacterProfilePrompt,
  buildCoverImagePromptFromContext,
  buildSharedImageGenerationContext,
  buildStoryGenerationPrompt,
  buildStoryRefinementPrompt,
} from "@/lib/prompts";
import type {
  StoryInput,
  CharacterPhotoInput,
  CharacterProfile,
  StoryCharacterInput,
  GeneratedStory,
  PageImagePrompt,
  CoverImagePrompt,
  StoryImageGenerationContext,
} from "@/types/storybook";

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

function safeJsonParse<T>(text: string): T {
  // Gemini sometimes wraps responses in markdown code fences — strip them before parsing.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

async function generateJson<T>(
  prompt: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const content: { parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> } = {
    parts: [
      {
        text: prompt,
      },
    ],
  };

  // Add image if provided (for character profile generation)
  if (imageBase64 && imageMimeType) {
    content.parts.unshift({
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    });
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: content.parts,
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  console.log("Calling Gemini API with request body...");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    if (process.env.NODE_ENV === "development") {
      console.error(`Gemini API error (${response.status}):`, errorText);
    }
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GeminiTextResponse;
  if (process.env.NODE_ENV === "development") {
    console.log("Gemini API response:", JSON.stringify(data, null, 2));
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    if (process.env.NODE_ENV === "development") {
      console.error("No text in Gemini response. Full response:", JSON.stringify(data, null, 2));
    }
    throw new Error("No text in Gemini response");
  }

  if (process.env.NODE_ENV === "development") {
    console.log("Extracted text from response:", text);
  }
  return safeJsonParse<T>(text);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = (await request.json()) as StoryInput;
    const characterNamesFromCharacters = body.characters?.map((character) => character.name.trim()).filter(Boolean) ?? [];
    const characterNames = characterNamesFromCharacters.length > 0
      ? characterNamesFromCharacters
      : body.characterNames?.map((name) => name.trim()).filter(Boolean) ?? [];
    const normalizedCharacterNames = characterNames.length > 0
      ? characterNames
      : (body.childName?.trim() ? [body.childName.trim()] : []);

    const normalizedCharacters: StoryCharacterInput[] = normalizedCharacterNames.map((characterName, index) => {
      const character = body.characters?.[index];
      return {
        name: characterName,
        age: typeof character?.age === "number" ? character.age : Number.NaN,
        traits: character?.traits ?? body.traits ?? [],
      } as StoryCharacterInput;
    });

    if (
      normalizedCharacterNames.length === 0 ||
      !body.theme ||
      normalizedCharacters.some((character) => !Number.isFinite(character.age))
    ) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (normalizedCharacterNames.length > 5) {
      return NextResponse.json(
        { error: "You can include up to 5 characters in one story." },
        { status: 400 }
      );
    }

    if (!session?.user?.id && normalizedCharacterNames.length > 1) {
      return NextResponse.json(
        { error: "Sign in to create a story with multiple characters." },
        { status: 403 }
      );
    }

    const normalizedCharacterPhotos: CharacterPhotoInput[] = normalizedCharacterNames.map((characterName, index) => {
      const photo = body.characterPhotos?.[index];
      if (photo) {
        return {
          ...photo,
          characterName,
        };
      }

      if (index === 0) {
        return {
          characterName,
          uploadedImageBase64: body.uploadedImageBase64,
          uploadedImageMimeType: body.uploadedImageMimeType,
          uploadedImageName: body.uploadedImageName,
        };
      }

      return { characterName };
    });

    const hasMissingPhoto = normalizedCharacterPhotos.some(
      (photo) => !photo.uploadedImageBase64 && !photo.persistedPhotoUrl
    );

    if (hasMissingPhoto) {
      return NextResponse.json(
        { error: "Add a separate photo for each character." },
        { status: 400 }
      );
    }

    if (normalizedCharacters.some((character) => !Number.isInteger(character.age) || character.age < 1 || character.age > 100)) {
      return NextResponse.json(
        { error: "Enter a valid numeric age between 1 and 100 for each character." },
        { status: 400 }
      );
    }

    const normalizedInput: StoryInput = {
      ...body,
      childName: normalizedCharacterNames.join(", "),
      characterNames: normalizedCharacterNames,
      characters: normalizedCharacters,
      characterPhotos: normalizedCharacterPhotos,
      traits: normalizedCharacters[0]?.traits ?? [],
    };

    const characterProfiles = await Promise.all(
      normalizedCharacterPhotos.map(async (characterPhoto) => {
        const characterProfile = await generateJson<CharacterProfile>(
          buildCharacterProfilePrompt(
            normalizedInput,
            characterPhoto.characterName,
            normalizedCharacterNames
          ),
          characterPhoto.uploadedImageBase64,
          characterPhoto.uploadedImageMimeType
        );

        return {
          ...characterProfile,
          characterName: characterPhoto.characterName,
        };
      })
    );

    const storyDraft = await generateJson<GeneratedStory>(
      buildStoryGenerationPrompt(normalizedInput, characterProfiles)
    );

    const refinedStory = await generateJson<GeneratedStory>(
      buildStoryRefinementPrompt(JSON.stringify(storyDraft), normalizedInput)
    );

    const imagePrompts: PageImagePrompt[] = refinedStory.pages.map((p) => ({
      pageNumber: p.pageNumber,
    }));

    const imageGenerationContext: StoryImageGenerationContext = {
      characterNames: normalizedCharacterNames,
      characterProfiles,
      characterPhotos: normalizedCharacterPhotos,
      sharedContextPrompt: buildSharedImageGenerationContext(characterProfiles),
    };

    const coverImagePrompt: CoverImagePrompt = {
      prompt: buildCoverImagePromptFromContext(
        imageGenerationContext.sharedContextPrompt,
        refinedStory.title,
        normalizedCharacterNames
      ),
    };

    return NextResponse.json({
      childName: normalizedInput.childName,
      characterNames: normalizedInput.characterNames,
      characters: normalizedInput.characters,
      characterPhotos: normalizedInput.characterPhotos,
      characterProfiles,
      imageGenerationContext,
      characterProfile: characterProfiles[0],
      story: refinedStory,
      coverImagePrompt,
      imagePrompts,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV === "development") {
      console.error("generate-storybook error:", errorMessage);
    }
    return NextResponse.json(
      { error: `Failed to generate storybook: ${errorMessage}` },
      { status: 500 }
    );
  }
}