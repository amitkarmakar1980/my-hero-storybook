"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { formatStoryText } from "@/lib/formatStoryText";
import type { StoredStoryData } from "@/types/storybook";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReadingPage =
  | { type: "cover"; imageUrl?: string; title: string; coverText: string }
  | { type: "story"; pageNumber: number; imageUrl?: string; text: string }
  | { type: "end"; heroName: string };

interface ReadingModeProps {
  title: string;
  coverText: string;
  heroName: string;
  coverImageUrl?: string;
  storyJson: StoredStoryData;
  pageImagesJson: Record<number, { imageUrl: string }>;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPages(props: Omit<ReadingModeProps, "onClose">): ReadingPage[] {
  // Normalize keys — JSON serialization turns numeric keys into strings
  const imageMap: Record<number, string | undefined> = {};
  for (const [k, v] of Object.entries(props.pageImagesJson)) {
    imageMap[Number(k)] = v.imageUrl;
  }

  const pages: ReadingPage[] = [
    { type: "cover", imageUrl: props.coverImageUrl, title: props.title, coverText: props.coverText },
    ...props.storyJson.pages.map((p) => ({
      type: "story" as const,
      pageNumber: p.pageNumber,
      imageUrl: imageMap[p.pageNumber],
      text: p.text,
    })),
    { type: "end", heroName: props.heroName },
  ];
  return pages;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageImage({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-[#1a1410]">
      <span className="text-6xl opacity-10">🎨</span>
    </div>
  );
}

function CoverSpread({ page }: { page: Extract<ReadingPage, { type: "cover" }> }) {
  return (
    <div className="w-full h-full flex flex-col md:flex-row">

      {/* ── Mobile: scrollable, image aspect-ratio ── */}
      <div className="flex flex-col w-full h-full md:hidden overflow-y-auto bg-[#1c1610]">
        <div className="relative w-full aspect-[16/9] flex-shrink-0 overflow-hidden">
          <PageImage imageUrl={page.imageUrl} alt={`Cover of ${page.title}`} />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0e0b08] to-transparent" />
        </div>
        <div className="px-8 py-10 text-center">
          <p className="font-semibold uppercase tracking-[0.4em] text-[#FC800A]/70 mb-5" style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.75rem)" }}>A Story For</p>
          <h1 className="text-[#f5ede0] leading-tight tracking-[-0.02em] mb-6" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.6rem, 4vw, 3rem)" }}>{page.title}</h1>
          <div className="w-12 h-px bg-[#FC800A]/40 mx-auto mb-6" />
          <p className="text-[#c4ad92] leading-relaxed" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(0.9rem, 1.8vw, 1.15rem)", lineHeight: 1.85 }}>{page.coverText}</p>
        </div>
      </div>

      {/* ── Desktop: side-by-side panels ── */}
      <div className="hidden md:flex w-full h-full">
        {/* Image */}
        <div className="relative w-[60%] flex-shrink-0 overflow-hidden">
          <PageImage imageUrl={page.imageUrl} alt={`Cover of ${page.title}`} />
        </div>
        {/* Text panel */}
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden bg-[#1c1610]">
        <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center px-14 py-16">
          <div className="max-w-sm text-center w-full">
            <p className="font-semibold uppercase tracking-[0.4em] text-[#FC800A]/70 mb-6" style={{ fontSize: "clamp(0.6rem, 1.2vw, 0.75rem)" }}>A Story For</p>
            <h1
              className="text-[#f5ede0] leading-tight tracking-[-0.02em] mb-8"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.6rem, 4vw, 3rem)" }}
            >
              {page.title}
            </h1>
            <div className="w-12 h-px bg-[#FC800A]/40 mx-auto mb-8" />
            <p
              className="text-[#c4ad92] leading-relaxed"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(0.9rem, 1.8vw, 1.15rem)", lineHeight: 1.85 }}
            >
              {page.coverText}
            </p>
          </div>
        </div>
        </div>
      </div>

    </div>
  );
}

function storyLayout(text: string): {
  fontSize: string;
  lineHeight: number;
} {
  const len = text.length;
  if (len < 200) return { fontSize: "clamp(1.5rem, 3.2vw, 2.1rem)",   lineHeight: 2.1 };
  if (len < 400) return { fontSize: "clamp(1.25rem, 2.6vw, 1.65rem)", lineHeight: 2.0 };
  return              { fontSize: "clamp(1.05rem, 2.1vw, 1.35rem)",  lineHeight: 1.9 };
}

function StorySpread({ page, index, totalStoryPages }: { page: Extract<ReadingPage, { type: "story" }>; index: number; totalStoryPages: number }) {
  const imageLeft = index % 2 === 0;
  const { fontSize, lineHeight } = storyLayout(page.text);

  const imageDesktopPanel = (
    <div className="w-1/2 flex-shrink-0 overflow-hidden h-full">
      <PageImage imageUrl={page.imageUrl} alt={`Illustration for page ${page.pageNumber}`} />
    </div>
  );

  const desktopTextPanel = (
    <div className="w-1/2 flex flex-col overflow-hidden bg-[#1c1610]">
      <div className="flex-1 overflow-y-auto flex flex-col justify-center px-10 py-14">
        <div className="w-full">
          <div className="flex flex-col gap-4">
            {formatStoryText(page.text).map((para, i) => (
              <p key={i} className="text-[#e8d8c4]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize, lineHeight }}>
                {para}
              </p>
            ))}
          </div>
          <p className="mt-6 text-[#FC800A]/40 font-medium tracking-widest text-right" style={{ fontSize: "clamp(0.6rem, 1vw, 0.7rem)" }}>
            {page.pageNumber} / {totalStoryPages}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col md:flex-row">

      {/* ── Mobile: natural scroll, image aspect-ratio, text flows below ── */}
      <div className="flex flex-col w-full h-full md:hidden overflow-y-auto bg-[#1c1610]">
        <div className="w-full aspect-[3/4] flex-shrink-0 overflow-hidden">
          <PageImage imageUrl={page.imageUrl} alt={`Illustration for page ${page.pageNumber}`} />
        </div>
        <div className="px-6 py-8 flex-1">
          <div className="flex flex-col gap-3">
            {formatStoryText(page.text).map((para, i) => (
              <p key={i} className="text-[#e8d8c4]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize, lineHeight }}>
                {para}
              </p>
            ))}
          </div>
          <p className="mt-6 text-[#FC800A]/40 font-medium tracking-widest text-right text-xs">
            {page.pageNumber} / {totalStoryPages}
          </p>
        </div>
      </div>

      {/* ── Desktop: fixed split panels ── */}
      <div className="hidden md:flex w-full h-full">
        {imageLeft ? <>{imageDesktopPanel}{desktopTextPanel}</> : <>{desktopTextPanel}{imageDesktopPanel}</>}
      </div>

      {/* Spine shadow */}
      <div
        className="hidden md:block absolute inset-y-0 left-1/2 pointer-events-none"
        style={{ width: 1, background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.5), transparent)" }}
        aria-hidden="true"
      />
    </div>
  );
}

function EndSpread({ page }: { page: Extract<ReadingPage, { type: "end" }> }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-8 text-center bg-[#120f0a]">
      <div className="flex items-center gap-4 text-2xl text-[#FC800A]/50 mb-10">
        <span>✨</span><span>✦</span><span>✨</span>
      </div>
      <p
        className="max-w-md text-[#f0e0cc] leading-snug tracking-[-0.02em] mb-8"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.5rem, 4vw, 3rem)" }}
      >
        And somewhere out there, another adventure was already waiting for{" "}
        <span className="text-[#FC800A]">{page.heroName}</span>.
      </p>
      <p className="uppercase tracking-[0.35em] text-[#7a6a58]" style={{ fontSize: "clamp(0.65rem, 1.2vw, 0.8rem)" }}>The End</p>
    </div>
  );
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ total, current, onDotClick }: { total: number; current: number; onDotClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onDotClick(i)}
          aria-label={`Go to page ${i + 1}`}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "w-5 h-1.5 bg-[#FC800A]"
              : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReadingMode(props: ReadingModeProps) {
  const { onClose } = props;
  const pages = buildPages(props);
  const totalStoryPages = props.storyJson.pages.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Fade in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goTo = useCallback((index: number) => {
    if (transitioning || index === currentIndex) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setTransitioning(false);
    }, 220);
  }, [transitioning, currentIndex]);

  const prev = useCallback(() => { if (currentIndex > 0) goTo(currentIndex - 1); }, [currentIndex, goTo]);
  const next = useCallback(() => { if (currentIndex < pages.length - 1) goTo(currentIndex + 1); }, [currentIndex, pages.length, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const currentPage = pages[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "#0e0b08",
        opacity: visible ? 1 : 0,
        transition: "opacity 400ms ease",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.04]"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }}
        aria-hidden="true"
      />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-5 py-4 flex-shrink-0">
        <p className="text-xs font-medium text-white/30 tracking-wider truncate max-w-[60%]">{props.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white/80 transition-colors duration-200"
          aria-label="Exit reading mode"
        >
          <span>Exit</span>
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Page content */}
      <div className="relative z-20 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{ opacity: transitioning ? 0 : 1 }}
        >
          {currentPage.type === "cover" && <CoverSpread page={currentPage} />}
          {currentPage.type === "story" && (
            <StorySpread page={currentPage} index={currentIndex} totalStoryPages={totalStoryPages} />
          )}
          {currentPage.type === "end" && <EndSpread page={currentPage} />}
        </div>

        {/* Desktop nav arrows */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={prev}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-30
                       w-10 h-10 rounded-full items-center justify-center
                       bg-white/5 hover:bg-white/15 text-white/40 hover:text-white/80
                       transition-all duration-200"
            aria-label="Previous page"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        {currentIndex < pages.length - 1 && (
          <button
            type="button"
            onClick={next}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-30
                       w-10 h-10 rounded-full items-center justify-center
                       bg-white/5 hover:bg-white/15 text-white/40 hover:text-white/80
                       transition-all duration-200"
            aria-label="Next page"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom bar — progress dots + mobile nav */}
      <div className="relative z-20 flex items-center justify-between px-5 py-4 flex-shrink-0">
        {/* Mobile prev */}
        <button
          type="button"
          onClick={prev}
          disabled={currentIndex === 0}
          className="md:hidden text-white/40 hover:text-white/80 disabled:opacity-20 transition-colors duration-200"
          aria-label="Previous page"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="hidden md:block" />

        <ProgressDots total={pages.length} current={currentIndex} onDotClick={goTo} />

        {/* Mobile next */}
        <button
          type="button"
          onClick={next}
          disabled={currentIndex === pages.length - 1}
          className="md:hidden text-white/40 hover:text-white/80 disabled:opacity-20 transition-colors duration-200"
          aria-label="Next page"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="hidden md:block" />
      </div>
    </div>
  );
}
