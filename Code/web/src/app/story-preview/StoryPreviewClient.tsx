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
  CharacterPhotoInput,
  StoryImageGenerationContext,
  GeneratedStory,
  StoryCharacterInput,
} from "@/types/storybook";

// ── Session storage helpers ───────────────────────────────────────────────────

const SESSION_KEY = "heroStorybookDraft";

interface DraftExtras {
  theme?: string;
  characterNames?: string[];
  characters?: StoryCharacterInput[];
  characterPhotos?: CharacterPhotoInput[];
  childPhotoUrl?: string;
  childPhotoBase64?: string;
  childPhotoMimeType?: string;
}

function isGeneratedStorybook(value: unknown): value is GeneratedStorybook {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!("childName" in v) || !(("characterProfile" in v) || ("characterProfiles" in v)) || !("story" in v) || !("coverImagePrompt" in v) || !("imagePrompts" in v)) return false;
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

function getDraftCharacterProfiles(draft: GeneratedStorybook & DraftExtras): CharacterProfile[] {
  if (draft.imageGenerationContext?.characterProfiles?.length) {
    return draft.imageGenerationContext.characterProfiles;
  }

  if (Array.isArray(draft.characterProfiles) && draft.characterProfiles.length > 0) {
    return draft.characterProfiles;
  }

  return draft.characterProfile ? [draft.characterProfile] : [];
}

function getDraftImageGenerationContext(
  draft: GeneratedStorybook & DraftExtras
): StoryImageGenerationContext | undefined {
  if (draft.imageGenerationContext) {
    return draft.imageGenerationContext;
  }

  const characterProfiles = getDraftCharacterProfiles(draft);
  if (characterProfiles.length === 0) {
    return undefined;
  }

  return {
    characterNames: draft.characterNames ?? characterProfiles.map((character) => character.characterName),
    characterProfiles,
    characterPhotos: draft.characterPhotos ?? [],
    sharedContextPrompt: "",
  };
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
  imageGenerationContext: StoryImageGenerationContext | undefined,
  story: GeneratedStory,
  imagePrompts: PageImagePrompt[],
  signal?: AbortSignal
): Promise<GeneratedStoryImage[]> {
  const res = await fetch("/api/generate-story-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageGenerationContext, story, imagePrompts }),
    signal,
  });
  if (!res.ok) throw new Error(`Image generation failed (${res.status})`);
  const data = (await res.json()) as { images: GeneratedStoryImage[] };
  return data.images;
}

async function fetchCoverImage(
  imageGenerationContext: StoryImageGenerationContext | undefined,
  coverImagePrompt: CoverImagePrompt,
  signal?: AbortSignal
): Promise<GeneratedStoryImage> {
  const res = await fetch("/api/generate-story-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageGenerationContext, coverImagePrompt }),
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
  aspectClass,
  plain,
}: {
  pageNumber: number;
  state: PageImageState | undefined;
  isInvalid?: boolean;
  invalidReason?: string;
  onRetry: (pageNumber: number) => void;
  aspectClass?: string;
  plain?: boolean;
}) {
  const resolvedAspectClass = aspectClass ?? "aspect-[3/4]";
  const shellClass = plain ? "" : " rounded-2xl shadow-[0_8px_32px_rgba(23,30,69,0.15)] duration-300";
  const fallbackShellClass = plain ? "" : " rounded-2xl";

  // Invalid image — show quality gate fallback
  if (isInvalid) {
    return (
      <div
        className={`w-full ${resolvedAspectClass}${fallbackShellClass} overflow-hidden
                   flex flex-col items-center justify-center gap-4 px-6 text-center
                   bg-gradient-to-br from-[#FBF1E3] to-[#f8f3ea] border border-[#FFD5C0]/40`}
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
        className={`w-full ${resolvedAspectClass}${fallbackShellClass} overflow-hidden
                   flex flex-col items-center justify-center gap-3`}
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
      <div className={`w-full ${resolvedAspectClass} overflow-hidden${shellClass}`}>
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
      className={`w-full ${resolvedAspectClass}${fallbackShellClass} bg-[#FBF1E3] border border-[#FFD5C0]/40
                 flex flex-col items-center justify-center gap-4 px-6 text-center`}
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
  const isEvenPage = pageNumber % 2 === 0;

  return (
    <article className="relative mb-10 md:mb-14 overflow-hidden rounded-2xl border border-[#E6D4BE] shadow-[0_4px_24px_rgba(23,30,69,0.07)]">
      {/* Mobile: stacked. Desktop: side-by-side, both columns locked to aspect-[3/4] */}
      <div className={`flex flex-col md:flex-row ${isEvenPage ? "md:flex-row-reverse" : ""}`}>

        {/* Image column — always 3:4 */}
        <div className="w-full md:w-1/2 flex-shrink-0">
          <PageImage
            pageNumber={pageNumber}
            state={state}
            isInvalid={isInvalid}
            invalidReason={invalidReason}
            onRetry={onRetry}
            aspectClass="aspect-[3/4]"
            plain
          />
        </div>

        {/* Text column — same 3:4 height on desktop, natural on mobile */}
        <div className="w-full md:w-1/2 md:aspect-[3/4] flex items-center bg-[rgba(255,252,246,0.85)]
                        border-t border-[#E6D4BE] md:border-t-0
                        md:border-l md:border-[#E6D4BE]">
          <div className="w-full h-full overflow-y-auto flex items-center">
            <p className="px-7 py-8 md:px-10 text-base leading-8 text-[#2F3555] md:text-lg md:leading-9">
              {pageText}
            </p>
          </div>
        </div>

      </div>
      {/* Page number */}
      <div className="absolute bottom-3 right-4 text-xs font-medium text-[#020202]/20 select-none">
        {pageNumber}
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
          const results = await fetchPageImages(getDraftImageGenerationContext(data), data.story, data.imagePrompts);
          if (!isMounted) return;
          applyImageResults(results);
        } catch {
          if (!isMounted) return;
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
          const coverResult = await fetchCoverImage(getDraftImageGenerationContext(data), data.coverImagePrompt);
          if (!isMounted) return;
          if (coverResult.imageUrl) {
            setCoverImageState({ status: "success", imageUrl: coverResult.imageUrl });
          } else {
            setCoverImageState({ status: "error", error: coverResult.error ?? "Unknown error" });
          }
        } catch {
          if (!isMounted) return;
          setCoverImageState({ status: "error", error: "Cover generation failed" });
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("Error in loadData:", err);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [router, applyImageResults]);

  const handleRetry = useCallback(
    async (pageNumber: number) => {
      if (!draft) return;
      const prompt = draft.imagePrompts.find((p) => p.pageNumber === pageNumber);
      if (!prompt) return;
      setPageImages((prev) => ({ ...prev, [pageNumber]: { state: { status: "loading" } } }));
      try {
        const results = await fetchPageImages(getDraftImageGenerationContext(draft), draft.story, [prompt]);
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
        characterNames: draft.characterNames,
        characters: draft.characters,
        characterPhotos: draft.characterPhotos,
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
      const coverResult = await fetchCoverImage(getDraftImageGenerationContext(draft), draft.coverImagePrompt);
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
      {/* ── Story shell ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#fff9ef_0%,#f8f3ea_44%,#f0e5d4_100%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" aria-hidden="true" />

        <header className="mx-auto max-w-5xl px-4 pb-8 pt-8 md:px-6 md:pb-12 md:pt-12">
          <div className="rounded-[2.25rem] border border-[#E6D4BE] bg-[rgba(255,252,246,0.88)] px-5 py-6 shadow-[0_20px_60px_rgba(83,57,33,0.12)] backdrop-blur-sm md:px-8 md:py-8">
            <div className="flex min-h-[78vh] flex-col md:min-h-[820px]">
              <div className="flex min-h-[18%] items-center justify-center px-2 pb-4 pt-2 text-center md:min-h-[20%] md:pb-6">
                <h1
                  className="max-w-4xl text-[2.1rem] leading-tight tracking-[-0.04em] text-[#171E45] md:text-[3.2rem] xl:text-[3.75rem]"
                  style={{ fontFamily: "var(--font-rowdies)" }}
                >
                  {story.title}
                </h1>
              </div>

              <div className="flex min-h-[58%] flex-1 items-center justify-center py-4 md:min-h-[60%] md:py-6">
                <div className="w-full">
                  <PageImage pageNumber={0} state={coverImageState} onRetry={handleCoverRetry} aspectClass="aspect-[16/9]" plain />
                </div>
              </div>

              <div className="flex min-h-[12%] items-end justify-center px-4 pb-2 pt-4 text-center md:min-h-[14%] md:px-10 md:pb-4">
                <p className="max-w-3xl text-lg leading-8 text-[#2D345A] md:text-[1.3rem] md:leading-9">
                  {story.coverText}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* ── Story pages ──────────────────────────────────────────────────────── */}
        <main>
          <section className="mx-auto max-w-7xl px-4 pb-12 pt-4 md:px-6 md:pb-16">
            <div className="mb-8 flex items-center justify-center gap-4 text-center">
              <div className="hidden h-px w-16 bg-[#E5D0B8] md:block" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#B57B41]">
                Open the Story
              </p>
              <div className="hidden h-px w-16 bg-[#E5D0B8] md:block" aria-hidden="true" />
            </div>

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
        <div className="px-4 pb-16 pt-4 md:px-6 md:pb-20">
          <div className="mx-auto max-w-4xl rounded-[2.2rem] border border-[#E6D4BE] bg-[linear-gradient(180deg,rgba(255,252,246,0.94)_0%,rgba(251,241,227,0.9)_100%)] p-8 shadow-[0_18px_60px_rgba(86,60,37,0.11)] md:p-12">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="flex items-center gap-3 text-3xl md:text-4xl" aria-hidden="true">
                <span>✨</span>
                <span>✦</span>
                <span>✨</span>
              </div>
              <p
                className="max-w-2xl text-3xl leading-snug tracking-[-0.02em] text-[#171E45] md:text-5xl"
                style={{ fontFamily: "var(--font-rowdies)" }}
              >
                And somewhere out there, another adventure was already waiting for{" "}
                <span className="text-[#FC800A]">{heroName}</span>.
              </p>
              <p className="text-sm uppercase tracking-[0.25em] text-[#7E7468]">
                The End
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save status banner ───────────────────────────────────────────────── */}
      {session?.user && saveStatus !== "idle" && (
        <div className="bg-[#f8f3ea] pt-4">
          <div className="mx-auto max-w-4xl px-6">
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
        <div className="mx-auto max-w-4xl px-6">
          <div className="rounded-[2rem] border border-[#E6D4BE] bg-[rgba(255,252,246,0.88)] p-6 shadow-[0_18px_50px_rgba(86,60,37,0.12)] backdrop-blur-sm md:p-8">
            <div className="mb-6 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#B57B41]">
                Keep This Story Close
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
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
