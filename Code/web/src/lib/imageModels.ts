// Client-safe model catalog — shared by the admin UI and server routes.
// Prices are Gemini API standard rates at 1K resolution (Oct 2026).

export const IMAGES_PER_STORY = 7;

export const IMAGE_MODELS = [
  {
    id: "gemini-nano-banana-2.1",
    label: "Nano Banana 2.1",
    costPerImage: 0.0336,
    description: "Recommended · $0.034/image · $0.24/story",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2",
    costPerImage: 0.067,
    description: "Stable 3.1 Flash Image · $0.067/image · $0.47/story",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro",
    costPerImage: 0.134,
    description: "Highest quality · $0.134/image · $0.94/story",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    costPerImage: 0.0336,
    description: "High volume, lower fidelity · $0.034/image · $0.24/story",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gemini-nano-banana-2.1";

export function isSupportedImageModel(modelId: string | null | undefined): modelId is ImageModelId {
  return !!modelId && IMAGE_MODELS.some((m) => m.id === modelId);
}
