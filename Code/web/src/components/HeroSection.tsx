"use client";

import { useRouter } from "next/navigation";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section id="hero-story-section" className="relative overflow-hidden bg-[#FCF7EE]">
      {/* Radial depth halos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full"
        style={{ background: "radial-gradient(circle, #FFD5C0 0%, transparent 65%)", opacity: 0.4 }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, #FC800A 0%, transparent 70%)", opacity: 0.12 }}
      />

      <div className="mx-auto max-w-6xl px-5 py-12 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* ── Left: copy and CTAs ── */}
          <div className="flex flex-col gap-5">

            {/* Eyebrow pill */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#FBF1E3] border border-[#FFD5C0] px-4 py-1.5">
              <span aria-hidden="true">✨</span>
              <span className="text-sm font-medium text-[#FC800A]">Personalized for your child</span>
            </div>

            {/* Headline */}
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
                    stroke="#FC800A"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                </svg>
              </span>{" "}
              of their own story
            </h1>

            {/* Subtext */}
            <p className="text-lg text-[#020202]/65 leading-relaxed max-w-[420px]">
              Upload a photo, pick a theme, and we&apos;ll create a beautifully illustrated storybook
              with your child as the star.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                id="landing-primary-cta"
                onClick={() => router.push("/create")}
                className="rounded-full bg-[#FC800A] px-8 py-3.5 text-base font-semibold text-white
                           shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                           hover:bg-[#e5720a] hover:shadow-[0_8px_26px_rgba(252,128,10,0.48)] hover:-translate-y-0.5
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
              >
                Create your story →
              </button>
              <a
                href="#story-themes-section"
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#171E45]/12
                           px-6 py-3.5 text-base font-medium text-[#171E45]/65
                           hover:border-[#FC800A]/30 hover:text-[#FC800A]
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171E45]
                           transition-all duration-200"
              >
                See story themes
              </a>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[#88B520] text-base" aria-hidden="true">✓</span>
              <p className="text-sm font-medium text-[#020202]/55">
                No account needed &middot; Ready in about 30 seconds
              </p>
            </div>
          </div>

          {/* ── Right: storybook cover visual ── */}
          <div className="flex justify-center md:justify-end">
            <div className="relative">

              {/* Ambient glow behind book */}
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 scale-110 blur-3xl opacity-25 rounded-full"
                style={{ background: "radial-gradient(circle, #FC800A 0%, #FFD5C0 60%, transparent 100%)" }}
              />

              {/* Storybook cover card */}
              <div
                className="relative w-60 sm:w-64 md:w-72 rounded-[24px] overflow-hidden"
                style={{
                  boxShadow:
                    "0 32px 80px rgba(23,30,69,0.22), 0 8px 24px rgba(252,128,10,0.16), 0 0 0 1px rgba(255,213,192,0.7)",
                }}
              >
                {/* Illustration area — adventure night sky */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: "260px",
                    background: "linear-gradient(170deg, #0f1b4d 0%, #1a2d6d 45%, #2a4a9f 80%, #1c3a7a 100%)",
                  }}
                >
                  {/* Star field */}
                  {[
                    { top: "12%", left: "18%", size: "text-xs", opacity: 0.8 },
                    { top: "8%", left: "60%", size: "text-[10px]", opacity: 0.6 },
                    { top: "22%", right: "14%", size: "text-[8px]", opacity: 0.7 },
                    { top: "35%", left: "8%", size: "text-[8px]", opacity: 0.5 },
                    { top: "15%", left: "40%", size: "text-[10px]", opacity: 0.9 },
                    { top: "50%", right: "8%", size: "text-xs", opacity: 0.4 },
                    { top: "42%", left: "28%", size: "text-[8px]", opacity: 0.6 },
                  ].map((s, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      className={`absolute ${s.size} text-yellow-200 select-none`}
                      style={{ top: s.top, left: s.left, right: s.right, opacity: s.opacity }}
                    >
                      ★
                    </span>
                  ))}

                  {/* Magic sparkles */}
                  <span
                    aria-hidden="true"
                    className="absolute text-yellow-300/60 text-lg select-none"
                    style={{ top: "28%", left: "62%" }}
                  >
                    ✦
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute text-yellow-200/40 text-sm select-none"
                    style={{ top: "60%", left: "15%" }}
                  >
                    ✦
                  </span>

                  {/* Adventure scene */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="text-6xl" aria-hidden="true">🚀</span>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-2xl
                                 border-[3px] border-white/80"
                      style={{
                        background: "linear-gradient(135deg, #FC800A 0%, #e5720a 100%)",
                        boxShadow: "0 4px 16px rgba(252,128,10,0.5)",
                      }}
                      aria-label="Child hero"
                    >
                      👧
                    </div>
                  </div>

                  {/* Gradient fade into title strip */}
                  <div
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, transparent, #FBF1E3)" }}
                  />
                </div>

                {/* Title strip */}
                <div className="bg-[#FBF1E3] px-5 pt-1 pb-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-[#FC800A] mb-1">
                    A Hero Storybook
                  </p>
                  <h3
                    className="text-xl text-[#171E45] leading-tight"
                    style={{ fontFamily: "var(--font-rowdies)" }}
                  >
                    Emma&apos;s Space Adventure
                  </h3>
                  {/* Page thumbnail row */}
                  <div className="flex items-center gap-1.5 mt-3">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div
                        key={n}
                        className="w-7 h-8 rounded-md flex items-center justify-center text-[9px] font-bold
                                   text-[#FC800A]"
                        style={{ background: "rgba(252,128,10,0.10)" }}
                        aria-hidden="true"
                      >
                        {n}
                      </div>
                    ))}
                    <span className="text-[10px] text-[#020202]/35 ml-1">pages</span>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div
                className="absolute -top-3 -left-4 rounded-full bg-white border border-[#FFD5C0]
                           shadow-[0_4px_16px_rgba(0,0,0,0.10)] px-3 py-1.5 flex items-center gap-1.5"
              >
                <span className="text-sm" aria-hidden="true">🌟</span>
                <span className="text-xs font-semibold text-[#171E45]">Your child&apos;s story</span>
              </div>

              {/* Floating page count badge */}
              <div
                className="absolute -bottom-3 right-5 rounded-full px-3 py-1.5
                           shadow-[0_4px_14px_rgba(252,128,10,0.4)]"
                style={{ background: "#FC800A" }}
              >
                <span className="text-xs font-semibold text-white">6 illustrated pages</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
