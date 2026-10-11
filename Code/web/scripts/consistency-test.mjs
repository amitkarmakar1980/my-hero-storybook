#!/usr/bin/env node
/**
 * Character-consistency A/B harness.
 *
 * A (baseline, today's Gemini path): every page conditions on the photo only.
 * B (anchor chaining):               every page conditions on the photo AND the
 *                                    first generated illustration.
 *
 * Reads GEMINI_API_KEY from .env.local — never pass it on the command line.
 *
 *   node scripts/consistency-test.mjs [model]
 */
import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Load .env.local without adding a dotenv dependency ────────────────────────
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in .env.local");
  process.exit(1);
}

const MODEL = process.argv[2] ?? "gemini-3.1-flash-image";
const OUT = resolve(ROOT, "scripts/out", MODEL);
mkdirSync(OUT, { recursive: true });

const client = new GoogleGenAI({ apiKey });

const STYLE =
  "Children's picture-book illustration. Full-color painted artwork, warm soft " +
  "lighting, gentle rounded shapes. No text, no words, no letters anywhere.";

// Page 1 establishes the STORY costume — the anchor propagates whatever it shows,
// so the photo's own clothes must be overridden here or they persist all book.
const COSTUME = "wearing a blue astronaut flight suit with orange shoulder patches";

const SCENES = [
  "standing at the open hatch of a silver rocket, looking out at a purple nebula",
  "floating weightless in the rocket cabin, laughing, chasing a drifting red ball",
  "planting a small flag on an orange moon, three tiny alien creatures watching",
];

const usage = [];

async function gen(parts, label) {
  const t0 = Date.now();
  const res = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["TEXT", "IMAGE"] },
  });
  const ms = Date.now() - t0;

  const img = res?.candidates?.[0]?.content?.parts?.find(
    (p) => !p.thought && p.inlineData?.data
  )?.inlineData;
  if (!img) throw new Error(`${label}: no image returned`);

  const u = res?.usageMetadata ?? {};
  const outTok = (u.totalTokenCount ?? 0) - (u.promptTokenCount ?? 0);
  usage.push({ label, ms, inTok: u.promptTokenCount ?? 0, outTok });
  console.log(
    `  ${label.padEnd(18)} ${String(ms).padStart(6)}ms  in=${String(u.promptTokenCount ?? 0).padStart(4)} out=${String(outTok).padStart(4)}`
  );

  writeFileSync(resolve(OUT, `${label}.png`), Buffer.from(img.data, "base64"));
  return img;
}

const txt = (text) => ({ text });
const ref = (img) => ({
  inlineData: { mimeType: img.mimeType ?? "image/png", data: img.data },
});

console.log(`\nmodel: ${MODEL}\n\n[0] synthesizing stand-in reference photo`);
const photo = await gen(
  [
    txt(
      "A plain, realistic photograph of a 7-year-old child standing against a " +
        "neutral grey wall, facing the camera, natural daylight, neutral " +
        "expression. Olive skin, round face, thick curly dark-brown hair, " +
        "brown eyes, wearing a plain yellow t-shirt. Photographic, not illustrated."
    ),
  ],
  "00-reference-photo"
);

const identity = txt(
  "Reference photo for Maya. Treat this image as the canonical identity " +
    "reference. Preserve the same face, hairline, hair density, hairstyle, " +
    "skin tone, and age appearance in the generated illustration. Do NOT copy " +
    "the clothing from this photo — use the costume described in the scene."
);

console.log("\n[A] baseline — photo reference only");
for (let i = 0; i < SCENES.length; i++) {
  await gen(
    [identity, ref(photo), txt(`${STYLE}\n\nScene: Maya, ${COSTUME}, ${SCENES[i]}`)],
    `A-page${i + 1}`
  );
}

console.log("\n[B] anchor chaining — photo + page-1 illustration");
const anchor = await gen(
  [identity, ref(photo), txt(`${STYLE}\n\nScene: Maya, ${COSTUME}, ${SCENES[0]}`)],
  "B-page1-anchor"
);
for (let i = 1; i < SCENES.length; i++) {
  await gen(
    [
      identity,
      ref(photo),
      txt(
        "Established illustrated appearance for Maya, from page 1 of this same " +
          "book. Match this painted rendering exactly — same facial features, " +
          "same hair shape and colour, same costume, same art style. This is the " +
          "canonical look for every remaining page."
      ),
      ref(anchor),
      txt(`${STYLE}\n\nScene: Maya ${SCENES[i]}`),
    ],
    `B-page${i + 1}`
  );
}

const sum = (f) => usage.reduce((a, u) => a + f(u), 0);
console.log(
  `\n── measured ──\ncalls=${usage.length}  in=${sum((u) => u.inTok)}  ` +
    `out=${sum((u) => u.outTok)}  wall=${(sum((u) => u.ms) / 1000).toFixed(1)}s  ` +
    `mean=${(sum((u) => u.ms) / usage.length / 1000).toFixed(1)}s/image`
);
console.log(`images: ${OUT}`);
