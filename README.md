# Hero Storybook

Turn a child into the hero of their own AI-illustrated picture book. Upload a photo, pick a theme, and get a fully illustrated story — written by Gemini, painted by Nano Banana — with the child as the star on every page.

🌐 **Live:** [my-hero-storybook.vercel.app](https://my-hero-storybook.vercel.app)

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Image pipeline](#image-pipeline)
- [Quality gate and evals](#quality-gate-and-evals)
- [Reliability](#reliability)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [API routes](#api-routes)
- [Data model](#data-model)
- [Admin panel](#admin-panel)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)

---

## Features

- **Personalized stories** — a 6-page story (admins can choose 1–20) starring the child by name and personality, in three lengths: short, standard, long
- **Photo-based characters** — Gemini analyzes each uploaded photo into a structured character profile; the photo itself is also sent with every illustration as an identity reference
- **Multi-character stories** — siblings, friends, or family, each with their own photo
- **15 themes** — Space Explorer to Candy Kingdom (3 free, 12 premium; premium needs sign-in)
- **7 illustration styles** — classic storybook, watercolor, cartoon, gouache, colored pencil, paper cut, soft digital painting
- **Quality-gated illustrations** — every image is checked by an AI judge and regenerated once if it fails ([details](#quality-gate-and-evals))
- **Self-healing stories** — any missing image is filled in server-side when the story is opened ([details](#reliability))
- **Immersive reader** — dark, cinematic scroll view plus a paginated Reading Mode (keyboard and swipe)
- **Library and PDF** — saved stories and photos on the profile page; export any story as a PDF
- **Admin panel** — usage and cost analytics, image-model switching, story regeneration

---

## How it works

```
Create form (names, theme, length, style, photos)
        │
        ▼
POST /api/generate-storybook
  1. Gemini Vision → CharacterProfile per photo (schema-constrained JSON)
  2. Gemini → story draft → refinement pass (exact page count enforced by schema)
  3. Returns story + imageGenerationContext (profiles, shared style prompt, photos)
        │
        ▼
Create screen generates cover (16:9) and page 1 (3:4)   ← POST /api/generate-story-images
        │
        ▼
POST /api/stories — uploads images, saves story + generation context
        │
        ▼
/story/[id] — finds every image still missing and fills them one by one
              via POST /api/stories/[id]/images ("Painting…" placeholders)
```

Guests follow the same flow on `/story-preview`; their story isn't saved.

---

## Image pipeline

All image generation goes through [`src/lib/imageGeneration.ts`](Code/web/src/lib/imageGeneration.ts), shared by every route.

**Models** (Gemini API, selectable in the admin panel; list in [`src/lib/imageModels.ts`](Code/web/src/lib/imageModels.ts)):

| Model | ID | Per image (1K) | Per story (7 images) |
|---|---|---|---|
| **Nano Banana 2.1** (default) | `gemini-nano-banana-2.1` | $0.034 | ~$0.24 |
| Nano Banana 2 | `gemini-3.1-flash-image` | $0.067 | ~$0.47 |
| Nano Banana Pro | `gemini-3-pro-image` | $0.134 | ~$0.94 |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | $0.034 | ~$0.24 |

Imagen 4 was shut down in the Gemini API on 2026-08-17. A saved model setting or `GEMINI_IMAGE_MODEL` value that isn't in the list is ignored (with a warning) in favor of the default.

**Each request** sends the character reference photos, the shared style + character prompt, and the scene, with `responseModalities: ["IMAGE"]` and `imageConfig.aspectRatio` set to `3:4` (pages) or `16:9` (cover). Output is normalized with sharp to 1024×1365 or 1600×900 JPEG.

**Retries** — up to 3 attempts per image. Rate limits (429), server errors, timeouts (120 s, enforced via `abortSignal`), and empty/blocked responses are retried with backoff; permanent errors (bad key, unknown model) fail fast. Every failure is logged as `[image] model=… page=… attempt=… kind=…`.

---

## Quality gate and evals

### Inline gate

Every generated image passes through [`src/lib/imageQuality.ts`](Code/web/src/lib/imageQuality.ts):

1. **Pixel checks** (free) — rejects flat/blank frames and black-and-white output.
2. **LLM judge** (`gemini-3.5-flash-lite`, ~$0.0015/check) — sees the reference photo(s) and the image, and returns schema-constrained scores:
   - `likeness`, `sceneMatch`, `styleMatch` on 1–5 (pass threshold: 3 each)
   - flags for visible text, severe anatomy errors, collages, and isolated-face avatars
3. **One regeneration** on failure, with the judge's feedback added to the prompt. If both attempts fail, the better-scoring image is kept rather than showing a placeholder.

Verdicts are logged as `[quality] …` and stored with each page in `pageImagesJson[n].quality`. The judge **fails open**: if it errors, the image passes with a `judge_unavailable` flag, so a judge outage never blocks a story. Set `IMAGE_QUALITY_GATE=off` to skip the judge (pixel checks still run).

### Offline evals

```bash
cd Code/web
npm run eval:images                                   # dry run: plan + estimated cost
npm run eval:images -- --yes                          # run with the current model
npm run eval:images -- --models gemini-nano-banana-2.1,gemini-3-pro-image --yes
npm run eval:images -- --gate --yes                   # measure the full gated pipeline
```

Runs the fixed cases in [`scripts/eval/cases.json`](Code/web/scripts/eval/cases.json) through the production prompts and generation code. It grades every image, grades cross-page character and style consistency per book, and writes `results.json` plus an HTML report with every image to `scripts/out/eval/<timestamp>/`.

### Judge calibration

```bash
npx tsx --tsconfig tsconfig.json scripts/eval/calibrate-judge.mts scripts/out/eval/<timestamp> [other-child.jpg]
```

Checks the judge rejects known-bad inputs: wrong scene text, a grayscale image, a text poster, and, given an illustration of a different child, poor likeness. Run it after changing the judge prompt, model, or thresholds. Eval fixtures must be stand-in or consented photos — never real customers' photos.

---

## Reliability

A story never silently loses images:

- **Generation context is persisted.** `storyJson.imageGenerationContext` stores the character profiles, shared style prompt, and illustration style (photos stay in storage). Older stories without it get one rebuilt from their stored photos on first use.
- **Server-side fill.** `POST /api/stories/[id]/images` generates and persists one image (`"cover"` or a page number). It's idempotent: if the image already exists it's returned unless `force` is set.
- **Self-healing view.** When the owner opens a story, the page requests every missing image in turn. Failures show a **Try again** control, and a **Paint missing (n)** button retries everything at once. Admins viewing someone else's story see the controls without auto-generation.
- **Atomic writes.** Page images are written with a single `jsonb_set` update, so concurrent fills can't overwrite each other.
- **Storage retries.** Supabase uploads retry 3× with backoff, and every failure is logged.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router, Turbopack), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Auth.js / NextAuth v5 (Google OAuth, Prisma adapter) |
| Database | Supabase PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| Storage | Supabase Storage (`story-images`, `child-photos`) |
| Story text | Gemini 3.8 Flash (REST, JSON schema output) |
| Illustrations | Nano Banana family via `@google/genai` |
| Quality judge | Gemini 3.5 Flash-Lite |
| Image processing | sharp |
| PDF | jsPDF |
| Hosting | Vercel |

---

## Project structure

```
Code/web/
├── prisma/                         # schema + migrations (Prisma 7; URLs in prisma.config.ts)
├── scripts/
│   ├── eval-images.mts             # offline image eval → HTML report
│   ├── eval/cases.json             # eval fixtures
│   ├── eval/fixtures/              # stand-in reference photos
│   ├── eval/calibrate-judge.mts    # judge sanity checks
│   └── consistency-test.mjs        # A/B: photo-only vs. page-1 anchor chaining
└── src/
    ├── app/
    │   ├── create/                 # form + kicks off generation
    │   ├── story-preview/          # guest flow
    │   ├── story/[id]/             # saved story view (self-healing image fill)
    │   ├── profile/                # library + photos
    │   ├── admin/                  # dashboard, model picker, user views
    │   └── api/                    # see API routes
    ├── components/                 # Header, ReadingMode, ThemesSection
    └── lib/
        ├── imageGeneration.ts      # model calls, retries, normalization, gate loop
        ├── imageQuality.ts         # pixel checks, LLM judge, consistency judge
        ├── imageModels.ts          # model catalog + prices (client-safe)
        ├── storyImages.ts          # context resolution, generate + persist one image
        ├── config.ts               # active model resolution, admin emails, text model
        ├── prompts.ts              # all story and image prompts
        ├── supabase-server.ts      # storage helpers (with upload retries)
        └── auth.ts / auth.config.ts / prisma.ts / illustrationStyles.ts / storyThemes.ts
```

---

## API routes

| Route | Purpose |
|---|---|
| `POST /api/generate-storybook` | Character profiles → story draft → refinement; returns story, image prompts, and `imageGenerationContext` |
| `POST /api/generate-story-images` | Generate cover (`{ imageGenerationContext, coverImagePrompt }`) or pages (`{ imageGenerationContext, story, imagePrompts }`), quality-gated |
| `GET / POST /api/stories` | List the user's stories / save a story (uploads images, persists generation context, returns `missingImages`) |
| `GET / PATCH / DELETE /api/stories/[id]` | Read, add an image, delete (with storage cleanup) |
| `GET / POST /api/stories/[id]/images` | List missing image targets / generate and persist one (`{ target: "cover" \| n, force? }`) |
| `GET / POST /api/profile/photos`, `DELETE /api/profile/photos/[id]` | Saved child photos |
| `GET / PUT /api/admin/config` | Read / set the active image model |
| `GET /api/admin/stats` | Dashboard metrics and costs |
| `POST /api/admin/stories/[id]/regenerate` | Re-derive profiles from stored photos and regenerate every image (failed images keep their previous version) |

Image routes set `maxDuration = 300`.

---

## Data model

```prisma
model Story {
  id             String   @id @default(cuid())
  userId         String
  title          String
  coverText      String
  theme          String
  childName      String
  coverImageUrl  String?
  storyJson      Json     // StoredStoryData: pages, characters, photos, illustrationStyle, imageGenerationContext
  pageImagesJson Json     // { [pageNumber]: { imageUrl, quality?: { passed, scores, flags } } }
  childPhotoUrl  String?
  createdAt      DateTime @default(now())
}

model UploadedPhoto { id, userId, url, filename, fileSize, createdAt }
model AppConfig     { key @id, value, updatedAt }   // e.g. imageModel
// Auth.js: User, Account, Session, VerificationToken
```

---

## Admin panel

`/admin`, restricted to the emails in `ADMIN_EMAILS` (`src/lib/config.ts`):

- **Stats** — stories today, this week, this month, and in total, with estimated cost; a 30-day activity chart; per-user usage table with drill-down
- **Image model picker** — stored in `AppConfig`; takes effect on the next image, no redeploy
- **Story regeneration** — from any story page; keeps the same story ID and URL
- **Admin-only create options** — illustration style and page count

---

## Getting started

**Prerequisites:** Node.js 20+, a Gemini API key ([AI Studio](https://aistudio.google.com)), Google OAuth web credentials, and a Supabase project.

```bash
cd Code/web
npm install                 # also runs prisma generate
cp .env.example .env.local  # fill in values (see below)
npx prisma migrate deploy   # create tables (uses DIRECT_URL)
npm run dev                 # http://localhost:3000
```

**Google OAuth:** add `http://localhost:3000/api/auth/callback/google` (and your production URL) as authorized redirect URIs. In Testing mode, add your account as a test user.

**Supabase free tier:** projects pause after about a week of inactivity. Sign-in then fails with `tenant/user … not found`. Restore the project from the dashboard; it takes a few minutes to accept connections.

---

## Environment variables

```env
# Gemini
GEMINI_API_KEY=...
# GEMINI_TEXT_MODEL=gemini-3.8-flash          # optional override
# GEMINI_IMAGE_MODEL=gemini-nano-banana-2.1   # optional fallback; admin setting wins
# IMAGE_JUDGE_MODEL=gemini-3.5-flash-lite     # optional
# IMAGE_QUALITY_GATE=off                      # optional: disable the LLM judge

# Auth
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://...:6543/postgres?pgbouncer=true   # runtime (pooled)
DIRECT_URL=postgresql://...:5432/postgres                    # migrations

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Deployment

Vercel's Git integration deploys every push to `master` to production. Set the environment variables above in the Vercel project settings (`DIRECT_URL` is only needed for migrations).

- Image routes use `maxDuration = 300`. A full admin regeneration with several retries can approach that limit; images are saved as they complete, so a timeout only leaves some images on their previous version.
- The active image model lives in the database, not the deployment, so changing it never requires a redeploy.
