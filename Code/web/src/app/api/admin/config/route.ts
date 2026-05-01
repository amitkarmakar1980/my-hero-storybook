import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getImageModel, setImageModel, IMAGE_MODELS, isAdminEmail } from "@/lib/config";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const currentModel = await getImageModel();
  return NextResponse.json({ currentModel, models: IMAGE_MODELS });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { modelId } = await request.json();
  const valid = IMAGE_MODELS.some((m) => m.id === modelId);
  if (!valid) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }
  await setImageModel(modelId);
  return NextResponse.json({ success: true, currentModel: modelId });
}
