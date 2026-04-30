import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStorageObjects, getStoragePathFromPublicUrl } from "@/lib/supabase-server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const photo = await prisma.uploadedPhoto.findUnique({ where: { id } });

  if (!photo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (photo.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storagePath = getStoragePathFromPublicUrl("child-photos", photo.url);

  await prisma.uploadedPhoto.delete({ where: { id: photo.id } });

  if (storagePath) {
    try {
      await deleteStorageObjects("child-photos", [storagePath]);
    } catch {
      // Storage cleanup is best-effort after the record is removed.
    }
  }

  return NextResponse.json({ success: true });
}