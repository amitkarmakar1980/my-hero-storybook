import { ApiError, GoogleGenAI } from "@google/genai";
import { buildRetryImagePrompt } from "@/lib/prompts";
import {
  evaluateImage,
  evaluationRank,
  type ImageEvaluation,
  type ImageEvaluationInput,
  type InlineImage,
} from "@/lib/imageQuality";
import type {
  CharacterPhotoInput,
  CharacterProfile,
  GeneratedStoryImage,
} from "@/types/storybook";

export type { InlineImage };

// Server-only image generation shared by the story and admin-regenerate routes.

export type ImageAspectRatio = "3:4" | "16:9";

type GeminiRequestPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiCandidatePart {
  text?: string;
  thought?: boolean;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

interface GeminiImageResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: GeminiCandidatePart[];
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

// 3:4 portrait pages, 16:9 landscape cover — must match the aspectRatio sent to the model.
export const PAGE_IMAGE_SIZE = { width: 1024, height: 1365 };
export const COVER_IMAGE_SIZE = { width: 1600, height: 900 };
const STORYBOOK_BACKGROUND = { r: 251, g: 241, b: 227, alpha: 1 };

const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;
/** At most one regeneration is spent on a quality-gate failure. */
const MAX_QUALITY_RETRIES = 1;

/** Raised when the model answered but returned no image (safety block, text-only reply). */
class NoImageReturnedError extends Error {}

export function generatePlaceholderImageUrl(pageNumber: number, seed: string): string {
  const b64 = Buffer.from(seed).toString("base64").substring(0, 20);
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(`page-${pageNumber}-${b64}`)}&scale=80&backgroundColor=FCF7EE`;
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey });
}

function extractGeneratedImagePart(response: GeminiImageResponse): InlineImage | undefined {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return undefined;
  }

  for (const part of parts) {
    if (part?.thought) {
      continue;
    }

    const inlineData = part?.inlineData;
    if (inlineData?.data) {
      return {
        mimeType: inlineData.mimeType ?? "image/png",
        data: inlineData.data,
      };
    }
  }

  return undefined;
}

/** Summarizes why a response carried no image, for logs. */
function describeMissingImage(response: GeminiImageResponse): string {
  const candidate = response?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join(" ")
    .slice(0, 300);
  return [
    response?.promptFeedback?.blockReason && `blockReason=${response.promptFeedback.blockReason}`,
    candidate?.finishReason && `finishReason=${candidate.finishReason}`,
    text && `text="${text}"`,
  ]
    .filter(Boolean)
    .join(" ") || "empty response";
}

async function normalizeGeneratedImage(
  image: InlineImage,
  size: { width: number; height: number }
): Promise<InlineImage> {
  const sharp = (await import("sharp")).default;
  const normalizedBuffer = await sharp(Buffer.from(image.data, "base64"))
    .rotate()
    .resize(size.width, size.height, {
      fit: "cover",
      position: "center",
      background: STORYBOOK_BACKGROUND,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return {
    mimeType: "image/jpeg",
    data: normalizedBuffer.toString("base64"),
  };
}

export function buildReferenceImageParts(
  characterProfiles: CharacterProfile[] | undefined,
  characterPhotos: CharacterPhotoInput[] | undefined
): GeminiRequestPart[] {
  if (!characterProfiles || !characterPhotos) {
    return [];
  }

  const parts: GeminiRequestPart[] = [];

  for (const characterProfile of characterProfiles) {
    const matchingPhoto = characterPhotos.find(
      (characterPhoto) =>
        characterPhoto.characterName === characterProfile.characterName &&
        characterPhoto.uploadedImageBase64 &&
        characterPhoto.uploadedImageMimeType
    );

    if (!matchingPhoto?.uploadedImageBase64 || !matchingPhoto.uploadedImageMimeType) {
      continue;
    }

    parts.push({
      text: `Reference photo for ${characterProfile.characterName}. Treat this image as the canonical identity reference. Preserve the same face, hairline, hair density, hairstyle, skin tone, and age appearance in the generated illustration.`,
    });
    parts.push({
      inlineData: {
        mimeType: matchingPhoto.uploadedImageMimeType,
        data: matchingPhoto.uploadedImageBase64,
      },
    });
  }

  return parts;
}

export async function generateImage(
  model: string,
  prompt: string,
  aspectRatio: ImageAspectRatio,
  options?: {
    characterProfiles?: CharacterProfile[];
    characterPhotos?: CharacterPhotoInput[];
  }
): Promise<InlineImage> {
  const client = getClient();

  const response = (await client.models.generateContent({
    model,
    contents: [{
      role: "user" as const,
      parts: [
        ...buildReferenceImageParts(options?.characterProfiles, options?.characterPhotos),
        { text: prompt },
      ],
    }],
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio, imageSize: "1K" },
      abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  })) as GeminiImageResponse;

  const generatedImage = extractGeneratedImagePart(response);
  if (!generatedImage) {
    throw new NoImageReturnedError(`No image returned (${describeMissingImage(response)})`);
  }
  return generatedImage;
}

type FailureKind = "rate-limit" | "transient" | "no-image" | "permanent";

function classifyError(err: unknown): FailureKind {
  if (err instanceof NoImageReturnedError) return "no-image";
  if (err instanceof ApiError) {
    if (err.status === 429) return "rate-limit";
    if (err.status >= 500) return "transient";
    return "permanent"; // 400/401/403/404 — bad request, key, or retired model
  }
  const message = err instanceof Error ? `${err.name} ${err.message}`.toLowerCase() : "";
  if (message.includes("429") || message.includes("quota") || message.includes("rate limit")) {
    return "rate-limit";
  }
  // Timeouts and network failures
  return "transient";
}

function referencePhotosFor(
  characterProfiles: CharacterProfile[] | undefined,
  characterPhotos: CharacterPhotoInput[] | undefined
): InlineImage[] {
  return buildReferenceImageParts(characterProfiles, characterPhotos)
    .flatMap((part) => ("inlineData" in part ? [part.inlineData] : []));
}

/**
 * Generates one page or cover image with retries, and falls back to a
 * placeholder instead of throwing. Transient failures (rate limit, 5xx,
 * timeout, empty response) are retried; permanent errors fail fast.
 *
 * When `evaluation` is given, every image passes through the quality gate
 * (pixel checks + LLM judge). A failing image is regenerated once with the
 * judge's feedback; if it still fails, the best-scoring attempt is returned
 * with `quality.isValid = false` rather than a placeholder.
 */
export async function generateValidatedImage(
  model: string,
  pageNumber: number,
  initialPrompt: string,
  options?: {
    aspectRatio?: ImageAspectRatio;
    characterProfiles?: CharacterProfile[];
    characterPhotos?: CharacterPhotoInput[];
    evaluation?: Omit<ImageEvaluationInput, "referencePhotos">;
  }
): Promise<GeneratedStoryImage & { evaluation?: ImageEvaluation }> {
  const aspectRatio = options?.aspectRatio ?? "3:4";
  const size = aspectRatio === "16:9" ? COVER_IMAGE_SIZE : PAGE_IMAGE_SIZE;
  const evaluationInput: ImageEvaluationInput | undefined = options?.evaluation && {
    ...options.evaluation,
    referencePhotos: referencePhotosFor(options.characterProfiles, options.characterPhotos),
  };
  let currentPrompt = initialPrompt;
  let lastError = "";
  let rateLimited = false;
  let qualityRetries = 0;
  let best: { image: InlineImage; evaluation?: ImageEvaluation } | undefined;
  let attempt = 0;

  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    let finalImage: InlineImage;
    try {
      const generatedImage = await generateImage(model, currentPrompt, aspectRatio, {
        characterProfiles: options?.characterProfiles,
        characterPhotos: options?.characterPhotos,
      });
      finalImage = await normalizeGeneratedImage(generatedImage, size);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const kind = classifyError(err);
      rateLimited = kind === "rate-limit";
      console.error(
        `[image] model=${model} page=${pageNumber} attempt=${attempt}/${MAX_ATTEMPTS} kind=${kind}: ${lastError}`
      );

      if (kind === "permanent") break;
      if (kind === "no-image") {
        currentPrompt = buildRetryImagePrompt(initialPrompt, undefined);
      } else if (attempt < MAX_ATTEMPTS) {
        const baseDelay = kind === "rate-limit" ? 5000 : 2000;
        await new Promise((r) => setTimeout(r, Math.min(baseDelay * Math.pow(2, attempt - 1), 30_000)));
      }
      continue;
    }

    if (!evaluationInput) {
      return { pageNumber, attempts: attempt, imageUrl: toDataUrl(finalImage) };
    }

    const evaluation = await evaluateImage(finalImage, evaluationInput);
    console.log(
      `[quality] model=${model} page=${pageNumber} attempt=${attempt} passed=${evaluation.passed}` +
        (evaluation.scores ? ` scores=${JSON.stringify(evaluation.scores)}` : "") +
        (evaluation.flags.length ? ` flags=${evaluation.flags.join(",")}` : "")
    );
    if (!best || evaluationRank(evaluation) > evaluationRank(best.evaluation!)) {
      best = { image: finalImage, evaluation };
    }
    if (evaluation.passed || qualityRetries >= MAX_QUALITY_RETRIES) break;

    qualityRetries++;
    currentPrompt = buildRetryImagePrompt(initialPrompt, evaluation.invalidReason, [
      ...evaluation.flags,
      ...(evaluation.notes ? [evaluation.notes] : []),
    ]);
  }

  if (best) {
    const evaluation = best.evaluation!;
    return {
      pageNumber,
      attempts: attempt,
      imageUrl: toDataUrl(best.image),
      evaluation,
      quality: {
        isValid: evaluation.passed,
        invalidReason: evaluation.invalidReason,
        qualityFlags: evaluation.flags,
        attempts: attempt,
        maxAttempts: MAX_ATTEMPTS,
      },
    };
  }

  return {
    pageNumber,
    attempts: attempt,
    isPlaceholder: true,
    error: rateLimited ? "Rate limited" : lastError || "Generation failed",
    imageUrl: generatePlaceholderImageUrl(pageNumber, initialPrompt),
  };
}

function toDataUrl(image: InlineImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}
