const BRAND_ORANGE = "#FC800A";
const BRAND_NAVY = "#171E45";
const BRAND_PEACH = "#FFD5C0";
const BRAND_CREAM = "#FBF1E3";
const BRAND_LAVENDER = "#F0EFFE";

export default function HeroSection() {
  return (
    <section id="hero-story-section" className="relative overflow-hidden bg-[#FCF7EE]">
      {/* Layered radial depth — three overlapping halos for visual richness */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full"
        style={{ background: `radial-gradient(circle, ${BRAND_PEACH} 0%, transparent 65%)`, opacity: 0.35 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-10 h-64 w-64 rounded-full"
        style={{ background: `radial-gradient(circle, ${BRAND_ORANGE} 0%, transparent 70%)`, opacity: 0.08 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full"
        style={{ background: `radial-gradient(circle, ${BRAND_ORANGE} 0%, transparent 70%)`, opacity: 0.15 }}
      />

      <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

          {/* ── Left: copy and CTAs ── */}
          <div className="flex flex-col gap-5">

            {/* Eyebrow pill */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FBF1E3] border border-[#FFD5C0] px-4 py-1.5">
              <span aria-hidden="true">✨</span>
              <span className="text-sm font-medium text-[#FC800A]">Personalized for your child</span>
            </div>

            {/* Hero headline — Rowdies display font, premium tight spacing */}
            <h1
              className="text-5xl md:text-[3.6rem] leading-[1.08] tracking-[-0.025em] text-[#171E45]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              Make your child{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-[#FC800A]">the hero</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 220 10"
                  className="absolute -bottom-1 left-0 w-full"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8C40 2.5 90 1 218 4"
                    stroke={BRAND_ORANGE}
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                </svg>
              </span>{" "}
              of a story
            </h1>

            {/* Subtext — Roboto, body weight */}
            <p className="text-lg text-[#020202]/65 leading-relaxed max-w-[420px]">
              Create a personalized illustrated story in minutes using your child&apos;s name,
              photo, and favorite adventure theme.
            </p>

            {/* CTA group */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {/* Primary CTA */}
              <button
                id="landing-primary-cta"
                className="rounded-full bg-[#FC800A] px-8 py-3.5 text-base font-semibold text-white
                           shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                           hover:bg-[#e5720a] hover:shadow-[0_8px_26px_rgba(252,128,10,0.48)] hover:-translate-y-0.5
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
              >
                Create Your Story
              </button>

              {/* Secondary CTA — text style, clearly subordinate */}
              <button
                className="px-4 py-3.5 text-base font-medium text-[#171E45]/70
                           underline underline-offset-4 decoration-[#171E45]/25
                           hover:text-[#FC800A] hover:decoration-[#FC800A]/40
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171E45]
                           active:opacity-70 transition-all duration-200"
              >
                See examples
              </button>
            </div>

            {/* Emotional tagline */}
            <p className="text-sm italic text-[#020202]/55 -mt-1 max-w-xs leading-snug">
              Watch their face light up when they see themselves in the story.
            </p>

            {/* Trust signal — slightly more visible */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[#88B520] text-base" aria-hidden="true">✓</span>
              <p className="text-sm font-medium text-[#020202]/65 tracking-wide">
                No sign-up required &middot; Ready in minutes
              </p>
            </div>
          </div>

          {/* ── Right: story preview panel ── */}
          <div className="flex justify-center md:justify-end">
            <div id="story-preview-panel" className="relative w-80 md:w-96">

              {/* Storybook page frame */}
              <div className="rounded-3xl bg-white border-2 border-[#FFD5C0] shadow-[0_20px_60px_rgba(252,128,10,0.14)] overflow-hidden">

                {/* Title banner */}
                <div
                  className="px-5 py-3 flex items-center justify-between"
                  style={{ backgroundColor: BRAND_ORANGE }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white text-lg" aria-hidden="true">📖</span>
                    <span
                      className="text-white text-sm font-semibold"
                      style={{ fontFamily: "var(--font-rowdies)" }}
                    >
                      Emma&apos;s Space Adventure
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white/40" />
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>

                {/* Comic panels */}
                <div className="grid grid-cols-2 gap-2 p-3">

                  {/* Character panel */}
                  <div
                    className="col-span-1 row-span-2 rounded-2xl p-3 flex flex-col items-center justify-center gap-2 min-h-[140px]"
                    style={{ backgroundColor: BRAND_NAVY }}
                  >
                    <div
                      className="w-14 h-14 rounded-full border-2 border-white shadow-md flex items-center justify-center"
                      style={{ backgroundColor: BRAND_ORANGE }}
                    >
                      <span className="text-2xl">👧</span>
                    </div>
                    <div className="text-center">
                      <div
                        className="text-white text-xs font-bold"
                        style={{ fontFamily: "var(--font-rowdies)" }}
                      >
                        Emma
                      </div>
                      <div className="text-white/60 text-[10px]">Space Captain</div>
                    </div>
                    <div className="flex gap-1">
                      <span className="text-[10px]">⭐</span>
                      <span className="text-[10px]">✨</span>
                      <span className="text-[10px]">⭐</span>
                    </div>
                  </div>

                  {/* Scene panel */}
                  <div
                    className="rounded-2xl p-2 flex flex-col items-center justify-center gap-1"
                    style={{ backgroundColor: BRAND_CREAM }}
                  >
                    <span className="text-3xl">🚀</span>
                    <div className="w-full space-y-1">
                      <div className="h-1.5 rounded-full bg-[#FC800A]/30" />
                      <div className="h-1.5 rounded-full bg-[#FC800A]/20 w-4/5" />
                    </div>
                  </div>

                  {/* Speech bubble panel */}
                  <div
                    className="rounded-2xl p-2 flex flex-col justify-center"
                    style={{ backgroundColor: BRAND_LAVENDER }}
                  >
                    <div className="bg-white rounded-xl rounded-bl-none px-2 py-1.5 shadow-sm">
                      <p className="text-[10px] text-[#171E45] font-medium leading-tight">
                        &ldquo;To infinity and beyond!&rdquo;
                      </p>
                    </div>
                    <div
                      className="w-0 h-0 ml-3"
                      style={{
                        borderLeft: "6px solid transparent",
                        borderRight: "0",
                        borderTop: "6px solid white",
                      }}
                    />
                  </div>
                </div>

                {/* Page footer */}
                <div className="px-4 py-2.5 border-t border-[#FFD5C0] flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-[10px]">⭐</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-[#020202]/40 font-medium">Page 1 of your story</span>
                </div>
              </div>

              {/* Floating label badge */}
              <div className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full bg-white border border-[#FFD5C0] shadow-md px-3 py-1.5">
                <span className="text-sm">🌟</span>
                <span className="text-xs font-semibold text-[#171E45]">Your child&apos;s story</span>
              </div>

              <span className="absolute -bottom-3 -left-2 text-2xl" aria-hidden="true">✨</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
