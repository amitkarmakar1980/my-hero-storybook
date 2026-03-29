import Header from "@/components/Header";
import StoryPreviewClient from "./StoryPreviewClient";

export default function StoryPreviewPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FCF7EE]">

        {/* Step progress indicator */}
        <div className="bg-[#FCF7EE] border-b border-[#FFD5C0]/50">
          <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center gap-3">

            {/* Step 1 — complete */}
            <div className="flex items-center gap-2 rounded-full bg-[#FBF1E3] border border-[#FFD5C0] px-3.5 py-1.5">
              <span
                className="w-4 h-4 rounded-full bg-[#88B520] flex items-center justify-center
                           text-[10px] font-bold text-white flex-shrink-0"
                aria-hidden="true"
              >
                ✓
              </span>
              <span className="text-xs font-medium text-[#020202]/50">Create</span>
            </div>

            {/* Connector */}
            <div
              aria-hidden="true"
              className="flex-1 h-px"
              style={{ background: "linear-gradient(to right, rgba(255,213,192,0.4), rgba(252,128,10,0.35))" }}
            />

            {/* Step 2 — active */}
            <div className="flex items-center gap-2 rounded-full bg-[#FC800A] px-3.5 py-1.5">
              <span
                className="w-4 h-4 rounded-full bg-white flex items-center justify-center
                           text-[10px] font-bold text-[#FC800A] flex-shrink-0"
                aria-hidden="true"
              >
                2
              </span>
              <span className="text-xs font-semibold text-white">Preview</span>
            </div>

          </div>
        </div>

        <StoryPreviewClient />

      </main>
    </>
  );
}
