import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = ["amitkarmakar1980@gmail.com"];

export const IMAGE_MODELS = [
  {
    id: "imagen-4.0-generate-001",
    label: "Imagen 4 Standard",
    costPerImage: 0.04,
    description: "Best quality · $0.04/image · $0.28/story",
  },
  {
    id: "imagen-4.0-fast-generate-001",
    label: "Imagen 4 Fast",
    costPerImage: 0.02,
    description: "Lower quality · $0.02/image · $0.14/story",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    costPerImage: 0.039,
    description: "Supports reference photos · $0.039/image · $0.27/story",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    costPerImage: 0.045,
    description: "Latest Gemini · $0.045+/image · $0.32+/story",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const IMAGES_PER_STORY = 7;

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

export function getModelCost(modelId: string): number {
  return IMAGE_MODELS.find((m) => m.id === modelId)?.costPerImage ?? 0.02;
}

export async function getImageModel(): Promise<string> {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: "imageModel" } });
    if (config?.value) return config.value;
  } catch {}
  return process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";
}

export async function setImageModel(modelId: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: "imageModel" },
    update: { value: modelId },
    create: { key: "imageModel", value: modelId },
  });
}
