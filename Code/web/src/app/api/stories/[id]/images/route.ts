import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import {
  generateAndPersistStoryImage,
  getMissingImageTargets,
  resolveGenerationContext,
  type StoryImageTarget,
} from "@/lib/storyImages";
import type { StoredPageImage } from "@/types/storybook";

export const runtime = "nodejs";
export const maxDuration = 300;

async function loadAuthorizedStory(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (story.userId !== session.user.id && !isAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { story };
}

// GET — which images (cover / page numbers) the story is still missing
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { story, error } = await loadAuthorizedStory(id);
  if (error) return error;
  return NextResponse.json({ missing: getMissingImageTargets(story) });
}

// POST { target: "cover" | pageNumber, force?: boolean } — generate and persist one image.
// Idempotent: returns the existing image unless `force` is set.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { story, error } = await loadAuthorizedStory(id);
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { target?: StoryImageTarget; force?: boolean };
  const target = body.target;
  if (target !== "cover" && !(typeof target === "number" && Number.isInteger(target))) {
    return NextResponse.json({ error: 'target must be "cover" or a page number' }, { status: 400 });
  }

  if (!body.force) {
    const existing = target === "cover"
      ? story.coverImageUrl
      : ((story.pageImagesJson ?? {}) as Record<string, StoredPageImage | undefined>)[target]?.imageUrl;
    if (existing) return NextResponse.json({ target, imageUrl: existing, existing: true });
  }

  try {
    const context = await resolveGenerationContext(story);
    const result = await generateAndPersistStoryImage(story, target, context);
    if (result.error) {
      console.error(`[story-images] story=${id} target=${target} failed: ${result.error}`);
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[story-images] story=${id} target=${target} error: ${message}`);
    return NextResponse.json({ target, error: message }, { status: 500 });
  }
}
