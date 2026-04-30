import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveStorageUrl, uploadBase64Image } from "@/lib/supabase-server";

interface UploadPhotoRequest {
  photoBase64?: string;
  filename?: string;
  mimeType?: string;
}

function normalizePhotoDataUrl(photoBase64: string, mimeType?: string) {
  return photoBase64.startsWith("data:")
    ? photoBase64
    : `data:${mimeType || "image/jpeg"};base64,${photoBase64}`;
}

async function saveUploadedPhoto(options: {
  userId: string;
  filename: string;
  photoBase64: string;
  mimeType?: string;
}) {
  const ext = options.filename.split(".").pop() ?? "jpg";
  const path = `${options.userId}/${Date.now()}.${ext}`;
  const url = await uploadBase64Image(
    "child-photos",
    path,
    normalizePhotoDataUrl(options.photoBase64, options.mimeType)
  );

  return prisma.uploadedPhoto.create({
    data: { userId: options.userId, url, filename: options.filename },
  });
}

// GET /api/profile/photos — list the signed-in user's uploaded photos
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const photos = await prisma.uploadedPhoto.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const resolvedPhotos = await Promise.all(
    photos.map(async (photo: (typeof photos)[number]) => ({
      ...photo,
      storageUrl: photo.url,
      url: await resolveStorageUrl("child-photos", photo.url),
    }))
  );

  return NextResponse.json({ photos: resolvedPhotos });
}

// POST /api/profile/photos — upload a child photo (multipart form data)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as UploadPhotoRequest;
      if (!body.photoBase64) {
        return NextResponse.json({ error: "No valid photo provided" }, { status: 400 });
      }

      const photo = await saveUploadedPhoto({
        userId: session.user.id,
        filename: body.filename ?? "child-photo.jpg",
        photoBase64: body.photoBase64,
        mimeType: body.mimeType,
      });

      return NextResponse.json({ photo });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No photo provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || "image/jpeg";
    const photoBase64 = `data:${mimeType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;

    const photo = await saveUploadedPhoto({
      userId: session.user.id,
      filename: file.name || "child-photo.jpg",
      photoBase64,
      mimeType,
    });

    return NextResponse.json({ photo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Photo upload failed";
    if (process.env.NODE_ENV === "development") {
      console.error("profile photo upload error:", message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
