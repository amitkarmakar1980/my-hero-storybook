"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type {
  GeneratedStorybook,
  GeneratedStoryImage,
  PageImagePrompt,
  CoverImagePrompt,
  CharacterProfile,
  GeneratedStory,
} from "@/types/storybook";

// ── Session storage helpers ───────────────────────────────────────────────────

const SESSION_KEY = "heroStorybookDraft";

interface DraftExtras {
  theme?: string;
  childPhotoUrl?: string;
  childPhotoBase64?: string;
  childPhotoMimeType?: string;
}

function isGeneratedStorybook(value: unknown): value is GeneratedStorybook {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!("childName" in v) || !("characterProfile" in v) || !("story" in v) || !("coverImagePrompt" in v) || !("imagePrompts" in v)) return false;
  const story = v.story as Record<string, unknown> | null;
  return (
    typeof story === "object" &&
    story !== null &&
    Array.isArray(story.pages) &&
    (story.pages as unknown[]).length > 0 &&
    Array.isArray(v.imagePrompts)
  );
}

function readStorybookDraft(): (GeneratedStorybook & DraftExtras) | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isGeneratedStorybook(parsed) ? (parsed as GeneratedStorybook & DraftExtras) : null;
  } catch {
    return null;
  }
}

// ── Page image state ──────────────────────────────────────────────────────────

// ── Page image state ──────────────────────────────────────────────────────

type PageImageState =
  | { status: "loading" }
  | { status: "success"; imageUrl: string }
  | { status: "error"; error: string };

type PageImageRecord = {
  state: PageImageState;
  isInvalid?: boolean;
  invalidReason?: string;
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPageImages(
  characterProfile: CharacterProfile,
  story: GeneratedStory,
  imagePrompts: PageImagePrompt[],
  signal?: AbortSignal
): Promise<GeneratedStoryImage[]> {
  const res = await fetch("/api/generate-story-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterProfile, story, imagePrompts }),
    signal,
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  const data = (await res.json()) as { images: GeneratedStoryImage[] };
  return data.images;
}

async function fetchCoverImage(
  coverImagePrompt: CoverImagePrompt,
  signal?: AbortSignal
): Promise<GeneratedStoryImage> {
  const res = await fetch("/api/generate-story-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coverImagePrompt }),
    signal,
  });
  if (!res.ok) throw new Error(`Cover image generation failed (${res.status})`);
  const data = (await res.json()) as { images: GeneratedStoryImage[] };
  return data.images[0];
}

// ── Spinner SVG ───────────────────────────────────────────────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? "w-6 h-6"}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <title>Loading</title>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Page image component ──────────────────────────────────────────────────────

function PageImage({
  pageNumber,
  state,
  isInvalid,
  invalidReason,
  onRetry,
}: {
  pageNumber: number;
  state: PageImageState | undefined;
  isInvalid?: boolean;
  invalidReason?: string;
  onRetry: (pageNumber: number) => void;
}) {
  // Invalid image — show quality gate fallback
  if (isInvalid) {
    return (
      <div
        className="w-full aspect-[4/5] rounded-2xl overflow-hidden
                   flex flex-col items-center justify-center gap-4 px-6 text-center
                   bg-gradient-to-br from-[#FBF1E3] to-[#f8f3ea] border border-[#FFD5C0]/40"
        role="status"
        aria-live="polite"
        aria-label={`Page ${pageNumber} illustration needs improvement`}
      >
        <div className="text-5xl opacity-20">✨</div>
        <div>
          <h3 className="text-base font-semibold text-[#171E45] mb-1">
            This page needs a better illustration
          </h3>
          <p className="text-xs text-[#020002]/60">
            {invalidReason || "Quality improvement needed"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRetry(pageNumber)}
          className="mt-2 rounded-full bg-[#FC800A] text-white text-sm font-semibold px-4 py-2
                     shadow-[0_4px_14px_rgba(252,128,10,0.35)]
                     hover:bg-[#e5720a] hover:-translate-y-0.5
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                     active:scale-[0.97] transition-all duration-200"
        >
          Regenerate ↺
        </button>
      </div>
    );
  }

  if (!state || state.status === "loading") {
    return (
      <div
        className="w-full aspect-[4/5] rounded-2xl overflow-hidden
                   flex flex-col items-center justify-center gap-3"
        style={{ background: "linear-gradient(160deg, #f5ede0 0%, #fce5c8 50%, #f5ede0 100%)" }}
        role="status"
        aria-live="polite"
        aria-label={`Generating illustration for page ${pageNumber}`}
      >
        <Spinner className="w-7 h-7 text-[#FC800A]/50" />
        <span className="text-sm text-[#020002]/50 font-medium">Painting illustration…</span>
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="w-full aspect-[4/5] overflow-hidden rounded-2xl
                      shadow-[0_8px_32px_rgba(23,30,69,0.15)] duration-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.imageUrl}
          alt={`Illustration for page ${pageNumber}`}
          className="w-full h-full object-cover"
          width={512}
          height={640}
        />
      </div>
    );
  }

  // error state
  return (
    <div
      className="w-full aspect-[4/5] rounded-2xl bg-[#FBF1E3] border border-[#FFD5C0]/40
                 flex flex-col items-center justify-center gap-4 px-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Illustration failed for page ${pageNumber}`}
    >
      <span className="text-5xl opacity-20">🎨</span>
      <div>
        <span className="text-sm text-[#171E45] font-semibold leading-snug block">
          Illustration couldn&apos;t load
        </span>
        <span className="text-xs text-[#020002]/60 mt-1 block break-words">
          {state.error}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRetry(pageNumber)}
        className="rounded-full bg-[#FC800A] text-white text-sm font-semibold px-4 py-2
                   shadow-[0_4px_14px_rgba(252,128,10,0.35)]
                   hover:bg-[#e5720a] hover:-translate-y-0.5
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                   active:scale-[0.97] transition-all duration-200"
      >
        Regenerate ↺
      </button>
    </div>
  );
}

// ── Story page spread ────────────────────────────────────────────────────────

function StoryPageSpread({
  pageNumber,
  pageText,
  imageData,
  onRetry,
}: {
  pageNumber: number;
  pageText: string;
  imageData: PageImageRecord | undefined;
  onRetry: (pageNumber: number) => void;
}) {
  const state = imageData?.state;
  const isInvalid = imageData?.isInvalid ?? false;
  const invalidReason = imageData?.invalidReason;

  return (
    <article className="mb-24 md:mb-32">
      {/* Illustration with quality gate */}
      <PageImage
        pageNumber={pageNumber}
        state={state}
        isInvalid={isInvalid}
        invalidReason={invalidReason}
        onRetry={onRetry}
      />

      {/* Page text — improved typography and spacing */}
      <div className="mt-10 px-3 md:px-6 max-w-2xl mx-auto">
        {/* Page number pill */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-full
                       bg-[#FC800A]/15 text-[#FC800A] text-xs font-bold flex-shrink-0"
          >
            {pageNumber}
          </span>
          <div className="flex-1 h-px bg-[#FFD5C0]/60" aria-hidden="true" />
        </div>

        {/* Story text — larger, better line height, higher contrast */}
        <p className="text-lg md:text-xl leading-relaxed md:leading-8 text-[#171E45] max-w-xl">
          {pageText}
        </p>
      </div>
    </article>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function StoryPreviewClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [draft, setDraft] = useState<(GeneratedStorybook & DraftExtras) | null>(null);
  const [coverImageState, setCoverImageState] = useState<PageImageState>({ status: "loading" });
  const [pageImages, setPageImages] = useState<Record<number, PageImageRecord>>({});
  const [simProgress, setSimProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedStoryId, setSavedStoryId] = useState<string | null>(null);
  const hasSavedRef = useRef(false);

  // ── Illustration loading progress ─────────────────────────────────────────
  const totalPages = draft?.imagePrompts.length ?? 0;
  const pagesLoadedCount = Object.values(pageImages).filter(
    (r) => r.state.status !== "loading"
  ).length;
  const pagesLoaded = totalPages > 0 && pagesLoadedCount === totalPages;
  const coverLoaded = coverImageState.status !== "loading";
  const allImagesLoaded = draft !== null && pagesLoaded && coverLoaded;
  const realProgress = allImagesLoaded ? 100 : pagesLoaded ? 90 : 0;
  const displayProgress = Math.max(simProgress, realProgress);

  // ── Apply image results with quality validation support
  const applyImageResults = useCallback((results: GeneratedStoryImage[]) => {
    setPageImages((prev) => {
      const next = { ...prev };
      for (const result of results) {
        const pageNum = result.pageNumber;
        let state: PageImageState;
        if (result.imageUrl && result.quality?.isValid !== false) {
          state = { status: "success", imageUrl: result.imageUrl };
        } else if (result.error) {
          // API error or generation failed
          state = { status: "error", error: result.error };
        } else {
          state = { status: "error", error: "Unknown error" };
        }
        
        // Check quality flag from new API response format
        const isInvalid = result.quality?.isValid === false;
        const invalidReason = result.quality?.invalidReason || result.quality?.qualityFlags?.[0];
        
        next[pageNum] = { state, isInvalid, invalidReason };
      }
      return next;
    });
  }, []);

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

        const initial: Record<number, PageImageRecord> = {};
        for (const p of data.imagePrompts) {
          initial[p.pageNumber] = { state: { status: "loading" } };
        }
        setPageImages(initial);

        try {
          const results = await fetchPageImages(data.characterProfile, data.story, data.imagePrompts, signal);
          if (!isMounted || signal.aborted) return;
          applyImageResults(results);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          if (!isMounted || signal.aborted) return;
          setPageImages((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              const n = Number(key);
              if (next[n].state.status === "loading") {
                next[n] = { state: { status: "error", error: "Request failed" } };
              }
            }
            return next;
          });
        }

        try {
          const coverResult = await fetchCoverImage(data.coverImagePrompt, signal);
          if (!isMounted || signal.aborted) return;
          if (coverResult.imageUrl) {
            setCoverImageState({ status: "success", imageUrl: coverResult.imageUrl });
          } else {
            setCoverImageState({ status: "error", error: coverResult.error ?? "Unknown error" });
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          if (!isMounted || signal.aborted) return;
          setCoverImageState({ status: "error", error: "Cover generation failed" });
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("Error in loadData:", err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [router, applyImageResults]);

  const handleRetry = useCallback(
    async (pageNumber: number) => {
      if (!draft) return;
      const prompt = draft.imagePrompts.find((p) => p.pageNumber === pageNumber);
      if (!prompt) return;
      setPageImages((prev) => ({ ...prev, [pageNumber]: { state: { status: "loading" } } }));
      try {
        const results = await fetchPageImages(draft.characterProfile, draft.story, [prompt]);
        applyImageResults(results);
      } catch {
        setPageImages((prev) => ({
          ...prev,
          [pageNumber]: { state: { status: "error", error: "Retry failed" } },
        }));
      }
    },
    [draft, applyImageResults]
  );

  // ── Simulated illustration progress ticker ────────────────────────────────
  // Dependencies on primitive state values instead of derived computations to prevent unnecessary reruns
  useEffect(() => {
    if (allImagesLoaded || !draft) return;
    const interval = setInterval(() => {
      setSimProgress((prev) => {
        const target = pagesLoaded ? 93 : 82;
        const rate = pagesLoaded ? 0.6 : 0.22;
        return Math.min(prev + rate, target);
      });
    }, 300);
    return () => clearInterval(interval);
  }, [totalPages, pagesLoadedCount]);

  // ── Auto-save when all images loaded and user is signed in ───────────────
  useEffect(() => {
    if (!allImagesLoaded || !session?.user?.id || !draft || hasSavedRef.current) return;
    hasSavedRef.current = true;
    setSaveStatus("saving");

    const coverBase64 = coverImageState.status === "success" ? coverImageState.imageUrl : undefined;
    const pageImagesBase64: Record<number, string> = {};
    for (const [k, v] of Object.entries(pageImages)) {
      if (v.state.status === "success") {
        pageImagesBase64[Number(k)] = v.state.imageUrl;
      }
    }

    fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.story.title,
        coverText: draft.story.coverText,
        theme: draft.theme ?? "",
        childName: draft.childName,
        childPhotoUrl: draft.childPhotoUrl,
        childPhotoBase64: draft.childPhotoBase64,
        childPhotoMimeType: draft.childPhotoMimeType,
        coverImageBase64: coverBase64,
        pageImagesBase64,
        storyJson: draft.story,
      }),
    })
      .then((r) => r.json())
      .then((data: { storyId?: string }) => {
        if (data.storyId) {
          setSavedStoryId(data.storyId);
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      })
      .catch(() => setSaveStatus("error"));
  }, [allImagesLoaded, session?.user?.id]);

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!draft || isPdfGenerating) return;
    setIsPdfGenerating(true);
    try {
      const { downloadStoryPdf } = await import("@/lib/downloadPdf");
      const coverUrl =
        coverImageState.status === "success" ? coverImageState.imageUrl : undefined;
      const pageImageData: Record<number, { imageUrl?: string }> = {};
      for (const [k, v] of Object.entries(pageImages)) {
        pageImageData[Number(k)] = {
          imageUrl: v.state.status === "success" ? v.state.imageUrl : undefined,
        };
      }
      await downloadStoryPdf({
        title: draft.story.title,
        coverText: draft.story.coverText,
        story: draft.story,
        coverImageUrl: coverUrl,
        pageImages: pageImageData,
      });
    } finally {
      setIsPdfGenerating(false);
    }
  }, [draft, coverImageState, pageImages, isPdfGenerating]);

  const handleCoverRetry = useCallback(async () => {
    if (!draft) return;
    setCoverImageState({ status: "loading" });
    try {
      const coverResult = await fetchCoverImage(draft.coverImagePrompt);
      if (coverResult.imageUrl) {
        setCoverImageState({ status: "success", imageUrl: coverResult.imageUrl });
      } else {
        setCoverImageState({ status: "error", error: coverResult.error ?? "Unknown error" });
      }
    } catch {
      setCoverImageState({ status: "error", error: "Cover retry failed" });
    }
  }, [draft]);

  // ── Loading skeleton ──

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-9 h-9 text-[#FC800A]" />
          <p className="text-[#020202]/40 text-sm">Loading your story…</p>
        </div>
      </div>
    );
  }

  const { story } = draft;
  const heroName = draft.childName.split(" ")[0];

  const progressMessage = pagesLoaded
    ? "Painting the cover illustration…"
    : displayProgress < 25
    ? "Setting up the canvas…"
    : displayProgress < 55
    ? "Painting your illustrations…"
    : displayProgress < 80
    ? "Adding fine details…"
    : "Almost done painting…";

  return (
    <>
      {/* ── Story title ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#FBF1E3] to-[#f8f3ea]">
        <div className="mx-auto max-w-2xl px-5 py-16 md:py-20 text-center">
          <p className="text-xs font-semibold text-[#FC800A] tracking-widest uppercase mb-4 letter-spacing">
            ✨ A story starring your little hero ✨
          </p>
          <h1
            className="text-5xl md:text-6xl lg:text-7xl text-[#171E45] leading-tight tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            {story.title}
          </h1>
          <p className="text-lg md:text-xl text-[#020202]/70 leading-relaxed max-w-2xl mx-auto italic font-light">
            {story.coverText}
          </p>
        </div>
      </div>

      {/* ── Front cover ──────────────────────────────────────────────────────── */}
      <div className="bg-[#f8f3ea] pt-12 pb-8">
        <div className="max-w-xl mx-auto px-4">
          <PageImage pageNumber={0} state={coverImageState} onRetry={handleCoverRetry} />
        </div>
      </div>

      {/* ── Story pages ──────────────────────────────────────────────────────── */}
      <main className="bg-[#f8f3ea]">
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-12">
          {story.pages.map((page) => (
            <StoryPageSpread
              key={page.pageNumber}
              pageNumber={page.pageNumber}
              pageText={page.text}
              imageData={pageImages[page.pageNumber]}
              onRetry={handleRetry}
            />
          ))}
        </section>
      </main>

      {/* ── Ending ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#f8f3ea] py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex flex-col items-center text-center gap-6 py-12 rounded-3xl bg-gradient-to-b from-[#FBF1E3]/50 to-[#FBF1E3]/20">
            <div className="flex items-center gap-3 text-3xl md:text-4xl" aria-hidden="true">
              <span>✨</span>
              <span>✦</span>
              <span>✨</span>
            </div>
            <p
              className="text-3xl md:text-4xl text-[#171E45] leading-snug max-w-lg tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              And somewhere out there, another adventure was already waiting for{" "}
              <span className="text-[#FC800A]">{heroName}</span>.
            </p>
            <p className="text-sm uppercase tracking-[0.15em] text-[#020202]/40 mt-2">
              The End
            </p>
          </div>
        </div>
      </div>

      {/* ── Save status banner ───────────────────────────────────────────────── */}
      {session?.user && saveStatus !== "idle" && (
        <div className="bg-[#f8f3ea] pt-4">
          <div className="mx-auto max-w-2xl px-6">
            {saveStatus === "saving" && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-[#FBF1E3] border border-[#FFD5C0] px-4 py-3 text-sm text-[#171E45]/70">
                <Spinner className="w-4 h-4 text-[#FC800A]" />
                Saving to your library…
              </div>
            )}
            {saveStatus === "saved" && savedStoryId && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F0F9E0] border border-[#88B520]/30 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-[#4A6810] font-medium">
                  <svg className="w-4 h-4 text-[#88B520]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd"/>
                  </svg>
                  Saved to your library!
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/profile")}
                  className="text-xs font-semibold text-[#88B520] hover:underline underline-offset-2"
                >
                  View in profile →
                </button>
              </div>
            )}
            {saveStatus === "error" && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                Could not save to library. You can still download the PDF.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Action bar ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#f8f3ea] to-[#FBF1E3] pb-20 pt-12">
        <div className="mx-auto max-w-2xl px-6 flex flex-col sm:flex-row items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => router.push("/create")}
            className="rounded-full bg-[#FC800A] px-8 py-4 text-base font-semibold text-white w-full sm:w-auto
                       shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                       hover:bg-[#e5720a] hover:-translate-y-0.5
                       hover:shadow-[0_8px_26px_rgba(252,128,10,0.48)]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                       active:scale-[0.97] transition-all duration-200"
          >
            ✦ Create another story
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!allImagesLoaded || isPdfGenerating}
            className="rounded-full border-2 border-[#020202]/10 bg-white/60 px-8 py-4 text-base font-semibold text-[#171E45] w-full sm:w-auto
                       hover:border-[#FC800A]/40 hover:bg-white hover:-translate-y-0.5
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                       active:scale-[0.97] transition-all duration-200
                       disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {isPdfGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner className="w-4 h-4 text-[#FC800A]" />
                Generating PDF…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#FC800A]" aria-hidden="true">
                  <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                  <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                </svg>
                Download PDF
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Illustration progress — sticky bottom bar ─────────────────────── */}
      {!allImagesLoaded && (
        <div className="fixed bottom-0 inset-x-0 z-20">
          <div
            className="bg-[#FBF1E3]/95 backdrop-blur-sm border-t border-[#FFD5C0]"
            style={{ boxShadow: "0 -4px 20px rgba(0,0,0,0.06)" }}
          >
            <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center gap-3">
              <span aria-hidden="true" className="text-lg flex-shrink-0">🎨</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-[#171E45]/65 truncate">
                    {progressMessage}
                  </span>
                  <span className="text-xs text-[#020202]/30 ml-2 flex-shrink-0 tabular-nums">
                    {Math.round(displayProgress)}%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,213,192,0.5)" }}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${displayProgress}%`,
                      background: "linear-gradient(to right, #FC800A, #FFB27A)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
