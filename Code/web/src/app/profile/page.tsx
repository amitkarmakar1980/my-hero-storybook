import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorageUrl } from "@/lib/supabase-server";
import ProfileClient from "./ProfileClient";

async function getThumbnailUrl(story: {
  coverImageUrl: string | null;
  childPhotoUrl: string | null;
  pageImagesJson: unknown;
}) {
  const pageImages = story.pageImagesJson as Record<string, { imageUrl?: string }>;
  const directImageUrl = story.coverImageUrl ?? pageImages["1"]?.imageUrl ?? Object.values(pageImages)[0]?.imageUrl;
  if (directImageUrl) {
    return directImageUrl;
  }

  if (story.childPhotoUrl) {
    return resolveStorageUrl("child-photos", story.childPhotoUrl);
  }

  return null;
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [stories, photos] = await Promise.all([
    prisma.story.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        coverText: true,
        theme: true,
        childName: true,
        coverImageUrl: true,
        childPhotoUrl: true,
        pageImagesJson: true,
        createdAt: true,
      },
    }),
    prisma.uploadedPhoto.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const resolvedStories = await Promise.all(
    stories.map(async (story) => ({
      ...story,
      thumbnailUrl: await getThumbnailUrl(story),
      createdAt: story.createdAt.toISOString(),
    }))
  );

  const fallbackStoryPhotos = stories
    .filter((story) => story.childPhotoUrl)
    .map((story) => ({
      id: `story-${story.id}`,
      url: story.childPhotoUrl as string,
      filename: `${story.childName}-photo`,
      createdAt: story.createdAt,
    }));

  const mergedPhotos = [...photos, ...fallbackStoryPhotos].filter(
    (photo, index, allPhotos) => allPhotos.findIndex((candidate) => candidate.url === photo.url) === index
  );

  const resolvedPhotos = await Promise.all(
    mergedPhotos
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(async (photo) => ({
        ...photo,
        url: await resolveStorageUrl("child-photos", photo.url),
        createdAt: photo.createdAt.toISOString(),
      }))
  );

  return (
    <ProfileClient
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }}
      stories={resolvedStories}
      photos={resolvedPhotos}
    />
  );
}
