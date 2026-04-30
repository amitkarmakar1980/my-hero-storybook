import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StorySavedClient from "./StorySavedClient";
import type { StoredStoryData } from "@/types/storybook";

export default async function SavedStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id } });

  if (!story) notFound();
  if (story.userId !== session.user.id) notFound();

  return (
    <StorySavedClient
      story={{
        id: story.id,
        title: story.title,
        coverText: story.coverText,
        theme: story.theme,
        childName: story.childName,
        coverImageUrl: story.coverImageUrl ?? undefined,
        storyJson: story.storyJson as unknown as StoredStoryData,
        pageImagesJson: story.pageImagesJson as unknown as Record<number, { imageUrl: string }>,
        createdAt: story.createdAt.toISOString(),
      }}
    />
  );
}
