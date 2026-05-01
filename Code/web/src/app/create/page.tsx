import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/config";
import CreateStoryForm from "./CreateStoryForm";

export default async function CreateStoryPage() {
  const session = await auth();
  const isAdmin = isAdminEmail(session?.user?.email);

  return (
    <main className="min-h-screen bg-[#FCF7EE]">

        {/* Slim progress bar */}
        <div className="bg-[#FCF7EE] border-b border-[#FFD5C0]/50">
          <div className="mx-auto max-w-5xl px-4 md:px-5 py-3 flex items-center gap-3">
            <span className="text-xs font-medium text-[#020202]/40 flex-shrink-0">Step 1 of 2</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,213,192,0.5)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: "50%", background: "linear-gradient(to right, #FC800A, #e5720a)" }}
              />
            </div>
            <span className="text-xs font-medium text-[#020202]/30 flex-shrink-0">Preview</span>
          </div>
        </div>

        {/* Page hero */}
        <div className="bg-[#FBF1E3] border-b border-[#FFD5C0]">
          <div className="mx-auto max-w-5xl px-4 md:px-5 py-10 md:py-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#FCF7EE] border border-[#FFD5C0] px-4 py-1.5 mb-4">
              <span aria-hidden="true">📖</span>
              <span className="text-sm font-medium text-[#FC800A]">Start your child&apos;s adventure</span>
            </div>
            <h1
              className="text-4xl md:text-5xl text-[#171E45] leading-tight tracking-[-0.025em]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              Create Your Story
            </h1>
            <p className="mt-3 text-base md:text-lg text-[#020202]/60 leading-relaxed max-w-md mx-auto">
              Tell us about your little hero and we&apos;ll craft a personalized
              illustrated adventure just for them.
            </p>
          </div>
        </div>

        {/* Form — wider on desktop */}
        <div className="mx-auto max-w-5xl px-4 py-8 md:py-10 pb-20">
          <div className="bg-white rounded-3xl border border-[#FFD5C0] shadow-[0_4px_40px_rgba(0,0,0,0.05)] p-6 md:p-12">
            <CreateStoryForm isAdmin={isAdmin} />
          </div>
        </div>

    </main>
  );
}
