import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBase64Image } from "@/lib/supabase-server";
import type {
  CharacterPhotoInput,
  GeneratedStory,
  PersistedCharacterPhoto,
  StoryCharacterInput,
  StoredStoryData,
} from "@/types/storybook";

interface SaveStoryRequest {
  title: string;
  coverText: string;
  theme: string;
  childName: string;
  characterNames?: string[];
  characters?: StoryCharacterInput[];
  characterPhotos?: CharacterPhotoInput[];
  childPhotoUrl?: string;
  childPhotoBase64?: string;
  childPhotoMimeType?: string;
  coverImageBase64?: string;
  pageImagesBase64: Record<number, string>;
  storyJson: GeneratedStory;
}

function normalizePhotoDataUrl(photoBase64: string, mimeType?: string) {
  return photoBase64.startsWith("data:")
    ? photoBase64
    : `data:${mimeType || "image/jpeg"};base64,${photoBase64}`;
}

function getPersistedThumbnailUrl(options: {
  coverImageUrl?: string;
  pageImagesJson: Record<number, { imageUrl: string }>;
  childPhotoUrl?: string;
  characterPhotos?: PersistedCharacterPhoto[];
}) {
  return (
    options.coverImageUrl ??
    options.pageImagesJson[1]?.imageUrl ??
    Object.values(options.pageImagesJson)[0]?.imageUrl ??
    options.characterPhotos?.[0]?.persistedPhotoUrl ??
    options.childPhotoUrl ??
    null
  );
}

async function persistCharacterPhoto(options: {
  userId: string;
  timestamp: number;
  characterName: string;
  photo: CharacterPhotoInput;
}): Promise<PersistedCharacterPhoto | null> {
  const { userId, timestamp, characterName, photo } = options;

  if (photo.persistedPhotoUrl) {
    return {
      characterName,
      persistedPhotoUrl: photo.persistedPhotoUrl,
      uploadedImageName: photo.uploadedImageName,
    };
  }

  if (!photo.uploadedImageBase64) {
    return null;
  }

  const safeName = characterName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "character";
  const persistedPhotoUrl = await uploadBase64Image(
    "child-photos",
    `${userId}/${timestamp}/${safeName}-photo.jpg`,
    normalizePhotoDataUrl(photo.uploadedImageBase64, photo.uploadedImageMimeType)
  );

  await prisma.uploadedPhoto.create({
    data: {
      userId,
      url: persistedPhotoUrl,
      filename: photo.uploadedImageName ?? `${characterName}-photo.jpg`,
    },
  });

  return {
    characterName,
    persistedPhotoUrl,
    uploadedImageName: photo.uploadedImageName,
  };
}

// GET /api/stories — list the signed-in user's saved stories
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stories = await prisma.story.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      coverText: true,
      theme: true,
      childName: true,
      coverImageUrl: true,
      storyJson: true,
      childPhotoUrl: true,
      pageImagesJson: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    stories: stories.map((story: (typeof stories)[number]) => ({
      ...story,
      thumbnailUrl: getPersistedThumbnailUrl({
        coverImageUrl: story.coverImageUrl ?? undefined,
        childPhotoUrl: story.childPhotoUrl ?? undefined,
        pageImagesJson: story.pageImagesJson as Record<number, { imageUrl: string }>,
        characterPhotos: (story.storyJson as unknown as StoredStoryData).characterPhotos,
      }),
    })),
  });
}

// POST /api/stories — save a generated story
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SaveStoryRequest;
  const {
    title,
    coverText,
    theme,
    childName,
    characterNames,
    characters,
    characterPhotos,
    childPhotoUrl,
    childPhotoBase64,
    childPhotoMimeType,
    coverImageBase64,
    pageImagesBase64,
    storyJson,
  } = body;

  const userId = session.user.id;
  const timestamp = Date.now();
  let persistedChildPhotoUrl = childPhotoUrl;
  let persistedCharacterPhotos: PersistedCharacterPhoto[] = [];

  const normalizedCharacterPhotos = characterPhotos?.length
    ? characterPhotos
    : [
        {
          characterName: childName,
          persistedPhotoUrl: childPhotoUrl,
          uploadedImageBase64: childPhotoBase64,
          uploadedImageMimeType: childPhotoMimeType,
        },
      ];

  try {
    persistedCharacterPhotos = (
      await Promise.all(
        normalizedCharacterPhotos.map((photo, index) =>
          persistCharacterPhoto({
            userId,
            timestamp,
            characterName: photo.characterName || characterNames?.[index] || childName,
            photo,
          }).catch(() => null)
        )
      )
    ).filter((photo): photo is PersistedCharacterPhoto => photo !== null);
  } catch {
    persistedCharacterPhotos = [];
  }

  persistedChildPhotoUrl = persistedChildPhotoUrl ?? persistedCharacterPhotos[0]?.persistedPhotoUrl;

  // Upload cover image
  let coverImageUrl: string | undefined;
  if (coverImageBase64?.startsWith("data:")) {
    try {
      coverImageUrl = await uploadBase64Image(
        "story-images",
        `${userId}/${timestamp}/cover.jpg`,
        coverImageBase64
      );
    } catch {
      // Non-fatal — save story without cover image
    }
  }

  // Upload page images
  const pageImagesJson: Record<number, { imageUrl: string }> = {};
  for (const [pageNumStr, base64] of Object.entries(pageImagesBase64)) {
    const pageNum = Number(pageNumStr);
    if (!base64?.startsWith("data:")) continue;
    try {
      const url = await uploadBase64Image(
        "story-images",
        `${userId}/${timestamp}/page-${pageNum}.jpg`,
        base64
      );
      pageImagesJson[pageNum] = { imageUrl: url };
    } catch {
      // Skip failed page images
    }
  }

  const persistedThumbnailUrl = getPersistedThumbnailUrl({
    coverImageUrl,
    pageImagesJson,
    childPhotoUrl: persistedChildPhotoUrl,
    characterPhotos: persistedCharacterPhotos,
  });

  const storedStoryJson: StoredStoryData = {
    ...storyJson,
    characterNames,
    characters,
    characterPhotos: persistedCharacterPhotos,
  };

  const story = await prisma.story.create({
    data: {
      userId,
      title,
      coverText,
      theme,
      childName,
      coverImageUrl: coverImageUrl ?? null,
      childPhotoUrl: persistedChildPhotoUrl ?? null,
      storyJson: storedStoryJson as object,
      pageImagesJson: pageImagesJson as object,
    },
  });

  return NextResponse.json({ storyId: story.id, thumbnailUrl: persistedThumbnailUrl });
}
