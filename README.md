# Hero Storybook

Turn your child into the hero of their own personalized AI-illustrated storybook. Upload a photo, pick a theme, and get a fully illustrated 6-page story — written and painted by AI — with your child as the star.

🌐 **Live:** [my-hero-storybook.vercel.app](https://my-hero-storybook.vercel.app)

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Story Themes](#story-themes)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [API Routes](#api-routes)
- [Image Generation Pipeline](#image-generation-pipeline)
- [Database Schema](#database-schema)
- [Admin Panel](#admin-panel)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## Features

- **Personalized stories** — AI writes a 6-page storybook starring your child by name and personality
- **Photo-based character** — Upload a child photo; Gemini Vision analyzes it and builds a consistent illustrated character profile used across all 7 images
- **Multi-character stories** — Add siblings, friends, or family members, each with their own photo and age
- **15 story themes** — From Space Explorer to Candy Kingdom (3 free, 12 premium)
- **3 story lengths** — Short (2–4 sentences/page), Standard (4–6), Long (6–8)
- **AI illustrations** — Full-color storybook images via Google Imagen 4
- **Immersive reading experience** — Dark cinematic default view with serif typography and full-bleed images
- **Reading Mode** — Horizontal paginated book spread on desktop (keyboard nav, swipe on mobile)
- **Google Sign-In** — NextAuth v5 with Google OAuth
- **Auto-save** — Story and images saved to your profile immediately after cover + page 1 are ready
- **Progressive generation** — Cover image first, page 1 second, remaining pages async in background
- **Profile library** — All saved stories and uploaded child photos in one place
- **PDF download** — Export any story as a formatted PDF
- **Admin panel** — Cost tracking, per-user analytics, model switching, story regeneration

---

## How It Works

### Generation Flow

```
User fills form (name, theme, length, photo)
        ↓
CreateStoryForm calls /api/generate-storybook
        ↓
Gemini Vision analyzes uploaded photo
→ Extracts CharacterProfile (face shape, skin tone, hair, eyes, build, outfit, visual anchors)
        ↓
Gemini generates 6-page story draft
→ Refines for continuity, age-appropriateness, and length
        ↓
Progress bar shows funny messages while:
  1. Cover image generated (Imagen 4) — 16:9 landscape
  2. Page 1 image generated (Imagen 4) — 3:4 portrait
        ↓
Story saved to database with cover + page 1
        ↓
User navigated to /story/[id] — immersive dark layout
        ↓
Pages 2–6 generate async in background
→ Each page updates DB via PATCH as it completes
→ Spinning "Painting…" placeholders shown until ready
```

### Reading Experience

The default story view is a dark, cinematic vertical-scroll layout:
- Full-bleed 16:9 cover image with title and cover text
- Alternating image-left / image-right spreads per page
- Georgia serif text with paragraph formatting (2 sentences per paragraph)
- Adaptive font size based on story length (short → large type, long → compact)
- Sticky top bar: ← Library | Story Title | Reading Mode button

**Reading Mode** (desktop only) opens a full-screen paginated experience:
- One page at a time, fixed 50/50 image-text split
- Keyboard arrow keys or click arrows to navigate
- Progress dots at bottom
- Film grain texture, dark background (#0e0b08)
- Swipe gesture on mobile (vertical scroll preferred on mobile)

---

## Story Themes

| Theme | Free/Premium | Vibe |
|-------|-------------|------|
| Space Explorer 🚀 | Free | Rockets, nebulae, alien friends |
| Jungle Adventure 🦁 | Free | Wild animals, hidden waterfalls |
| Magic School 🪄 | Free | Spells, potions, friendly dragons |
| Underwater Kingdom 🐠 | Premium | Merfolk, sunken treasure, dolphins |
| Dinosaur World 🦕 | Premium | Triceratops rides, prehistoric valley |
| Fairy Tale Castle 🏰 | Premium | Knights, dragons, royal quests |
| Pirate Seas 🏴‍☠️ | Premium | Galleons, treasure maps, high seas |
| Arctic Quest 🐧 | Premium | Polar bears, northern lights, sleds |
| Superhero City ⚡ | Premium | Superpowers, city-saving, kindness |
| Enchanted Garden 🌸 | Premium | Fairies, talking flowers, hidden magic |
| Robot Workshop 🤖 | Premium | Robots, inventions, STEM adventure |
| Cloud Kingdom ☁️ | Premium | Sky whales, storm sprites, rainbows |
| Dragon Rider 🐉 | Premium | Baby dragons, mountain flights |
| Lost Civilization 🗿 | Premium | Jungle temples, ancient puzzles |
| Candy Kingdom 🍭 | Premium | Chocolate rivers, candy clouds |

Premium themes require Google sign-in.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | NextAuth v5 (Google OAuth) |
| Database | Supabase PostgreSQL via Prisma 7 |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| File Storage | Supabase Storage (story images + child photos) |
| AI — Story Text | Google Gemini 2.5 Flash (`generateContent`) |
| AI — Images | Google Imagen 4 (`generateImages`) |
| Image Processing | sharp (Gemini outputs only; Imagen bypassed to preserve native resolution) |
| Deployment | Vercel |

---

## Architecture

### File Structure

```
Code/web/
├── prisma/
│   ├── schema.prisma          # 7 Prisma models
│   └── migrations/            # SQL migration history
├── prisma.config.ts           # Prisma 7 connection config (loads .env.local)
└── src/
    ├── app/
    │   ├── page.tsx                        # Landing page
    │   ├── create/
    │   │   ├── page.tsx                    # Create form wrapper
    │   │   └── CreateStoryForm.tsx         # Main form + generation trigger
    │   ├── story-preview/
    │   │   ├── page.tsx
    │   │   └── StoryPreviewClient.tsx      # Guest fallback generation view
    │   ├── story/[id]/
    │   │   ├── page.tsx                    # Server: fetch story, check ownership
    │   │   └── StorySavedClient.tsx        # Immersive story view + async gen
    │   ├── profile/
    │   │   ├── page.tsx                    # Server: fetch stories + photos
    │   │   └── ProfileClient.tsx           # Story grid + photo gallery
    │   ├── admin/
    │   │   ├── page.tsx                    # Email-gated admin entry
    │   │   ├── AdminClient.tsx             # Stats dashboard + model picker
    │   │   └── users/[userId]/page.tsx     # Admin view of any user's profile
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts
    │       ├── generate-storybook/route.ts
    │       ├── generate-story-images/route.ts
    │       ├── stories/route.ts            # GET + POST
    │       ├── stories/[id]/route.ts       # GET + PATCH + DELETE
    │       ├── profile/photos/route.ts     # GET + POST
    │       ├── profile/photos/[id]/route.ts
    │       ├── admin/config/route.ts       # GET + PUT image model
    │       ├── admin/stats/route.ts        # Dashboard metrics
    │       └── admin/stories/[id]/regenerate/route.ts
    ├── components/
    │   ├── Header.tsx                      # Sticky nav with user menu
    │   ├── ReadingMode.tsx                 # Full-screen paginated reader
    │   └── ThemesSection.tsx              # Theme cards grid
    └── lib/
        ├── auth.ts                         # Full NextAuth config (Prisma adapter)
        ├── auth.config.ts                  # Edge-safe NextAuth config (middleware)
        ├── config.ts                       # Image models, admin emails, cost calc
        ├── formatStoryText.ts             # 2-sentence paragraph formatter
        ├── prisma.ts                       # Prisma client singleton
        ├── prompts.ts                      # All Gemini/Imagen prompts
        ├── storyThemes.ts                 # 15 theme configs (colors, icons, etc.)
        └── supabase-server.ts             # Storage upload/download helpers
```

### Auth Architecture

NextAuth v5 uses a **split config** pattern to satisfy Next.js edge runtime constraints:

- `auth.config.ts` — Edge-safe, no Node.js modules. Used by middleware to protect `/profile/*` and `/admin/*` routes.
- `auth.ts` — Full config with Prisma adapter. Used in server components and API routes.

The middleware guards `/profile` (requires sign-in) and `/admin` (requires admin email).

### Session Storage Flow

Story generation uses `sessionStorage` to pass data between pages without URL params:

- `heroStorybookDraft` — Full story data written by `CreateStoryForm` before navigation. Read by `StoryPreviewClient` (guest fallback).
- `heroStorybookPendingGen` — Written after cover+page1 save. Contains `storyId`, `imageGenerationContext`, `story`, `pendingPageNumbers[]`. Read by `StorySavedClient` on mount to continue async generation.

---

## API Routes

### `POST /api/generate-storybook`

Orchestrates the full text generation pipeline:

1. If photo provided → calls Gemini Vision with `buildCharacterProfilePrompt()` to extract `CharacterProfile`
2. Calls Gemini with `buildStoryGenerationPrompt()` → 6-page story draft
3. Calls Gemini with `buildStoryRefinementPrompt()` → refined story
4. Returns: `characterProfiles[]`, `imageGenerationContext`, `story`, `coverImagePrompt`, `imagePrompts[]`

**Model:** `GEMINI_TEXT_MODEL` (default: `gemini-2.5-flash`)

### `POST /api/generate-story-images`

Generates one or more images using the configured image model.

**Request modes:**
- Cover only: `{ imageGenerationContext, coverImagePrompt }`
- Page images: `{ imageGenerationContext, story, imagePrompts[] }`

**Model routing:**
- `imagen-*` → `client.models.generateImages()` with `aspectRatio: "3:4"` or `"16:9"`. No sharp post-processing (native resolution preserved).
- `gemini-*` → `client.models.generateContent()` with `responseModalities: ["TEXT", "IMAGE"]`. Reference photos injected as inline data. Sharp normalizes dimensions.

**Prompt routing by model:**
- Imagen: `buildImagenSharedContext()` (short visual description) + `buildImagenPagePrompt()` (scene only)
- Gemini: `buildSharedImageGenerationContext()` (full instruction block) + `buildFinalImagePromptFromContext()` (style + scene + negatives + self-check)

**Retry:** 2 attempts with exponential backoff on rate limits. Falls back to DiceBear placeholder SVG on failure.

### `POST /api/stories`

Saves a story to the database:
1. Uploads character photos to Supabase `child-photos` bucket
2. Uploads cover image to Supabase `story-images/[userId]/[timestamp]/cover.jpg`
3. Uploads page images to `story-images/[userId]/[timestamp]/page-N.jpg`
4. Creates `Story` record in Prisma with JSON blobs for story content and image URLs

### `PATCH /api/stories/[id]`

Incrementally updates a story's images as async generation completes:
- `{ pageNumber, imageBase64 }` → uploads page image, merges into `pageImagesJson`
- `{ coverImageBase64 }` → uploads and sets `coverImageUrl`

### `POST /api/admin/stories/[id]/regenerate`

Re-generates all images for an existing story (admin only):
1. Downloads stored character photos from Supabase
2. Re-derives `CharacterProfile` via Gemini Vision (one call per character)
3. Generates cover + all 6 page images using the active model
4. Updates story in DB — same ID, same access URL

---

## Image Generation Pipeline

### Character Consistency

The key to consistent illustrations is the `CharacterProfile` — a structured JSON object extracted from the uploaded photo by Gemini Vision:

```
{
  characterName, characterDescription,
  exactAge, appearanceAge,
  faceShape, skinTone, hair, eyes, build,
  signatureFeatures, defaultOutfit,
  recurringVisualAnchors: [],
  styleNotes
}
```

This profile is embedded in every image prompt via `buildImagenCharacterDescription()` (Imagen) or `buildCharacterAnchor()` (Gemini), ensuring the same child appears on every page.

### Prompt Architecture

Two parallel prompt pipelines exist, selected at runtime based on `GEMINI_IMAGE_MODEL`:

**Imagen pipeline** (short, visual, no instruction language):
```
"Children's picture book illustration. Full-color painting, warm soft lighting...
No text, no words, no letters...

Character: [name]: [age]-year-old, [skin], [face], [hair], [eyes], wearing [outfit].

Scene: [page text]"
```

**Gemini pipeline** (full instruction block with style directives):
```
VISUAL STYLE DIRECTIVE — [full art direction]
CHARACTER IDENTITY LOCK — [all visual traits]
CONSISTENCY REINFORCEMENT / PAGE 1 LANGUAGE ESTABLISHMENT
SCENE — [page text with illustration tasks]
HARD NEGATIVE REQUIREMENTS — [what NOT to generate]
MANDATORY SELF-CHECK — [7 validation conditions]
```

### Image Quality

- **No text in images**: Enforced via prompt phrasing in both pipelines ("No text, no words, no letters, no signs, no labels anywhere")
- **No sharp upscaling for Imagen**: Imagen returns native-resolution images. Sharp is bypassed to prevent blur from upscaling.
- **Aspect ratios**: Story pages → `3:4` portrait; Cover → `16:9` landscape. Passed directly to Imagen API.

---

## Database Schema

```prisma
model User {
  id, name, email, emailVerified, image
  accounts Account[]
  sessions  Session[]
  photos    UploadedPhoto[]
  stories   Story[]
}

model Story {
  id             String   @id @default(cuid())
  userId         String
  title          String
  coverText      String
  theme          String
  childName      String
  coverImageUrl  String?          // Supabase public URL
  storyJson      Json             // StoredStoryData: pages, characterPhotos[]
  pageImagesJson Json             // Record<pageNumber, {imageUrl}>
  childPhotoUrl  String?
  createdAt      DateTime
}

model UploadedPhoto {
  id        String
  userId    String
  url       String               // Supabase public URL
  filename  String
  fileSize  Int                  // bytes, used for admin upload analytics
  createdAt DateTime
}

model AppConfig {
  key       String @id            // e.g. "imageModel"
  value     String                // e.g. "imagen-4.0-fast-generate-001"
  updatedAt DateTime
}

// NextAuth tables: Account, Session, VerificationToken
```

**Notes:**
- Prisma 7 requires connection URLs in `prisma.config.ts` via `defineConfig()`, not in `schema.prisma`
- Supabase uses two public buckets: `story-images` and `child-photos`
- `DATABASE_URL` (port 6543, pgbouncer) for runtime; `DIRECT_URL` (port 5432) for migrations only

---

## Admin Panel

Access at `/admin` — restricted to emails listed in `ADMIN_EMAILS` in `lib/config.ts`.

### Dashboard

- **Story stats**: Today / This Week / This Month / Total — each with estimated cost
- **Activity chart**: 30-day bar chart of story generation volume
- **User table**: Per-user breakdown of stories generated, pages, images, uploaded photo size, estimated cost, last activity date — with "View →" link to their full profile

### Image Model Selector

Supported models (selectable via UI, stored in `AppConfig` DB table):

| Model | Cost/image | Cost/story | Notes |
|-------|-----------|-----------|-------|
| Imagen 4 Standard | $0.04 | $0.28 | Best quality |
| Imagen 4 Fast | $0.02 | $0.14 | Faster, slightly lower quality |
| Gemini 2.5 Flash Image | $0.039 | $0.27 | Supports reference photo injection |
| Gemini 3.1 Flash Image | $0.045+ | $0.32+ | Latest Gemini |

Model change takes effect on the next story generated — no restart required.

### Story Regeneration

Admins can re-generate all images for any user's story without changing the story ID or access URL:
1. Open any story from the admin user profile view
2. Dark admin banner appears at top with "↺ Regenerate Images" button
3. Regeneration re-downloads photos from Supabase, re-derives character profiles, generates fresh images
4. Page auto-reloads when complete

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project with OAuth 2.0 Web Application credentials
- A Supabase project (PostgreSQL + two public storage buckets: `story-images`, `child-photos`)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com)

### Install & Run

```bash
cd Code/web
npm install
DATABASE_URL="postgresql://..." npx prisma generate
npx prisma db execute --url "postgresql://..." --file prisma/migrations/...
npm run dev
```

### Google OAuth Setup

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → **Web application**
3. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
4. If app is in **Testing** mode → add your email as a test user under OAuth consent screen

---

## Environment Variables

```env
# Gemini API
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=imagen-4.0-fast-generate-001

# Auth
NEXTAUTH_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://...?pgbouncer=true    # port 6543 — runtime
DIRECT_URL=postgresql://...                      # port 5432 — migrations only

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Deployment

Deployed on Vercel. All environment variables set in Vercel project settings.

**Key notes:**
- `DIRECT_URL` is only needed for migrations — not required at runtime on Vercel
- The admin story regeneration route uses `maxDuration = 300` (5 min timeout) — requires Vercel Pro for the full duration
- Imagen 4 has a monthly spend cap in Google AI Studio — raise it under the project settings to avoid 429 errors
- The `GEMINI_IMAGE_MODEL` env var is the fallback; the active model is stored in `AppConfig` DB table and set via the admin panel
