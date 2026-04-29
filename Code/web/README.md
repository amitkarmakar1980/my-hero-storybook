# My Hero Storybook

My Hero Storybook is a Next.js app that turns a child's photo into a personalized picture book. It generates a reusable character profile from the uploaded photo, writes a short story with Gemini, renders matching illustrations, saves the story to Postgres with Prisma, stores uploaded media in Supabase Storage, and gives each signed-in user a profile library with saved stories, thumbnails, uploaded photos, story deletion, and PDF export.

## Features

- Google sign-in with persistent sessions using Auth.js and Prisma.
- Gemini-powered character profiling, story generation, and illustration generation.
- Saved story library at `/profile` with thumbnails and deletion.
- Uploaded child photo persistence backed by Supabase Storage.
- Saved story detail pages at `/story/[id]`.
- PDF export for saved stories.
- Larger request-body support for image-heavy story saves via `proxyClientMaxBodySize`.

## Stack

- Next.js 16.2.1 with the App Router and Turbopack.
- React 19.
- Auth.js / NextAuth v5 beta with Google provider.
- Prisma with PostgreSQL.
- Supabase Storage for persisted photos and story images.
- Google Gemini for text and image generation.
- jsPDF for downloadable PDFs.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all required values.

```bash
cp .env.example .env.local
```

Required values:

```bash
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
NEXTAUTH_SECRET=your_long_random_secret
DATABASE_URL=your_postgres_connection_string
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Optional model overrides:

```bash
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

## Required Supabase Storage Buckets

Create these buckets in your Supabase project before using uploads or story persistence:

- `child-photos`
- `story-images`

If those buckets do not exist, profile photo uploads and persisted story images will fail.

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Create and populate `.env.local`.

3. Apply the Prisma migration to your database.

```bash
npx prisma migrate dev
```

4. Start the development server.

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test:image
```

`npm run test:image` sends a local request to `/api/generate-story-images` so you can smoke-test the image generation route while the app is running.

## App Flow

1. The user signs in with Google.
2. A child photo is uploaded during story creation.
3. Gemini derives a reusable character profile from that image.
4. Gemini generates the story text and page-level illustration prompts.
5. Gemini image generation creates the cover and page art.
6. The app persists the child photo and generated images to Supabase Storage.
7. Story metadata and image references are saved to PostgreSQL through Prisma.
8. The saved story appears in the profile library and can be reopened, downloaded as a PDF, or deleted.

## Database Models

The Prisma schema currently stores:

- Auth.js tables for users, accounts, sessions, and verification tokens.
- `UploadedPhoto` records for persisted child photos.
- `Story` records with title, theme, child name, cover text, saved image URLs, and full story/page JSON.

## Notes

- Remote image loading is configured for Google-hosted assets and Supabase-hosted assets in `next.config.ts`.
- Large story-save payloads are supported through `experimental.proxyClientMaxBodySize = "25mb"`.
- If the dev server starts returning missing CSS or chunk 404s while `npm run build` still passes, clear `.next` and restart the dev server.

## Deployment

Before deploying, make sure your production environment includes the same database, Google OAuth, Gemini, and Supabase values used locally, and that both storage buckets already exist in the target Supabase project.
