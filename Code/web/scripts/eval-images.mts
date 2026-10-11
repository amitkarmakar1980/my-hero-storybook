#!/usr/bin/env node
/**
 * Offline image eval: runs fixed cases (scripts/eval/cases.json) through the
 * production prompt + generation code, grades every image with the LLM judge,
 * grades cross-page consistency, and writes an HTML report.
 *
 *   npm run eval:images -- [--models a,b] [--cases id1,id2] [--gate] [--no-cover] [--yes]
 *
 *   --models   image model IDs (default: current GEMINI_IMAGE_MODEL / default model)
 *   --cases    case IDs to run (default: all)
 *   --gate     run with the inline quality gate (measures the full production
 *              pipeline incl. regenerations); default measures raw model output
 *   --no-cover skip cover images
 *   --yes      actually run (without it, prints the plan and estimated cost)
 *
 * Reads GEMINI_API_KEY from .env.local. Output: scripts/out/eval/<timestamp>/
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(resolve(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const load = (rel: string) => import(pathToFileURL(resolve(ROOT, rel)).href);
const { generateValidatedImage } = await load("src/lib/imageGeneration.ts");
const { evaluateImage, judgeBookConsistency, getJudgeModel } = await load("src/lib/imageQuality.ts");
const { buildSharedImageGenerationContext, buildFinalImagePromptFromContext, buildCoverImagePromptFromContext } =
  await load("src/lib/prompts.ts");
const { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } = await load("src/lib/imageModels.ts");

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

interface EvalCase {
  id: string;
  referencePhoto: string;
  illustrationStyle: string;
  title: string;
  character: Record<string, unknown> & { characterName: string };
  pages: string[];
}

const allCases: EvalCase[] = JSON.parse(readFileSync(resolve(ROOT, "scripts/eval/cases.json"), "utf8")).cases;
const caseFilter = option("cases")?.split(",");
const cases = caseFilter ? allCases.filter((c) => caseFilter.includes(c.id)) : allCases;
const models: string[] = option("models")?.split(",") ?? [process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL];
const useGate = flag("gate");
const includeCover = !flag("no-cover");

const imagesPerModel = cases.reduce((n, c) => n + c.pages.length + (includeCover ? 1 : 0), 0);
const JUDGE_COST = 0.0015; // per judge call, approx.
const costPerImage = (model: string) =>
  (IMAGE_MODELS as Array<{ id: string; costPerImage: number }>).find((m) => m.id === model)?.costPerImage ?? 0.07;
const estimate = models.reduce(
  (sum, m) => sum + imagesPerModel * (costPerImage(m) * (useGate ? 1.3 : 1) + JUDGE_COST * (useGate ? 2.3 : 1)) + cases.length * JUDGE_COST,
  0
);

console.log(`cases:  ${cases.map((c) => c.id).join(", ")}`);
console.log(`models: ${models.join(", ")}`);
console.log(`judge:  ${getJudgeModel()}   gate: ${useGate ? "on" : "off (raw model output)"}   cover: ${includeCover}`);
console.log(`images: ${imagesPerModel * models.length}   est. cost: ~$${estimate.toFixed(2)}`);
if (!flag("yes")) {
  console.log("\nDry run. Re-run with --yes to execute.");
  process.exit(0);
}

// ── Run ──────────────────────────────────────────────────────────────────────

interface ImageResult {
  model: string;
  caseId: string;
  target: string;
  sceneText: string;
  file?: string;
  error?: string;
  latencyMs: number;
  attempts?: number;
  passed?: boolean;
  scores?: { likeness: number; sceneMatch: number; styleMatch: number };
  flags?: string[];
  notes?: string;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = resolve(ROOT, "scripts/out/eval", stamp);
mkdirSync(OUT, { recursive: true });

const results: ImageResult[] = [];
const consistency: Array<{ model: string; caseId: string; consistency?: number; styleConsistency?: number; notes?: string; error?: string }> = [];

for (const model of models) {
  for (const evalCase of cases) {
    const photoPath = resolve(ROOT, evalCase.referencePhoto);
    const photo = {
      mimeType: photoPath.endsWith(".png") ? "image/png" : "image/jpeg",
      data: readFileSync(photoPath).toString("base64"),
    };
    const profile = evalCase.character;
    const name = profile.characterName;
    const characterPhotos = [{ characterName: name, uploadedImageBase64: photo.data, uploadedImageMimeType: photo.mimeType }];
    const sharedContext = buildSharedImageGenerationContext([profile], evalCase.illustrationStyle);

    const targets = [
      ...(includeCover ? [{ target: "cover", sceneText: evalCase.title }] : []),
      ...evalCase.pages.map((text, i) => ({ target: `page-${i + 1}`, sceneText: text })),
    ];
    const pageImages: Array<{ mimeType: string; data: string }> = [];

    for (const { target, sceneText } of targets) {
      const isCover = target === "cover";
      const pageNumber = isCover ? 0 : Number(target.split("-")[1]);
      const prompt = isCover
        ? buildCoverImagePromptFromContext(sharedContext, evalCase.title, [name], evalCase.illustrationStyle)
        : buildFinalImagePromptFromContext(sharedContext, { pageNumber, text: sceneText }, {
            reinforceConsistency: pageNumber > 1,
            illustrationStyle: evalCase.illustrationStyle,
          });
      const evaluation = {
        kind: isCover ? "cover" : "page",
        sceneText,
        characterNames: [name],
        illustrationStyle: evalCase.illustrationStyle,
      };

      process.stdout.write(`[${model}] ${evalCase.id} ${target} … `);
      const started = Date.now();
      const image = await generateValidatedImage(model, pageNumber, prompt, {
        aspectRatio: isCover ? "16:9" : "3:4",
        characterProfiles: [profile],
        characterPhotos,
        ...(useGate ? { evaluation } : {}),
      });
      const latencyMs = Date.now() - started;

      if (image.isPlaceholder || !image.imageUrl) {
        console.log(`FAILED (${image.error})`);
        results.push({ model, caseId: evalCase.id, target, sceneText, error: image.error, latencyMs, attempts: image.attempts });
        continue;
      }

      const [, data] = image.imageUrl.split(",");
      const inline = { mimeType: "image/jpeg", data };
      const file = `${model}__${evalCase.id}__${target}.jpg`;
      writeFileSync(resolve(OUT, file), Buffer.from(data, "base64"));

      // Gate runs already carry the judge verdict; raw runs are judged here.
      const verdict = image.evaluation ?? await evaluateImage(inline, { ...evaluation, referencePhotos: [photo] }, { useJudge: true });
      if (!isCover) pageImages.push(inline);

      console.log(
        `${verdict.passed ? "pass" : "FAIL"} ${verdict.scores ? JSON.stringify(verdict.scores) : ""} ${(latencyMs / 1000).toFixed(1)}s` +
          (verdict.flags.length ? ` [${verdict.flags.join(", ")}]` : "")
      );
      results.push({
        model, caseId: evalCase.id, target, sceneText, file, latencyMs,
        attempts: image.attempts, passed: verdict.passed, scores: verdict.scores, flags: verdict.flags, notes: verdict.notes,
      });
    }

    if (pageImages.length > 1) {
      const c = await judgeBookConsistency(pageImages, [photo]);
      consistency.push({ model, caseId: evalCase.id, ...c });
      console.log(`[${model}] ${evalCase.id} consistency: ${"error" in c ? c.error : `${c.consistency}/5 character, ${c.styleConsistency}/5 style`}`);
    }
  }
}

// ── Summary + report ────────────────────────────────────────────────────────

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fmt = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");

const summary = models.map((model) => {
  const rs = results.filter((r) => r.model === model);
  const ok = rs.filter((r) => !r.error);
  const cs = consistency.filter((c) => c.model === model && c.consistency !== undefined);
  return {
    model,
    images: rs.length,
    generated: ok.length,
    successRate: ok.length / Math.max(1, rs.length),
    passRate: ok.filter((r) => r.passed).length / Math.max(1, rs.length),
    likeness: mean(ok.map((r) => r.scores?.likeness ?? NaN).filter(Number.isFinite)),
    sceneMatch: mean(ok.map((r) => r.scores?.sceneMatch ?? NaN).filter(Number.isFinite)),
    styleMatch: mean(ok.map((r) => r.scores?.styleMatch ?? NaN).filter(Number.isFinite)),
    consistency: mean(cs.map((c) => c.consistency!)),
    styleConsistency: mean(cs.map((c) => c.styleConsistency!)),
    meanLatencyS: mean(ok.map((r) => r.latencyMs)) / 1000,
    estCost: rs.reduce((sum, r) => sum + (r.attempts ?? 1) * costPerImage(model), 0),
  };
});

writeFileSync(
  resolve(OUT, "results.json"),
  JSON.stringify({ stamp, judgeModel: getJudgeModel(), gate: useGate, summary, consistency, results }, null, 2)
);

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Image Eval ${stamp}</title>
<style>
  :root { --bg:#faf7f2; --fg:#1d1a16; --muted:#6b6258; --card:#fff; --line:#e6dfd4; --pass:#1f7a4d; --fail:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --bg:#14110e; --fg:#f1ebe2; --muted:#a39888; --card:#1e1a16; --line:#332c25; --pass:#5fd39a; --fail:#ff8a80; } }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--fg); font:14px/1.5 system-ui, sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; } .muted { color:var(--muted); }
  table { border-collapse:collapse; margin:16px 0 28px; width:100%; overflow-x:auto; display:block; }
  th, td { border-bottom:1px solid var(--line); padding:6px 10px; text-align:left; white-space:nowrap; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .card img { width:100%; display:block; } .card div { padding:8px 10px; font-size:12px; }
  .pass { color:var(--pass); font-weight:600; } .fail { color:var(--fail); font-weight:600; }
</style></head><body>
<h1>Image eval — ${esc(stamp)}</h1>
<p class="muted">Judge: ${esc(getJudgeModel())} · Gate: ${useGate ? "on" : "off (raw output)"} · Cases: ${esc(cases.map((c) => c.id).join(", "))}</p>
<table><tr><th>Model</th><th>Generated</th><th>Pass rate</th><th>Likeness</th><th>Scene</th><th>Style</th><th>Consistency</th><th>Style consistency</th><th>Latency</th><th>Est. cost</th></tr>
${summary.map((s) => `<tr><td>${esc(s.model)}</td><td>${s.generated}/${s.images}</td><td>${fmt(s.passRate * 100, 0)}%</td><td>${fmt(s.likeness)}</td><td>${fmt(s.sceneMatch)}</td><td>${fmt(s.styleMatch)}</td><td>${fmt(s.consistency)}</td><td>${fmt(s.styleConsistency)}</td><td>${fmt(s.meanLatencyS, 1)}s</td><td>$${fmt(s.estCost)}</td></tr>`).join("\n")}
</table>
${models.map((model) => cases.map((c) => `
<h2 style="font-size:16px">${esc(model)} · ${esc(c.id)}</h2>
<p class="muted">${esc(consistency.find((x) => x.model === model && x.caseId === c.id)?.notes ?? "")}</p>
<div class="grid">
${results.filter((r) => r.model === model && r.caseId === c.id).map((r) => `<div class="card">
  ${r.file ? `<img src="${esc(r.file)}" alt="${esc(r.target)}">` : ""}
  <div><b>${esc(r.target)}</b> · ${r.error ? `<span class="fail">ERROR</span> ${esc(r.error)}` : `<span class="${r.passed ? "pass" : "fail"}">${r.passed ? "PASS" : "FAIL"}</span>`}
  ${r.scores ? `<br>likeness ${r.scores.likeness} · scene ${r.scores.sceneMatch} · style ${r.scores.styleMatch}` : ""}
  ${r.flags?.length ? `<br><span class="muted">${esc(r.flags.join(", "))}</span>` : ""}
  ${r.notes ? `<br><span class="muted">${esc(r.notes)}</span>` : ""}
  <br><span class="muted">${fmt(r.latencyMs / 1000, 1)}s · ${r.attempts ?? 1} attempt(s)</span></div>
</div>`).join("\n")}
</div>`).join("\n")).join("\n")}
</body></html>`;
writeFileSync(resolve(OUT, "report.html"), html);

console.log("\nSummary:");
console.table(summary.map((s) => ({
  model: s.model, pass: `${fmt(s.passRate * 100, 0)}%`, likeness: fmt(s.likeness), scene: fmt(s.sceneMatch),
  style: fmt(s.styleMatch), consistency: fmt(s.consistency), latency: `${fmt(s.meanLatencyS, 1)}s`, cost: `$${fmt(s.estCost)}`,
})));
console.log(`report: ${resolve(OUT, "report.html")}`);
