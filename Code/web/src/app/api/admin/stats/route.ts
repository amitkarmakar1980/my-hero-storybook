import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, getImageModel, getModelCost, IMAGES_PER_STORY } from "@/lib/config";

interface AdminUserSummary {
  id: string;
  name: string | null;
  email: string | null;
  storiesGenerated: number;
  storyPagesGenerated: number;
  imagesGenerated: number;
  photosUploaded: number;
  totalUploadedBytes: number;
  totalCost: number;
  lastStoryGenerationDate: string | null;
}

interface StoryMetricSummary {
  storyType: string;
  storiesGenerated: number;
}

const STORY_PAGES_PER_BOOK = 6;

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalStories, storiesThisMonth, storiesThisWeek, storiesToday, recentStories, totalUsers, users, storiesByType] =
    await Promise.all([
      prisma.story.count(),
      prisma.story.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.story.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }),
      prisma.story.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.story.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          _count: { select: { stories: true, photos: true } },
          stories: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          photos: { select: { fileSize: true } },
        },
      }),
      prisma.story.groupBy({
        by: ["theme"],
        _count: {
          theme: true,
        },
        orderBy: {
          _count: {
            theme: "desc",
          },
        },
      }),
    ]);

  const currentModel = await getImageModel();
  const costPerStory = getModelCost(currentModel) * IMAGES_PER_STORY;

  // Group stories by day for the chart
  const byDay: Record<string, number> = {};
  for (const story of recentStories) {
    const day = story.createdAt.toISOString().split("T")[0];
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  const userSummaries: AdminUserSummary[] = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      storiesGenerated: user._count.stories,
      storyPagesGenerated: user._count.stories * STORY_PAGES_PER_BOOK,
      imagesGenerated: user._count.stories * IMAGES_PER_STORY,
      photosUploaded: user._count.photos,
      totalUploadedBytes: user.photos.reduce((sum, p) => sum + (p.fileSize ?? 0), 0),
      totalCost: user._count.stories * costPerStory,
      lastStoryGenerationDate: user.stories[0]?.createdAt?.toISOString() ?? null,
    }))
    .sort((left, right) => {
      const rightTime = right.lastStoryGenerationDate ? new Date(right.lastStoryGenerationDate).getTime() : 0;
      const leftTime = left.lastStoryGenerationDate ? new Date(left.lastStoryGenerationDate).getTime() : 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.storiesGenerated - left.storiesGenerated;
    });

  const storyMetrics: StoryMetricSummary[] = storiesByType.map((storyType) => ({
    storyType: storyType.theme,
    storiesGenerated: storyType._count.theme,
  }));

  return NextResponse.json({
    totalStories,
    storiesThisMonth,
    storiesThisWeek,
    storiesToday,
    totalUsers,
    currentModel,
    costPerStory,
    estimatedMonthCost: storiesThisMonth * costPerStory,
    byDay,
    storyMetrics,
    users: userSummaries,
  });
}
