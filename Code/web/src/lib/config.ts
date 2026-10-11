import { prisma } from "@/lib/prisma";
import {
  IMAGE_MODELS,
  IMAGES_PER_STORY,
  DEFAULT_IMAGE_MODEL,
  isSupportedImageModel,
  type ImageModelId,
} from "@/lib/imageModels";

export { IMAGE_MODELS, IMAGES_PER_STORY, DEFAULT_IMAGE_MODEL, isSupportedImageModel };
export type { ImageModelId };

const ADMIN_EMAILS = ["amitkarmakar1980@gmail.com"];

export const DEFAULT_TEXT_MODEL = "gemini-3.8-flash";

export function getTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL ?? DEFAULT_TEXT_MODEL;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

export function getModelCost(modelId: string): number {
  return IMAGE_MODELS.find((m) => m.id === modelId)?.costPerImage ?? IMAGE_MODELS[0].costPerImage;
}

/**
 * Resolves the active image model: admin DB setting → env var → default.
 * Values that aren't in IMAGE_MODELS (e.g. retired Imagen IDs) are skipped so a
 * stale setting can't silently break generation.
 */
export async function getImageModel(): Promise<ImageModelId> {
  try {
    const config = await prisma.appConfig.findUnique({ where: { key: "imageModel" } });
    const saved = config?.value;
    if (isSupportedImageModel(saved)) return saved;
    if (saved) {
      console.warn(`Ignoring unsupported imageModel setting "${saved}"`);
    }
  } catch {}

  const envModel = process.env.GEMINI_IMAGE_MODEL;
  if (isSupportedImageModel(envModel)) return envModel;
  if (envModel) {
    console.warn(`Ignoring unsupported GEMINI_IMAGE_MODEL "${envModel}"`);
  }
  return DEFAULT_IMAGE_MODEL;
}

export async function setImageModel(modelId: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: "imageModel" },
    update: { value: modelId },
    create: { key: "imageModel", value: modelId },
  });
}
