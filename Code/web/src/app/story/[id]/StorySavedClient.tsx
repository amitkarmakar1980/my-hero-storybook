"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { StoredStoryData } from "@/types/storybook";

const ReadingMode = dynamic(() => import("@/components/ReadingMode"), { ssr: false });

interface SavedStory {
  id: string;
  title: string;
  coverText: string;
  theme: string;
  childName: string;
  coverImageUrl?: string;
  storyJson: StoredStoryData;
  pageImagesJson: Record<number, { imageUrl: string }>;
  createdAt: string;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "w-6 h-6"}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <title>Loading</title>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function adaptiveTextStyle(text: string): React.CSSProperties {
  const len = text.length;
  if (len < 200) return { fontSize: "clamp(1.3rem, 2.8vw, 1.85rem)", lineHeight: 1.95 };
  if (len < 400) return { fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",  lineHeight: 1.9 };
  return              { fontSize: "clamp(0.95rem, 1.9vw, 1.25rem)", lineHeight: 1.85 };
}

// ── Page image ────────────────────────────────────────────────────────────────

function PageImage({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1410]">
      <span className="text-5xl opacity-10">🎨</span>
    </div>
  );
}

// ── Cover spread ──────────────────────────────────────────────────────────────

function CoverSection({ title, coverText, imageUrl }: { title: string; coverText: string; imageUrl?: string }) {
  return (
    <section className="relative w-full min-h-[100svh] flex flex-col md:flex-row">
      {/* Image — full bleed left panel on desktop, top on mobile */}
      <div className="relative w-full aspect-[16/9] md:aspect-auto md:w-[58%] md:h-auto flex-shrink-0 overflow-hidden">
        <PageImage imageUrl={imageUrl} alt={`Cover of ${title}`} />
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#0e0b08] to-transparent" />
      </div>

      {/* Text panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-14 md:px-14 md:py-20 bg-[#0e0b08]">
        <div className="max-w-sm w-full text-center">
          <p className="font-semibold uppercase tracking-[0.4em] text-[#FC800A]/60 mb-7" style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.72rem)" }}>
            A Story For
          </p>
          <h1
            className="text-[#f5ede0] leading-tight tracking-[-0.02em] mb-8"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.8rem, 4vw, 3.2rem)" }}
          >
            {title}
          </h1>
          <div className="w-12 h-px bg-[#FC800A]/30 mx-auto mb-8" />
          <p
            className="text-[#b8a48e] leading-relaxed"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.05rem, 2vw, 1.3rem)", lineHeight: 1.9 }}
          >
            {coverText}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Story page spread ─────────────────────────────────────────────────────────

function StoryPageSection({
  pageNumber,
  pageText,
  imageUrl,
  total,
}: {
  pageNumber: number;
  pageText: string;
  imageUrl?: string;
  total: number;
}) {
  const imageLeft = pageNumber % 2 !== 0;
  const textStyle = adaptiveTextStyle(pageText);

  const imagePanel = (
    <div className="w-full md:w-[50%] flex-shrink-0 overflow-hidden">
      <div className="w-full aspect-[3/4]">
        <PageImage imageUrl={imageUrl} alt={`Illustration for page ${pageNumber}`} />
      </div>
    </div>
  );

  const textPanel = (
    <div className="flex-1 flex flex-col justify-center px-8 py-12 md:px-12 md:py-16 bg-[#120f0a]">
      <p
        className="text-[#e0cdb8]"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", ...textStyle }}
      >
        {pageText}
      </p>
      <p className="mt-8 text-[#FC800A]/30 font-medium tracking-widest" style={{ fontSize: "0.65rem" }}>
        {pageNumber} / {total}
      </p>
    </div>
  );

  return (
    <section className="relative flex flex-col md:flex-row border-t border-white/5">
      {/* Desktop: alternate image side */}
      <div className="hidden md:flex w-full">
        {imageLeft ? <>{imagePanel}{textPanel}</> : <>{textPanel}{imagePanel}</>}
      </div>
      {/* Mobile: always image top, text below */}
      <div className="flex flex-col md:hidden w-full">
        {imagePanel}
        <div className="px-6 py-10 bg-[#120f0a]">
          <p className="text-[#e0cdb8]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", ...textStyle }}>
            {pageText}
          </p>
          <p className="mt-6 text-[#FC800A]/30 font-medium tracking-widest text-right" style={{ fontSize: "0.65rem" }}>
            {pageNumber} / {total}
          </p>
        </div>
      </div>
    </section>
  );
}

// ── End section ───────────────────────────────────────────────────────────────

function EndSection({ heroName }: { heroName: string }) {
  return (
    <section className="flex flex-col items-center justify-center text-center px-8 py-24 bg-[#0e0b08] border-t border-white/5">
      <div className="flex items-center gap-4 text-[#FC800A]/40 mb-10" aria-hidden="true">
        <span>✨</span><span>✦</span><span>✨</span>
      </div>
      <p
        className="max-w-xl text-[#f0e0cc] leading-snug tracking-[-0.02em] mb-6"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.6rem, 4vw, 3rem)" }}
      >
        And somewhere out there, another adventure was already waiting for{" "}
        <span className="text-[#FC800A]">{heroName}</span>.
      </p>
      <p className="uppercase tracking-[0.4em] text-[#5a4e44]" style={{ fontSize: "0.7rem" }}>The End</p>
    </section>
  );
}

// ── Grain texture ─────────────────────────────────────────────────────────────

const GRAIN_SVG = "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")";

// ── Main component ────────────────────────────────────────────────────────────

export default function StorySavedClient({ story, isAdmin }: { story: SavedStory; isAdmin?: boolean }) {
  const router = useRouter();
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState<"idle" | "done" | "error">("idle");
  const [readingMode, setReadingMode] = useState(false);
  const heroName = story.childName.split(" ")[0];

  const handleRegenerate = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    setRegenStatus("idle");
    try {
      const res = await fetch(`/api/admin/stories/${story.id}/regenerate`, { method: "POST" });
      if (res.ok) {
        setRegenStatus("done");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setRegenStatus("error");
      }
    } catch {
      setRegenStatus("error");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isPdfGenerating) return;
    setIsPdfGenerating(true);
    try {
      const { downloadStoryPdf } = await import("@/lib/downloadPdf");
      await downloadStoryPdf({
        title: story.title,
        coverText: story.coverText,
        story: story.storyJson,
        coverImageUrl: story.coverImageUrl,
        pageImages: story.pageImagesJson,
      });
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <>
      {readingMode && (
        <ReadingMode
          title={story.title}
          coverText={story.coverText}
          heroName={heroName}
          coverImageUrl={story.coverImageUrl}
          storyJson={story.storyJson}
          pageImagesJson={story.pageImagesJson}
          onClose={() => setReadingMode(false)}
        />
      )}

      <div className="min-h-screen bg-[#0e0b08]" style={{ position: "relative" }}>
        {/* Grain texture */}
        <div
          className="pointer-events-none fixed inset-0 z-10 opacity-[0.035]"
          style={{ backgroundImage: GRAIN_SVG, backgroundRepeat: "repeat", backgroundSize: "256px" }}
          aria-hidden="true"
        />

        {/* ── Sticky top bar ── */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 bg-[#0e0b08]/90 backdrop-blur-sm border-b border-white/5">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors duration-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Library</span>
          </button>

          <p className="text-xs font-medium text-white/30 tracking-wide truncate max-w-[40%] text-center">
            {story.title}
          </p>

          <div className="flex items-center gap-2">
            {/* Admin controls */}
            {isAdmin && (
              <div className="flex items-center gap-2 mr-2">
                {regenStatus === "done" && <span className="text-green-400 text-xs">Regenerated</span>}
                {regenStatus === "error" && <span className="text-red-400 text-xs">Failed</span>}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium text-white/70
                             transition-all duration-200 disabled:opacity-40"
                >
                  {isRegenerating ? <><Spinner className="w-3 h-3" /> Regenerating…</> : "↺ Regenerate"}
                </button>
              </div>
            )}

            {/* Reading mode button — desktop only */}
            <button
              type="button"
              onClick={() => setReadingMode(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#FC800A] px-3.5 py-1.5 text-xs font-semibold text-white
                         hover:bg-[#e5720a] active:scale-[0.97] transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 10.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1-.75-.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Reading Mode</span>
              <span className="sm:hidden">Read</span>
            </button>
          </div>
        </div>

        {/* Admin banner */}
        {isAdmin && (
          <div className="bg-[#171E45]/80 text-white/60 text-xs px-5 py-2 flex items-center gap-2 border-b border-white/5">
            <span>👁 Admin view</span>
            <span className="opacity-40">·</span>
            <span>Story owner: {story.childName}</span>
          </div>
        )}

        {/* ── Content ── */}
        <div className="relative z-20">
          <CoverSection
            title={story.title}
            coverText={story.coverText}
            imageUrl={story.coverImageUrl}
          />

          {story.storyJson.pages.map((page) => (
            <StoryPageSection
              key={page.pageNumber}
              pageNumber={page.pageNumber}
              pageText={page.text}
              imageUrl={story.pageImagesJson[page.pageNumber]?.imageUrl}
              total={story.storyJson.pages.length}
            />
          ))}

          <EndSection heroName={heroName} />

          {/* ── Action bar ── */}
          <div className="px-6 py-16 bg-[#0a0805] border-t border-white/5">
            <div className="max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isPdfGenerating}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-[#FC800A] px-7 py-3.5 text-sm font-semibold text-white
                           hover:bg-[#e5720a] hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {isPdfGenerating ? (
                  <><Spinner className="w-4 h-4 text-white" /> Generating PDF…</>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                      <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="w-full sm:w-auto rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-white/60
                           hover:border-white/30 hover:text-white/90 hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
              >
                ✦ Create another story
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
