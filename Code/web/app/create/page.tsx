import Header from "../components/Header";
import CreateStoryForm from "./CreateStoryForm";

export default function CreateStoryPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#FCF7EE]">

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
