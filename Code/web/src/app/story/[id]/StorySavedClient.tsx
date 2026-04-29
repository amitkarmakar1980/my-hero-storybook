"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GeneratedStory } from "@/types/storybook";

interface SavedStory {
  id: string;
  title: string;
  coverText: string;
  theme: string;
  childName: string;
  coverImageUrl?: string;
  storyJson: GeneratedStory;
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

export default function StorySavedClient({ story }: { story: SavedStory }) {
  const router = useRouter();
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const heroName = story.childName.split(" ")[0];

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
      {/* ── Story title ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#FBF1E3] to-[#f8f3ea]">
        <div className="mx-auto max-w-2xl px-5 py-16 md:py-20 text-center">
          <p className="text-xs font-semibold text-[#FC800A] tracking-widest uppercase mb-4">
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
      {story.coverImageUrl && (
        <div className="bg-[#f8f3ea] pt-12 pb-8">
          <div className="max-w-xl mx-auto px-4">
            <div className="w-full aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(23,30,69,0.15)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={story.coverImageUrl}
                alt={`Cover of ${story.title}`}
                className="w-full h-full object-cover"
                width={512}
                height={640}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Story pages ──────────────────────────────────────────────────────── */}
      <main className="bg-[#f8f3ea]">
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-12">
          {story.storyJson.pages.map((page) => {
            const imageData = story.pageImagesJson[page.pageNumber];
            return (
              <article key={page.pageNumber} className="mb-24 md:mb-32">
                {imageData?.imageUrl ? (
                  <div className="w-full aspect-[4/5] overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(23,30,69,0.15)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageData.imageUrl}
                      alt={`Illustration for page ${page.pageNumber}`}
                      className="w-full h-full object-cover"
                      width={512}
                      height={640}
                    />
                  </div>
                ) : (
                  <div className="w-full aspect-[4/5] rounded-2xl bg-[#FBF1E3] border border-[#FFD5C0]/40 flex items-center justify-center text-4xl opacity-20">
                    🎨
                  </div>
                )}

                <div className="mt-10 px-3 md:px-6 max-w-2xl mx-auto">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#FC800A]/15 text-[#FC800A] text-xs font-bold flex-shrink-0">
                      {page.pageNumber}
                    </span>
                    <div className="flex-1 h-px bg-[#FFD5C0]/60" aria-hidden="true" />
                  </div>
                  <p className="text-lg md:text-xl leading-relaxed md:leading-8 text-[#171E45] max-w-xl">
                    {page.text}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      {/* ── Ending ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#f8f3ea] py-20">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex flex-col items-center text-center gap-6 py-12 rounded-3xl bg-gradient-to-b from-[#FBF1E3]/50 to-[#FBF1E3]/20">
            <div className="flex items-center gap-3 text-3xl md:text-4xl" aria-hidden="true">
              <span>✨</span><span>✦</span><span>✨</span>
            </div>
            <p
              className="text-3xl md:text-4xl text-[#171E45] leading-snug max-w-lg tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              And somewhere out there, another adventure was already waiting for{" "}
              <span className="text-[#FC800A]">{heroName}</span>.
            </p>
            <p className="text-sm uppercase tracking-[0.15em] text-[#020202]/40 mt-2">The End</p>
          </div>
        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#f8f3ea] to-[#FBF1E3] pb-20 pt-12">
        <div className="mx-auto max-w-2xl px-6 flex flex-col sm:flex-row items-center justify-center gap-5">
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
    </>
  );
}
