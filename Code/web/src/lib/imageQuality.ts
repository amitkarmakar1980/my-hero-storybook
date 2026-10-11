import { GoogleGenAI, Type } from "@google/genai";
import { getIllustrationStyleOption } from "@/lib/illustrationStyles";
import type { IllustrationStyle, InvalidImageReason } from "@/types/storybook";

// Server-only image evaluation: cheap pixel checks plus an LLM judge.
// Used inline as a quality gate (imageGeneration.ts) and by scripts/eval-images.mts.

export interface InlineImage {
  mimeType: string;
  data: string;
}

export interface ImageEvaluationInput {
  kind: "page" | "cover";
  /** Page text, or the story title for covers. */
  sceneText: string;
  characterNames: string[];
  illustrationStyle?: IllustrationStyle;
  referencePhotos: InlineImage[];
}

export interface ImageScores {
  likeness: number;
  sceneMatch: number;
  styleMatch: number;
}

export interface ImageEvaluation {
  passed: boolean;
  invalidReason?: InvalidImageReason;
  scores?: ImageScores;
  flags: string[];
  notes?: string;
  judgeModel?: string;
}

const DEFAULT_JUDGE_MODEL = "gemini-3.5-flash-lite";
const JUDGE_TIMEOUT_MS = 45_000;

// Pass thresholds on the judge's 1–5 scales.
const MIN_LIKENESS = 3;
const MIN_SCENE_MATCH = 3;
const MIN_STYLE_MATCH = 3;

export function getJudgeModel(): string {
  return process.env.IMAGE_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;
}

/** IMAGE_QUALITY_GATE=off disables the inline judge (pixel checks still run). */
export function isQualityGateEnabled(): boolean {
  return process.env.IMAGE_QUALITY_GATE !== "off";
}

// ── Pixel checks ──────────────────────────────────────────────────────────────

/**
 * Deterministic, free checks: catches blank/flat frames and black-and-white
 * output. Runs on a 64×64 downsample.
 */
export async function checkImagePixels(image: InlineImage): Promise<ImageEvaluation> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(Buffer.from(image.data, "base64"))
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  let saturationSum = 0;
  let lumaSum = 0;
  let lumaSqSum = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    saturationSum += Math.max(r, g, b) - Math.min(r, g, b);
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaSum += luma;
    lumaSqSum += luma * luma;
  }
  const meanSaturation = saturationSum / pixelCount / 255;
  const meanLuma = lumaSum / pixelCount;
  const lumaStdDev = Math.sqrt(Math.max(0, lumaSqSum / pixelCount - meanLuma * meanLuma));

  if (lumaStdDev < 10) {
    return { passed: false, invalidReason: "low_information_scene", flags: [`flat_image(stddev=${lumaStdDev.toFixed(1)})`] };
  }
  if (meanSaturation < 0.06) {
    return { passed: false, invalidReason: "monochrome_or_black_and_white", flags: [`low_saturation(${meanSaturation.toFixed(3)})`] };
  }
  return { passed: true, flags: [] };
}

// ── LLM judge ─────────────────────────────────────────────────────────────────

const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: [
    "likeness", "sceneMatch", "styleMatch", "containsText", "severeAnatomyIssue",
    "isSingleScene", "isFullScene", "primaryIssue", "notes",
  ],
  required: [
    "likeness", "sceneMatch", "styleMatch", "containsText", "severeAnatomyIssue",
    "isSingleScene", "isFullScene", "primaryIssue", "notes",
  ],
  properties: {
    likeness: { type: Type.INTEGER, description: "1-5: does the illustrated child read as the same person as the reference photo (face shape, hair, skin tone, age)?" },
    sceneMatch: { type: Type.INTEGER, description: "1-5: does the image depict the described scene?" },
    styleMatch: { type: Type.INTEGER, description: "1-5: polished children's picture-book illustration in the requested style?" },
    containsText: { type: Type.BOOLEAN, description: "Any visible letters, words, captions, or signage." },
    severeAnatomyIssue: { type: Type.BOOLEAN, description: "Extra/missing limbs or fingers, distorted face, merged bodies — obvious to a parent." },
    isSingleScene: { type: Type.BOOLEAN, description: "One coherent scene, not a collage, grid, or character sheet." },
    isFullScene: { type: Type.BOOLEAN, description: "A full environmental scene, not an isolated face/avatar on a plain background." },
    primaryIssue: {
      type: Type.STRING,
      enum: [
        "none", "inconsistent_character", "text_artifact", "collage_or_character_sheet",
        "isolated_face_or_avatar", "low_information_scene", "line_art_or_sketch",
        "monochrome_or_black_and_white", "anatomy",
      ],
    },
    notes: { type: Type.STRING, description: "One or two sentences: the most important fix, phrased as an instruction for the illustrator." },
  },
};

interface JudgeVerdict {
  likeness: number;
  sceneMatch: number;
  styleMatch: number;
  containsText: boolean;
  severeAnatomyIssue: boolean;
  isSingleScene: boolean;
  isFullScene: boolean;
  primaryIssue: string;
  notes: string;
}

function buildJudgePrompt(input: ImageEvaluationInput): string {
  const style = getIllustrationStyleOption(input.illustrationStyle);
  const names = input.characterNames.join(", ") || "the main character";
  const subject = input.kind === "cover"
    ? `the COVER of a children's picture book${input.sceneText ? ` titled "${input.sceneText}"` : ""}`
    : `a PAGE of a children's picture book. The page text is: "${input.sceneText}"`;

  return `You are a strict quality reviewer for a personalized children's picture-book service.
The first ${input.referencePhotos.length} image(s) are reference photos of the real child(ren): ${names}.
The LAST image is the generated illustration for ${subject}
Requested illustration style: ${style.label}.

Score the LAST image only. Likeness means a parent would recognize their child (stylization is expected; judge face shape, hair type/color/length, skin tone, apparent age). Be honest — do not inflate scores. If there is no reference photo, score likeness 3.
Set primaryIssue to the single most important problem, or "none".`;
}

function verdictToEvaluation(verdict: JudgeVerdict, judgeModel: string): ImageEvaluation {
  const scores = {
    likeness: verdict.likeness,
    sceneMatch: verdict.sceneMatch,
    styleMatch: verdict.styleMatch,
  };
  const flags: string[] = [];
  if (verdict.containsText) flags.push("contains_text");
  if (verdict.severeAnatomyIssue) flags.push("severe_anatomy_issue");
  if (!verdict.isSingleScene) flags.push("not_single_scene");
  if (!verdict.isFullScene) flags.push("not_full_scene");
  if (scores.likeness < MIN_LIKENESS) flags.push(`low_likeness(${scores.likeness})`);
  if (scores.sceneMatch < MIN_SCENE_MATCH) flags.push(`low_scene_match(${scores.sceneMatch})`);
  if (scores.styleMatch < MIN_STYLE_MATCH) flags.push(`low_style_match(${scores.styleMatch})`);

  const passed = flags.length === 0;
  let invalidReason: InvalidImageReason | undefined;
  if (!passed) {
    if (verdict.containsText) invalidReason = "text_artifact";
    else if (!verdict.isSingleScene) invalidReason = "collage_or_character_sheet";
    else if (!verdict.isFullScene) invalidReason = "isolated_face_or_avatar";
    else if (scores.likeness < MIN_LIKENESS) invalidReason = "inconsistent_character";
    else if (verdict.primaryIssue !== "none" && verdict.primaryIssue !== "anatomy") {
      invalidReason = verdict.primaryIssue as InvalidImageReason;
    }
  }

  return { passed, invalidReason, scores, flags, notes: verdict.notes, judgeModel };
}

/**
 * Asks a multimodal model to grade the image. Fails open: if the judge itself
 * errors, the image passes with a `judge_unavailable` flag so a judge outage
 * never blocks story generation.
 */
export async function judgeImage(image: InlineImage, input: ImageEvaluationInput): Promise<ImageEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY;
  const judgeModel = getJudgeModel();
  if (!apiKey) return { passed: true, flags: ["judge_unavailable"], notes: "GEMINI_API_KEY not configured" };

  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: judgeModel,
      contents: [{
        role: "user",
        parts: [
          ...input.referencePhotos.map((photo) => ({ inlineData: photo })),
          { inlineData: image },
          { text: buildJudgePrompt(input) },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: JUDGE_SCHEMA,
        temperature: 0,
        abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
      },
    });
    const text = response.text;
    if (!text) throw new Error("Judge returned no text");
    return verdictToEvaluation(JSON.parse(text) as JudgeVerdict, judgeModel);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[judge] model=${judgeModel} failed: ${message}`);
    return { passed: true, flags: ["judge_unavailable"], notes: message, judgeModel };
  }
}

/** Pixel checks first (free); the judge runs only if they pass and the gate is on. */
export async function evaluateImage(
  image: InlineImage,
  input: ImageEvaluationInput,
  options?: { useJudge?: boolean }
): Promise<ImageEvaluation> {
  const pixels = await checkImagePixels(image);
  if (!pixels.passed) return pixels;
  if (!(options?.useJudge ?? isQualityGateEnabled())) return pixels;
  return judgeImage(image, input);
}

/** Single number for ranking attempts: mean judge score, failures penalized. */
export function evaluationRank(evaluation: ImageEvaluation): number {
  const s = evaluation.scores;
  const mean = s ? (s.likeness + s.sceneMatch + s.styleMatch) / 3 : 3;
  return (evaluation.passed ? 10 : 0) + mean;
}

// ── Cross-page consistency (offline evals) ───────────────────────────────────

const CONSISTENCY_SCHEMA = {
  type: Type.OBJECT,
  propertyOrdering: ["consistency", "styleConsistency", "notes"],
  required: ["consistency", "styleConsistency", "notes"],
  properties: {
    consistency: { type: Type.INTEGER, description: "1-5: is the main character recognizably the same child on every page?" },
    styleConsistency: { type: Type.INTEGER, description: "1-5: do all pages look like one book (same style, palette, rendering)?" },
    notes: { type: Type.STRING },
  },
};

export async function judgeBookConsistency(
  pages: InlineImage[],
  referencePhotos: InlineImage[]
): Promise<{ consistency: number; styleConsistency: number; notes: string } | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: "GEMINI_API_KEY not configured" };
  try {
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
      model: getJudgeModel(),
      contents: [{
        role: "user",
        parts: [
          ...referencePhotos.map((photo) => ({ inlineData: photo })),
          ...pages.map((page) => ({ inlineData: page })),
          { text: `The first ${referencePhotos.length} image(s) are reference photos of a real child. The remaining ${pages.length} images are consecutive illustrated pages from one personalized picture book about that child. Grade cross-page consistency honestly.` },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: CONSISTENCY_SCHEMA,
        temperature: 0,
        abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
      },
    });
    return JSON.parse(response.text ?? "{}");
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
