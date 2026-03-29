import Header from "@/components/Header";
import CreateStoryForm from "./CreateStoryForm";

export default function CreateStoryPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FCF7EE]">

        {/* Step progress indicator */}
        <div className="bg-[#FCF7EE] border-b border-[#FFD5C0]/50">
          <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center gap-3">

            {/* Step 1 — active */}
            <div className="flex items-center gap-2 rounded-full bg-[#FC800A] px-3.5 py-1.5">
              <span
                className="w-4 h-4 rounded-full bg-white flex items-center justify-center
                           text-[10px] font-bold text-[#FC800A] flex-shrink-0"
                aria-hidden="true"
              >
                1
              </span>
              <span className="text-xs font-semibold text-white">Create</span>
            </div>

            {/* Connector */}
            <div
              aria-hidden="true"
              className="flex-1 h-px"
              style={{ background: "linear-gradient(to right, rgba(252,128,10,0.35), rgba(255,213,192,0.4))" }}
            />

            {/* Step 2 — upcoming */}
            <div className="flex items-center gap-2 rounded-full bg-[#FBF1E3] border border-[#FFD5C0] px-3.5 py-1.5">
              <span
                className="w-4 h-4 rounded-full bg-[#FFD5C0] flex items-center justify-center
                           text-[10px] font-medium text-[#020202]/40 flex-shrink-0"
                aria-hidden="true"
              >
                2
              </span>
              <span className="text-xs font-medium text-[#020202]/40">Preview</span>
            </div>

          </div>
        </div>

        {/* Page hero */}
        <div className="bg-[#FBF1E3] border-b border-[#FFD5C0]">
          <div className="mx-auto max-w-2xl px-5 py-10 text-center">
            <h1
              className="text-4xl md:text-5xl text-[#171E45] leading-tight tracking-[-0.025em]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              Create Your Story
            </h1>
            <p className="mt-3 text-base text-[#020202]/60 leading-relaxed max-w-md mx-auto">
              Tell us about your little hero and we&apos;ll craft a personalized
              illustrated adventure just for them.
            </p>
            <p className="mt-2.5 text-sm font-medium text-[#FC800A]/80 flex items-center justify-center gap-1.5">
              <span aria-hidden="true">⏱</span> Takes less than 2 minutes
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="mx-auto max-w-2xl px-4 py-10 pb-16">
          <div className="bg-white rounded-3xl border border-[#FFD5C0] shadow-[0_4px_32px_rgba(0,0,0,0.06)] p-6 md:p-10">
            <CreateStoryForm />
          </div>
        </div>

      </main>
    </>
  );
}
