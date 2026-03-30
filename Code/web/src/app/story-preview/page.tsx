import StoryPreviewClient from "./StoryPreviewClient";

export default function StoryPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f8f3ea]">
      {/* Minimal reading-mode header — no progress steps, no nav chrome */}
      <div className="sticky top-0 z-10 bg-[#FBF1E3]/95 backdrop-blur-sm border-b border-[#FFD5C0]/50">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <span
            className="text-sm font-normal text-[#171E45]/60"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            📖 Hero Storybook
          </span>
          <span className="text-xs text-[#020202]/30 tracking-wide">Your story is ready</span>
        </div>
      </div>
      <StoryPreviewClient />
    </main>
  );
}
