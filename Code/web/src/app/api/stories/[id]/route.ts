import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStorageObjects, getStoragePathFromPublicUrl } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (story.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ story });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (story.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pageImagesJson = story.pageImagesJson as Record<string, { imageUrl?: string }>;
  const storagePaths = [
    story.coverImageUrl,
    ...Object.values(pageImagesJson).map((image) => image.imageUrl),
  ]
    .map((url) => (url ? getStoragePathFromPublicUrl("story-images", url) : null))
    .filter((path): path is string => Boolean(path));

  await prisma.story.delete({ where: { id: story.id } });

  try {
    await deleteStorageObjects("story-images", storagePaths);
  } catch {
    // Storage cleanup is best-effort after the record is removed.
  }

  return NextResponse.json({ success: true });
}
