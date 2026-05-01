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

function SavedPageImage({
  pageNumber,
  imageUrl,
  title,
  aspectClass,
  plain,
}: {
  pageNumber: number;
  imageUrl?: string;
  title?: string;
  aspectClass?: string;
  plain?: boolean;
}) {
  const resolvedAspectClass = aspectClass ?? "aspect-[4/5]";
  const shellClass = plain ? "" : " rounded-2xl shadow-[0_8px_32px_rgba(23,30,69,0.15)] duration-300";
  const fallbackShellClass = plain ? "" : " rounded-2xl";

  if (imageUrl) {
    return (
      <div className={`w-full ${resolvedAspectClass} overflow-hidden${shellClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={title ? `Cover of ${title}` : `Illustration for page ${pageNumber}`}
          className="w-full h-full object-cover"
          width={512}
          height={640}
        />
      </div>
    );
  }

  return (
    <div className={`w-full ${resolvedAspectClass}${fallbackShellClass} bg-[#FBF1E3] border border-[#FFD5C0]/40 flex items-center justify-center text-4xl opacity-20`}>
      🎨
    </div>
  );
}

function adaptiveTextStyle(text: string): React.CSSProperties {
  const len = text.length;
  if (len < 200) return { fontSize: "clamp(1.05rem, 2vw, 1.35rem)", lineHeight: 1.85 };
  if (len < 400) return { fontSize: "clamp(0.95rem, 1.7vw, 1.15rem)", lineHeight: 1.8 };
  return              { fontSize: "clamp(0.82rem, 1.4vw, 0.98rem)",  lineHeight: 1.75 };
}

function SavedStoryPageSpread({
  pageNumber,
  pageText,
  imageUrl,
}: {
  pageNumber: number;
  pageText: string;
  imageUrl?: string;
}) {
  const isEvenPage = pageNumber % 2 === 0;

  return (
    <article className="relative mb-14 md:mb-20">
      <div className={`relative flex flex-col gap-6 md:gap-0 ${isEvenPage ? "md:flex-row-reverse" : "md:flex-row"}`}>
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 top-0 hidden w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(230,212,190,0),rgba(230,212,190,0.95),rgba(230,212,190,0))] md:block"
          aria-hidden="true"
        />
        <div className="order-1 flex w-full items-center justify-center md:w-1/2 md:px-6">
          <div className="w-full max-w-[28rem]">
            <SavedPageImage pageNumber={pageNumber} imageUrl={imageUrl} plain />
          </div>
        </div>

        <div className="order-2 w-full md:w-1/2">
          <div className="flex h-full flex-col justify-center px-6 py-6 md:px-12 md:py-12">
            <p className="text-[#2F3555]" style={adaptiveTextStyle(pageText)}>
              {pageText}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

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

      {isAdmin && (
        <div className="bg-[#171E45] text-white text-sm px-5 py-3 flex items-center gap-4">
          <span className="opacity-60">👁 Admin view</span>
          <span className="opacity-40">·</span>
          <span className="opacity-60">Story owner: {story.childName}</span>
          <div className="ml-auto flex items-center gap-3">
            {regenStatus === "done" && <span className="text-green-400 text-xs font-medium">Regenerated — reloading…</span>}
            {regenStatus === "error" && <span className="text-red-400 text-xs font-medium">Regeneration failed</span>}
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-2 rounded-full bg-[#FC800A] px-4 py-1.5 text-xs font-semibold text-white
                         hover:bg-[#e5720a] active:scale-[0.97] transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegenerating ? (
                <><Spinner className="w-3.5 h-3.5 text-white" /> Regenerating…</>
              ) : (
                "↺ Regenerate Images"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#fff9ef_0%,#f8f3ea_44%,#f0e5d4_100%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-24 hidden h-[calc(100%-12rem)] w-px -translate-x-1/2 bg-[linear-gradient(180deg,rgba(230,212,190,0),rgba(230,212,190,0.9),rgba(230,212,190,0))] xl:block" aria-hidden="true" />

        <header className="mx-auto max-w-5xl px-4 pb-8 pt-8 md:px-6 md:pb-12 md:pt-12">
          {/* Reading Mode button — top right of the cover card */}
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => setReadingMode(true)}
              className="flex items-center gap-2 rounded-full bg-[#171E45] px-4 py-2 text-sm font-medium text-white
                         shadow-[0_4px_16px_rgba(23,30,69,0.25)]
                         hover:bg-[#0f1430] hover:-translate-y-0.5
                         active:scale-[0.97] transition-all duration-200"
            >
              <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
              </svg>
              Reading Mode
            </button>
          </div>

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
                  <SavedPageImage pageNumber={0} imageUrl={story.coverImageUrl} title={story.title} aspectClass="aspect-[16/9]" plain />
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

        <main>
          <section className="mx-auto max-w-7xl px-4 pb-12 pt-4 md:px-6 md:pb-16">
            <div className="mb-8 flex items-center justify-center gap-4 text-center">
              <div className="hidden h-px w-16 bg-[#E5D0B8] md:block" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#B57B41]">
                Open the Story
              </p>
              <div className="hidden h-px w-16 bg-[#E5D0B8] md:block" aria-hidden="true" />
            </div>

            {story.storyJson.pages.map((page) => (
              <SavedStoryPageSpread
                key={page.pageNumber}
                pageNumber={page.pageNumber}
                pageText={page.text}
                imageUrl={story.pageImagesJson[page.pageNumber]?.imageUrl}
              />
            ))}
          </section>
        </main>

        <div className="px-4 pb-16 pt-4 md:px-6 md:pb-20">
          <div className="mx-auto max-w-4xl rounded-[2.2rem] border border-[#E6D4BE] bg-[linear-gradient(180deg,rgba(255,252,246,0.94)_0%,rgba(251,241,227,0.9)_100%)] p-8 shadow-[0_18px_60px_rgba(86,60,37,0.11)] md:p-12">
            <div className="flex flex-col items-center text-center gap-6">
              <div className="flex items-center gap-3 text-3xl md:text-4xl" aria-hidden="true">
                <span>✨</span><span>✦</span><span>✨</span>
              </div>
              <p
                className="max-w-2xl text-3xl leading-snug tracking-[-0.02em] text-[#171E45] md:text-5xl"
                style={{ fontFamily: "var(--font-rowdies)" }}
              >
                And somewhere out there, another adventure was already waiting for{" "}
                <span className="text-[#FC800A]">{heroName}</span>.
              </p>
              <p className="text-sm uppercase tracking-[0.25em] text-[#7E7468]">The End</p>
            </div>
          </div>
        </div>
      </div>

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
                onClick={() => router.push("/profile")}
                className="rounded-full bg-[#FC800A] px-8 py-4 text-base font-semibold text-white w-full sm:w-auto
                           shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                           hover:bg-[#e5720a] hover:-translate-y-0.5
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
              >
                ← Back to Library
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isPdfGenerating}
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
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="rounded-full border-2 border-[#020202]/10 bg-white/60 px-8 py-4 text-base font-semibold text-[#171E45] w-full sm:w-auto
                           hover:border-[#FC800A]/40 hover:bg-white hover:-translate-y-0.5
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
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
