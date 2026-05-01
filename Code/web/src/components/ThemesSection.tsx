import { STORY_THEMES, type StoryThemeConfig } from "@/lib/storyThemes";

function StoryThemeCard({ theme }: { theme: StoryThemeConfig }) {
  return (
    <article
      className="group relative overflow-hidden rounded-3xl flex flex-col text-left
                 bg-white
                 shadow-[0_4px_24px_rgba(0,0,0,0.07)]
                 hover:shadow-[0_16px_48px_rgba(0,0,0,0.14)]
                 hover:-translate-y-1.5
                 transition-all duration-300"
      aria-label={`${theme.label} story theme`}
    >
      {/* ── Immersive hero zone ── */}
      <div className="relative overflow-hidden w-full" style={{ height: "15rem" }}>

        {/* Background image or gradient fallback */}
        {theme.backgroundImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={theme.backgroundImageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: `linear-gradient(145deg, ${theme.accentColor} 0%, ${theme.glowColor} 100%)` }}
          />
        )}

        {/* Dark scrim for contrast */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/55" />

        {/* Radial spotlight */}
        <div aria-hidden="true" className="absolute inset-0" style={{
          background: `radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 100%)`,
        }} />

        {/* Far-depth decoration — very large, very faded, bottom-right */}
        <span
          aria-hidden="true"
          className="absolute -bottom-6 -right-6 text-[9rem] opacity-[0.08] group-hover:opacity-[0.13] group-hover:scale-105 transition-all duration-700 select-none"
          style={{ lineHeight: 1 }}
        >
          {theme.decorations[2]}
        </span>

        {/* Mid-depth decoration — top-left, mid size */}
        <span
          aria-hidden="true"
          className="absolute top-4 left-5 text-3xl opacity-50 group-hover:opacity-75 group-hover:-translate-y-1 transition-all duration-500 select-none"
          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
        >
          {theme.decorations[1]}
        </span>

        {/* Mid-depth decoration — bottom-left, small */}
        <span
          aria-hidden="true"
          className="absolute bottom-10 left-5 text-2xl opacity-40 group-hover:opacity-65 group-hover:translate-y-[-4px] transition-all duration-600 select-none"
          style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}
        >
          {theme.decorations[0]}
        </span>

        {/* Hero icon — massive, centered, glowing white halo */}
        <div className="absolute inset-0 flex items-center justify-center pb-7">
          <span
            className="text-[6.5rem] group-hover:scale-[1.12] transition-transform duration-300 select-none"
            aria-hidden="true"
            style={{
              lineHeight: 1,
              filter: `drop-shadow(0 0 28px rgba(255,255,255,0.6)) drop-shadow(0 8px 20px rgba(0,0,0,0.5))`,
            }}
          >
            {theme.icon}
          </span>
        </div>

        {/* Bottom gradient scrim + title */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent px-5 pb-3 pt-8">
          <h3
            className="text-white text-xl leading-tight"
            style={{
              fontFamily: "var(--font-rowdies)",
              textShadow: "0 1px 8px rgba(0,0,0,0.6)",
            }}
          >
            {theme.label}
          </h3>
        </div>

        {/* Sign-in badge */}
        {theme.premium && (
          <span
            className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1
                       text-[10px] font-bold uppercase tracking-wide
                       bg-white/20 backdrop-blur-sm text-white/90 border border-white/30"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
            </svg>
            Sign in
          </span>
        )}
      </div>

      {/* ── Content zone ── */}
      <div className="flex flex-col gap-3 px-5 py-4 flex-1">
        <p className="text-sm leading-relaxed text-[#171E45]/80 flex-1">
          {theme.shortDescription}
        </p>

        {/* Tag */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold self-start"
          style={{ backgroundColor: theme.tagBg, color: theme.tagText }}
        >
          <span aria-hidden="true">{theme.decorations[0]}</span>
          {theme.label}
        </span>
      </div>

      {/* Bottom accent bar */}
      <div
        className="h-1 w-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, ${theme.accentColor}, ${theme.glowColor})` }}
      />
    </article>
  );
}

export default function ThemesSection() {
  const freeThemes = STORY_THEMES.filter((t) => !t.premium);
  const premiumThemes = STORY_THEMES.filter((t) => t.premium);

  return (
    <section id="story-themes-section" className="bg-[#FBF1E3] py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-5">

        {/* Section header */}
        <div className="text-center mb-12 flex flex-col gap-3 items-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FCF7EE] border border-[#FFD5C0] px-4 py-1.5 text-sm font-medium text-[#FC800A]">
            <span aria-hidden="true">🎨</span> Pick a world
          </span>
          <h2
            className="text-4xl md:text-5xl text-[#171E45] leading-tight tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            Choose your adventure
          </h2>
          <p className="text-base text-[#020202]/55 max-w-sm leading-relaxed">
            Every great story begins with a world. Pick a theme and your child becomes the hero.
          </p>
        </div>

        {/* Free themes */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold uppercase tracking-widest text-[#020202]/30">Free</span>
            <div className="flex-1 h-px bg-[#020202]/10" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {freeThemes.map((theme) => (
              <StoryThemeCard key={theme.label} theme={theme} />
            ))}
          </div>
        </div>

        {/* Premium themes */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FC800A]/70">
              🔐 Sign in to unlock
            </span>
            <div className="flex-1 h-px bg-[#FC800A]/20" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {premiumThemes.map((theme) => (
              <StoryThemeCard key={theme.label} theme={theme} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
