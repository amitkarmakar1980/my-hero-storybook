#!/usr/bin/env node
/**
 * Judge calibration: feeds the judge deliberately wrong pairings and checks it
 * rejects them. Run after changing the judge prompt, model, or thresholds.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/eval/calibrate-judge.mts <eval-output-dir> [other-child.jpg]
 *
 * Uses images from a previous eval-images run of the default cases. Optional
 * [other-child.jpg]: an illustration of a clearly different child, to check the
 * judge rejects poor likeness (keep it local; don't commit real users' images).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { evaluateImage } = await import(pathToFileURL(resolve(ROOT, "src/lib/imageQuality.ts")).href);
const sharp = (await import("sharp")).default;

const dir = process.argv[2];
if (!dir) {
  console.error("usage: calibrate-judge.mts <eval-output-dir>");
  process.exit(1);
}
const file = (suffix: string) => {
  const name = readdirSync(dir).find((f) => f.endsWith(suffix));
  if (!name) throw new Error(`missing *${suffix} in ${dir}`);
  return { mimeType: "image/jpeg", data: readFileSync(resolve(dir, name)).toString("base64") };
};

const maya = { mimeType: "image/png", data: readFileSync(resolve(ROOT, "scripts/eval/fixtures/maya-standin.png")).toString("base64") };
const forestPage1 = file("__forest-fireflies__page-1.jpg");
const grayscale = {
  mimeType: "image/jpeg",
  data: (await sharp(Buffer.from(forestPage1.data, "base64")).grayscale().jpeg().toBuffer()).toString("base64"),
};
const textPoster = {
  mimeType: "image/png",
  data: (await sharp({
    create: { width: 768, height: 1024, channels: 3, background: { r: 240, g: 200, b: 120 } },
  }).composite([{
    input: Buffer.from(`<svg width="768" height="1024"><rect x="60" y="300" width="648" height="420" fill="#2a6f97"/><text x="384" y="540" font-size="72" text-anchor="middle" fill="white" font-family="sans-serif">THE END</text></svg>`),
  }]).png().toBuffer()).toString("base64"),
};

const pageInput = (sceneText: string) => ({
  kind: "page" as const,
  sceneText,
  characterNames: ["Maya"],
  illustrationStyle: "classic-storybook",
  referencePhotos: [maya],
});

const otherChildPath = process.argv[3];

const probes = [
  { name: "control: correct page", image: forestPage1, input: pageInput("Maya followed the glowing fireflies into the whispering forest, her red boots splashing through puddles that sparkled like stars."), expectPass: true },
  { name: "wrong scene text", image: forestPage1, input: pageInput("Maya bounced in giant slow-motion hops on the moon while an alien family set out a picnic blanket."), expectPass: false },
  { name: "grayscale image", image: grayscale, input: pageInput("Maya followed the glowing fireflies into the whispering forest."), expectPass: false },
  { name: "text poster, no child", image: textPoster, input: pageInput("Maya followed the glowing fireflies into the whispering forest."), expectPass: false },
  ...(otherChildPath
    ? [{
        name: "different child",
        image: { mimeType: "image/jpeg", data: readFileSync(otherChildPath).toString("base64") },
        input: pageInput("A girl presses smooth river stones into hollows in an old stone archway."),
        expectPass: false,
      }]
    : []),
];

let correct = 0;
for (const probe of probes) {
  const verdict = await evaluateImage(probe.image, probe.input, { useJudge: true });
  const ok = verdict.passed === probe.expectPass;
  if (ok) correct++;
  console.log(
    `${ok ? "✓" : "✗"} ${probe.name.padEnd(24)} expected ${probe.expectPass ? "pass" : "fail"}, got ${verdict.passed ? "pass" : "fail"}` +
      (verdict.scores ? ` ${JSON.stringify(verdict.scores)}` : "") +
      (verdict.flags.length ? ` [${verdict.flags.join(", ")}]` : "")
  );
}
console.log(`\n${correct}/${probes.length} probes behaved as expected`);
process.exit(correct === probes.length ? 0 : 1);
