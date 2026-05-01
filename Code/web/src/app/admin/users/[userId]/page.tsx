import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveStorageUrl } from "@/lib/supabase-server";
import { isAdminEmail } from "@/lib/config";
import ProfileClient from "@/app/profile/ProfileClient";
import type { StoredStoryData } from "@/types/storybook";

async function getThumbnailUrl(story: {
  coverImageUrl: string | null;
  childPhotoUrl: string | null;
  pageImagesJson: unknown;
}) {
  const pageImages = story.pageImagesJson as Record<string, { imageUrl?: string }>;
  const directImageUrl = story.coverImageUrl ?? pageImages["1"]?.imageUrl ?? Object.values(pageImages)[0]?.imageUrl;
  if (directImageUrl) return directImageUrl;
  if (story.childPhotoUrl) return resolveStorageUrl("child-photos", story.childPhotoUrl);
  return null;
}

export default async function AdminUserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) redirect("/");

  const { userId } = await params;

  const [user, stories, photos] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true } }),
    prisma.story.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, coverText: true, theme: true, childName: true, coverImageUrl: true, storyJson: true, childPhotoUrl: true, pageImagesJson: true, createdAt: true },
    }),
    prisma.uploadedPhoto.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!user) redirect("/admin");

  const resolvedStories = await Promise.all(
    stories.map(async (story) => ({
      ...story,
      thumbnailUrl: await getThumbnailUrl(story),
      createdAt: story.createdAt.toISOString(),
    }))
  );

  const fallbackStoryPhotos = stories.flatMap((story) => {
    const storyJson = story.storyJson as unknown as StoredStoryData | null;
    const persistedPhotos = storyJson?.characterPhotos ?? [];
    if (persistedPhotos.length > 0) {
      return persistedPhotos.map((photo, index) => ({
        id: `story-${story.id}-${index}`,
        url: photo.persistedPhotoUrl,
        filename: photo.uploadedImageName ?? `${photo.characterName}-photo`,
        createdAt: story.createdAt,
        canDelete: false,
      }));
    }
    if (!story.childPhotoUrl) return [];
    return [{ id: `story-${story.id}`, url: story.childPhotoUrl, filename: `${story.childName}-photo`, createdAt: story.createdAt, canDelete: false }];
  });

  const mergedPhotos = [...photos, ...fallbackStoryPhotos].filter(
    (photo, index, all) => all.findIndex((p) => p.url === photo.url) === index
  );

  const resolvedPhotos = await Promise.all(
    mergedPhotos
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(async (photo) => ({
        ...photo,
        url: await resolveStorageUrl("child-photos", photo.url),
        createdAt: photo.createdAt.toISOString(),
      }))
  );

  return (
    <>
      {/* Admin banner */}
      <div className="bg-[#171E45] text-white text-sm px-5 py-3 flex items-center gap-4">
        <span className="opacity-60">👁 Viewing as admin</span>
        <span className="font-medium">{user.name ?? user.email}</span>
        <span className="opacity-40">·</span>
        <span className="opacity-60">{user.email}</span>
        <a href="/admin" className="ml-auto text-[#FC800A] font-medium hover:underline">
          ← Back to Admin
        </a>
      </div>

      <ProfileClient
        user={{ name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }}
        stories={resolvedStories}
        photos={resolvedPhotos}
      />
    </>
  );
}
