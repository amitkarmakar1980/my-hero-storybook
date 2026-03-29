"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  GeneratedStorybook,
  GeneratedStoryImage,
  PageImagePrompt,
  CharacterProfile,
  GeneratedStory,
} from "@/types/storybook";

// ── Session storage helpers ───────────────────────────────────────────────────

const SESSION_KEY = "heroStorybookDraft";

function isGeneratedStorybook(value: unknown): value is GeneratedStorybook {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!("characterProfile" in v) || !("story" in v) || !("imagePrompts" in v)) return false;
  const story = v.story as Record<string, unknown> | null;
  return (
    typeof story === "object" &&
    story !== null &&
    Array.isArray(story.pages) &&
    (story.pages as unknown[]).length > 0 &&
    Array.isArray(v.imagePrompts)
  );
}

function readStorybookDraft(): GeneratedStorybook | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGeneratedStorybook(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── Page image state ──────────────────────────────────────────────────────────

type PageImageState =
  | { status: "loading" }
  | { status: "success"; imageUrl: string }
  | { status: "error"; error: string };

// ── API helper ────────────────────────────────────────────────────────────────

async function fetchPageImages(
  characterProfile: CharacterProfile,
  story: GeneratedStory,
  imagePrompts: PageImagePrompt[],
  signal?: AbortSignal
): Promise<GeneratedStoryImage[]> {
  try {
    const res = await fetch("/api/generate-story-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterProfile, story, imagePrompts }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Image generation failed (${res.status}):`, errorText);
      throw new Error(`Image generation failed (${res.status})`);
    }

    const data = (await res.json()) as { images: GeneratedStoryImage[] };
    if (process.env.NODE_ENV === "development") {
      console.log("Image generation successful:", data);
    }
    return data.images;
  } catch (err) {
    // Silently ignore AbortError — component unmounted or navigation happened
    if (err instanceof Error && err.name === "AbortError") {
      if (process.env.NODE_ENV === "development") {
        console.log("Image generation request was aborted");
      }
      throw err;
    }
    if (process.env.NODE_ENV === "development") {
      console.error("fetchPageImages error:", err);
    }
    throw err;
  }
}

// ── Per-page image display ────────────────────────────────────────────────────

function PageImage({
  pageNumber,
  state,
  onRetry,
}: {
  pageNumber: number;
  state: PageImageState | undefined;
  onRetry: (pageNumber: number) => void;
}) {
  if (!state || state.status === "loading") {
    return (
      <div
        className="w-full aspect-square rounded-2xl bg-[#FBF1E3] border-2 border-[#FFD5C0]
                   flex flex-col items-center justify-center gap-3"
        role="img"
        aria-label={`Generating illustration for page ${pageNumber}`}
      >
        <svg
          className="animate-spin w-7 h-7 text-[#FC800A]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <title>Loading</title>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-xs text-[#020202]/40 font-medium">Painting illustration…</span>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="w-full aspect-square rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.imageUrl}
          alt={`Illustration for page ${pageNumber}`}
          className="w-full h-full object-cover"
          width={512}
          height={512}
        />
      </div>
    );
  }

  // error state
  return (
    <div
      className="w-full aspect-square rounded-2xl bg-[#FBF1E3] border-2 border-dashed border-[#FFD5C0]
                 flex flex-col items-center justify-center gap-3 px-4 text-center"
      role="img"
      aria-label={`Illustration failed for page ${pageNumber}`}
    >
      <span className="text-3xl opacity-30" aria-hidden="true">
        🎨
      </span>
      <div>
        <span className="text-xs text-[#020202]/40 font-medium leading-snug block">
          Illustration couldn&apos;t load
        </span>
        <span className="text-[10px] text-[#020202]/30 mt-1 block break-words">
          {state.error}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRetry(pageNumber)}
        className="text-xs font-semibold text-[#FC800A] underline underline-offset-2
                   hover:text-[#e0700a] transition-colors duration-150
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
      >
        Try again
      </button>
    </div>
  );
}

// ── Storybook page row ────────────────────────────────────────────────────────

function StoryPageRow({
  pageNumber,
  pageText,
  imageOnLeft,
  imageState,
  onRetry,
}: {
  pageNumber: number;
  pageText: string;
  imageOnLeft: boolean;
  imageState: PageImageState | undefined;
  onRetry: (pageNumber: number) => void;
}) {
  const imageBlock = (
    <div className="w-full md:w-[45%] flex-shrink-0">
      <PageImage pageNumber={pageNumber} state={imageState} onRetry={onRetry} />
    </div>
  );

  const textBlock = (
    <div className="flex-1 flex flex-col justify-center gap-3 py-2">
      <span
        className="text-xs font-semibold tracking-widest text-[#FC800A]/60 uppercase"
        aria-label={`Page ${pageNumber}`}
      >
        Page {pageNumber}
      </span>
      <p
        className="text-[#171E45] text-lg md:text-xl leading-relaxed"
        style={{ fontFamily: "var(--font-roboto)" }}
      >
        {pageText}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row items-center gap-7 md:gap-10">
      {imageOnLeft ? (
        <>
          {imageBlock}
          {textBlock}
        </>
      ) : (
        <>
          <div className="w-full md:hidden">{imageBlock}</div>
          <div className="hidden md:block flex-1">{textBlock}</div>
          <div className="hidden md:block w-[45%] flex-shrink-0">{imageBlock}</div>
          <div className="md:hidden flex-1">{textBlock}</div>
        </>
      )}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export default function StoryPreviewClient() {
  const router = useRouter();
  const [draft, setDraft] = useState<GeneratedStorybook | null>(null);
  const [pageImages, setPageImages] = useState<Record<number, PageImageState>>({});

  // Merge API results into per-page image state
  const applyImageResults = useCallback((results: GeneratedStoryImage[]) => {
    setPageImages((prev) => {
      const next = { ...prev };
      for (const result of results) {
        if (result.imageUrl) {
          next[result.pageNumber] = { status: "success", imageUrl: result.imageUrl };
        } else {
          next[result.pageNumber] = {
            status: "error",
            error: result.error ?? "Unknown error",
          };
        }
      }
      return next;
    });
  }, []);

  // Load draft on mount, kick off all-page image generation
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let isMounted = true;

    const loadData = async () => {
      try {
        const data = readStorybookDraft();
        if (!data) {
          if (isMounted) router.replace("/create");
          return;
        }

        if (!isMounted) return;
        setDraft(data);

        // Mark every page as loading immediately so text renders right away
        const initial: Record<number, PageImageState> = {};
        for (const p of data.imagePrompts) {
          initial[p.pageNumber] = { status: "loading" };
        }
        setPageImages(initial);

        try {
          const results = await fetchPageImages(
            data.characterProfile,
            data.story,
            data.imagePrompts,
            signal
          );
          if (!isMounted || signal.aborted) return;
          applyImageResults(results);
        } catch (err) {
          // Silently ignore AbortError — component unmounted or navigation happened
          if (err instanceof Error && err.name === "AbortError") {
            return;
          }
          if (!isMounted || signal.aborted) return;
          // Whole request failed — mark all still-loading pages as error
          setPageImages((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              const n = Number(key);
              if (next[n].status === "loading") {
                next[n] = { status: "error", error: "Request failed" };
              }
            }
            return next;
          });
        }
      } catch (err) {
        console.error("Error in loadData:", err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router, applyImageResults]);

  // Retry a single failed page
  const handleRetry = useCallback(
    async (pageNumber: number) => {
      if (!draft) return;
      const prompt = draft.imagePrompts.find((p) => p.pageNumber === pageNumber);
      if (!prompt) return;

      setPageImages((prev) => ({ ...prev, [pageNumber]: { status: "loading" } }));
      try {
        const results = await fetchPageImages(draft.characterProfile, draft.story, [prompt]);
        applyImageResults(results);
      } catch (err) {
        // Silently ignore AbortError
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setPageImages((prev) => ({
          ...prev,
          [pageNumber]: { status: "error", error: "Retry failed" },
        }));
      }
    },
    [draft, applyImageResults]
  );

  // ── Loading state while sessionStorage read resolves ──

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4 text-center">
          <svg
            className="animate-spin w-8 h-8 text-[#FC800A]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <title>Loading</title>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[#020202]/50 text-sm">Loading your story…</p>
        </div>
      </div>
    );
  }

  const { story } = draft;

  return (
    <>
      {/* ── Story title hero ─────────────────────────────────────────────────── */}
      <div className="bg-[#FBF1E3] border-b border-[#FFD5C0]">
        <div className="mx-auto max-w-2xl px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#FC800A]/70 mb-2">
            A story starring your little hero
          </p>
          <h1
            className="text-4xl md:text-5xl text-[#171E45] leading-tight tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            {story.title}
          </h1>
          <p className="mt-3 text-base text-[#020202]/60 leading-relaxed max-w-md mx-auto italic">
            {story.coverText}
          </p>
        </div>
      </div>

      {/* ── Story pages ──────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-12 pb-6 flex flex-col gap-12">
        {story.pages.map((page, index) => (
          <div
            key={page.pageNumber}
            className="bg-white rounded-3xl border border-[#FFD5C0]/60
                       shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 md:p-8"
          >
            <StoryPageRow
              pageNumber={page.pageNumber}
              pageText={page.text}
              imageOnLeft={index % 2 === 0}
              imageState={pageImages[page.pageNumber]}
              onRetry={handleRetry}
            />
          </div>
        ))}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div
          className="rounded-3xl bg-[#FBF1E3] border border-[#FFD5C0] p-6 md:p-8
                      flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div>
            <p
              className="text-lg text-[#171E45] font-semibold"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              {story.title}
            </p>
            <p className="text-sm text-[#020202]/50 mt-0.5">Your personalized storybook is ready</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push("/create")}
              className="rounded-full border-2 border-[#FFD5C0] bg-white px-5 py-2.5
                         text-sm font-semibold text-[#171E45]
                         hover:border-[#FC800A]/40 hover:bg-[#FCF7EE]
                         transition-[background-color,border-color] duration-200
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
            >
              ← Back to edit
            </button>
            <button
              type="button"
              title="PDF export coming soon"
              className="rounded-full bg-[#FC800A] text-white px-5 py-2.5
                         text-sm font-semibold opacity-60 cursor-not-allowed"
              aria-disabled="true"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
