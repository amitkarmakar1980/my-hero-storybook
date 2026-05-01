import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStorageObjects, getStoragePathFromPublicUrl, uploadBase64Image } from "@/lib/supabase-server";

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

// PATCH — add/update individual page images as they finish generating
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (story.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as {
    pageNumber?: number;
    imageBase64?: string;
    coverImageBase64?: string;
  };

  const timestamp = Date.now();
  const currentImages = (story.pageImagesJson as Record<string, { imageUrl: string }>) ?? {};

  if (body.coverImageBase64?.startsWith("data:")) {
    const coverImageUrl = await uploadBase64Image("story-images", `${story.userId}/${timestamp}/cover.jpg`, body.coverImageBase64);
    await prisma.story.update({ where: { id }, data: { coverImageUrl } });
    return NextResponse.json({ coverImageUrl });
  }

  if (body.pageNumber !== undefined && body.imageBase64?.startsWith("data:")) {
    const url = await uploadBase64Image("story-images", `${story.userId}/${timestamp}/page-${body.pageNumber}.jpg`, body.imageBase64);
    const updatedImages = { ...currentImages, [body.pageNumber]: { imageUrl: url } };
    await prisma.story.update({ where: { id }, data: { pageImagesJson: updatedImages as object } });
    return NextResponse.json({ pageNumber: body.pageNumber, imageUrl: url });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
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
