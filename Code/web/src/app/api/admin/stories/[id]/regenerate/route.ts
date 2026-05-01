import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, getImageModel } from "@/lib/config";
import { uploadBase64Image, createSupabaseServerClient } from "@/lib/supabase-server";
import {
  buildCharacterProfilePrompt,
  buildImagenSharedContext,
  buildImagenPagePrompt,
  buildImagenCoverPrompt,
  buildSharedImageGenerationContext,
  buildFinalImagePromptFromContext,
  buildCoverImagePromptFromContext,
} from "@/lib/prompts";
import { GoogleGenAI } from "@google/genai";
import type { CharacterProfile, StoredStoryData, StoryInput } from "@/types/storybook";

export const maxDuration = 300;
export const runtime = "nodejs";

const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-2.5-flash";

function isImagenModel(model: string) {
  return model.startsWith("imagen-");
}

function safeJsonParse<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned) as T;
}

async function generateCharacterProfileFromPhoto(
  characterName: string,
  photoBase64: string,
  photoMimeType: string,
  theme: string
): Promise<CharacterProfile> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const fakeInput: StoryInput = {
    childName: characterName,
    theme: theme as StoryInput["theme"],
    traits: [],
  };

  const prompt = buildCharacterProfilePrompt(fakeInput, characterName, [characterName]);

  const requestBody = {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: photoMimeType, data: photoBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { responseMimeType: "application/json" },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
  );
  if (!res.ok) throw new Error(`Gemini profile error: ${res.status}`);
  const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No profile text returned");
  return safeJsonParse<CharacterProfile>(text);
}

async function downloadPhotoAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download photo: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  return { base64: buffer.toString("base64"), mimeType };
}

async function generateImagenImage(model: string, prompt: string, aspectRatio: "3:4" | "16:9"): Promise<{ mimeType: string; data: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateImages({
    model,
    prompt,
    config: { numberOfImages: 1, aspectRatio },
  });
  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error("No image bytes returned");
  return { mimeType: "image/jpeg", data: imageBytes };
}

async function generateGeminiImage(model: string, prompt: string): Promise<{ mimeType: string; data: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const client = new GoogleGenAI({ apiKey });
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: { responseModalities: ["TEXT", "IMAGE"] },
  }) as { candidates?: Array<{ content?: { parts?: Array<{ thought?: boolean; inlineData?: { mimeType?: string; data?: string } }> } }> };
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(p => !p.thought && p.inlineData?.data);
  if (!imagePart?.inlineData?.data) throw new Error("No image data returned");
  return { mimeType: imagePart.inlineData.mimeType ?? "image/jpeg", data: imagePart.inlineData.data };
}

async function generateImage(model: string, prompt: string, aspectRatio: "3:4" | "16:9") {
  return isImagenModel(model)
    ? generateImagenImage(model, prompt, aspectRatio)
    : generateGeminiImage(model, prompt);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  const storyData = story.storyJson as unknown as StoredStoryData;
  const characterPhotos = storyData.characterPhotos ?? [];
  const model = await getImageModel();
  const timestamp = Date.now();
  const supabase = createSupabaseServerClient();

  // Step 1: Re-derive character profiles from stored photos
  const characterProfiles: CharacterProfile[] = [];
  for (const charPhoto of characterPhotos) {
    if (!charPhoto.persistedPhotoUrl) continue;
    try {
      // Get signed URL for the photo
      const path = charPhoto.persistedPhotoUrl.includes("/child-photos/")
        ? charPhoto.persistedPhotoUrl.split("/child-photos/").pop()!
        : charPhoto.persistedPhotoUrl;
      const { data: signedData } = await supabase.storage.from("child-photos").createSignedUrl(path, 300);
      const photoUrl = signedData?.signedUrl ?? charPhoto.persistedPhotoUrl;
      const { base64, mimeType } = await downloadPhotoAsBase64(photoUrl);
      const profile = await generateCharacterProfileFromPhoto(
        charPhoto.characterName,
        base64,
        mimeType,
        story.theme
      );
      characterProfiles.push(profile);
    } catch (err) {
      console.error(`Profile generation failed for ${charPhoto.characterName}:`, err);
    }
  }

  if (characterProfiles.length === 0) {
    return NextResponse.json({ error: "Could not derive character profiles from stored photos" }, { status: 500 });
  }

  // Step 2: Build shared context based on model type
  const sharedContext = isImagenModel(model)
    ? buildImagenSharedContext(characterProfiles)
    : buildSharedImageGenerationContext(characterProfiles);

  // Step 3: Regenerate all page images
  const pageImagesJson: Record<number, { imageUrl: string }> = {};
  for (const page of storyData.pages) {
    try {
      const prompt = isImagenModel(model)
        ? buildImagenPagePrompt(sharedContext, page)
        : buildFinalImagePromptFromContext(sharedContext, page, { reinforceConsistency: page.pageNumber > 1 });

      const image = await generateImage(model, prompt, "3:4");
      const dataUrl = `data:${image.mimeType};base64,${image.data}`;
      const url = await uploadBase64Image(
        "story-images",
        `${story.userId}/${timestamp}/page-${page.pageNumber}.jpg`,
        dataUrl
      );
      pageImagesJson[page.pageNumber] = { imageUrl: url };

      // Small delay between pages to respect rate limits
      if (page.pageNumber < storyData.pages.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`Page ${page.pageNumber} failed:`, err);
    }
  }

  // Step 4: Regenerate cover image
  let coverImageUrl: string | undefined;
  try {
    const characterNames = characterProfiles.map(p => p.characterName);
    const coverPrompt = isImagenModel(model)
      ? buildImagenCoverPrompt(sharedContext, storyData.title, characterNames)
      : buildCoverImagePromptFromContext(sharedContext, storyData.title, characterNames);

    const coverImage = await generateImage(model, coverPrompt, "16:9");
    const coverDataUrl = `data:${coverImage.mimeType};base64,${coverImage.data}`;
    coverImageUrl = await uploadBase64Image(
      "story-images",
      `${story.userId}/${timestamp}/cover.jpg`,
      coverDataUrl
    );
  } catch (err) {
    console.error("Cover generation failed:", err);
  }

  // Step 5: Update story in DB — same ID, same access link
  await prisma.story.update({
    where: { id },
    data: {
      ...(coverImageUrl ? { coverImageUrl } : {}),
      pageImagesJson: pageImagesJson as object,
    },
  });

  return NextResponse.json({ success: true, pagesRegenerated: Object.keys(pageImagesJson).length });
}
