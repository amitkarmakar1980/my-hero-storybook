import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail, getImageModel } from "@/lib/config";
import {
  generateAndPersistStoryImage,
  resolveGenerationContext,
  type StoryImageTarget,
} from "@/lib/storyImages";
import type { StoredStoryData } from "@/types/storybook";

export const maxDuration = 300;
export const runtime = "nodejs";

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

  // Step 1: Re-derive character profiles from the stored photos (photos are
  // also passed to every image call as identity references)
  let context: Awaited<ReturnType<typeof resolveGenerationContext>>;
  try {
    context = await resolveGenerationContext(story, { rederiveProfiles: true });
  } catch (err) {
    console.error("Regenerate: context failed:", err);
    return NextResponse.json({ error: "Could not derive character profiles from stored photos" }, { status: 500 });
  }

  // Step 2: Regenerate every page, then the cover. Each image is persisted as
  // it completes; a failed image keeps its previous version.
  const storyData = story.storyJson as unknown as StoredStoryData;
  const model = await getImageModel();
  const timestamp = Date.now();
  const targets: StoryImageTarget[] = [...storyData.pages.map((p) => p.pageNumber), "cover"];
  const failed: StoryImageTarget[] = [];

  for (const [index, target] of targets.entries()) {
    try {
      const result = await generateAndPersistStoryImage(story, target, context, { model, timestamp });
      if (result.error) failed.push(target);
    } catch (err) {
      console.error(`Regenerate: ${target} failed:`, err);
      failed.push(target);
    }
    // Small delay between images to respect rate limits
    if (index < targets.length - 1) await new Promise((r) => setTimeout(r, 2000));
  }

  const pagesRegenerated = targets.filter((t) => t !== "cover" && !failed.includes(t)).length;
  return NextResponse.json({ success: failed.length === 0, pagesRegenerated, failed });
}
