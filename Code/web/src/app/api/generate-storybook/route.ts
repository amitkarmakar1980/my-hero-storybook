import { NextRequest, NextResponse } from "next/server";
import {
  buildCharacterProfilePrompt,
  buildStoryGenerationPrompt,
  buildStoryRefinementPrompt,
  buildPageImagePromptPrompt,
} from "@/lib/prompts";
import type {
  StoryInput,
  CharacterProfile,
  GeneratedStory,
  PageImagePrompt,
} from "@/types/storybook";

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

  const content: any = {
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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

  const data = (await response.json()) as any;
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
    const body = (await request.json()) as StoryInput;

    if (!body.childName || !body.ageBand || !body.theme) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const characterProfile = await generateJson<CharacterProfile>(
      buildCharacterProfilePrompt(body),
      body.uploadedImageBase64,
      body.uploadedImageMimeType
    );

    const storyDraft = await generateJson<GeneratedStory>(
      buildStoryGenerationPrompt(body, characterProfile)
    );

    const refinedStory = await generateJson<GeneratedStory>(
      buildStoryRefinementPrompt(JSON.stringify(storyDraft), body)
    );

    const imagePrompts: PageImagePrompt[] = [];
    for (const page of refinedStory.pages) {
      const pagePrompt = await generateJson<PageImagePrompt>(
        buildPageImagePromptPrompt(page, characterProfile, body.theme, refinedStory.title)
      );
      imagePrompts.push(pagePrompt);
    }

    return NextResponse.json({
      characterProfile,
      story: refinedStory,
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