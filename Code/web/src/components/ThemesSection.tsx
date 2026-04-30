import { STORY_THEMES, type StoryThemeConfig } from "@/lib/storyThemes";

function StoryThemeCard({ theme }: { theme: StoryThemeConfig }) {
  return (
    <article
      className="group relative overflow-hidden rounded-3xl p-7 flex flex-col gap-5 text-left w-full
                 shadow-[0_4px_20px_rgba(0,0,0,0.05)]
                 hover:scale-[1.025] hover:shadow-[0_16px_44px_rgba(0,0,0,0.12)]
                 transition-all duration-300"
      style={{ backgroundColor: theme.bgColor }}
      aria-label={`${theme.label} story theme`}
    >
      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-40 h-40 opacity-25 rounded-full
                   transition-opacity duration-300 group-hover:opacity-40"
        style={{
          background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />

      {/* Ambient decoration */}
      <span aria-hidden="true" className="absolute top-5 right-6 text-xl opacity-25 group-hover:opacity-40 transition-opacity duration-300">
        {theme.decorations[1]}
      </span>
      <span aria-hidden="true" className="absolute bottom-8 right-7 text-sm opacity-15 group-hover:opacity-25 transition-opacity duration-300">
        {theme.decorations[2]}
      </span>

      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl
                   shadow-[0_2px_10px_rgba(0,0,0,0.07)] transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundColor: theme.iconBg }}
      >
        {theme.icon}
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-2 flex-1">
        <h3
          className="text-2xl leading-tight text-[#171E45]"
          style={{ fontFamily: "var(--font-rowdies)" }}
        >
          {theme.label}
        </h3>
        <p className="text-sm leading-relaxed text-[#171E45]/55">
          {theme.description}
        </p>
      </div>

      {/* Bottom row: theme tag */}
      <div className="flex items-center pt-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: theme.tagBg, color: theme.tagText }}
        >
          <span aria-hidden="true">{theme.decorations[0]}</span>
          {theme.label}
        </span>
      </div>
    </article>
  );
}

export default function ThemesSection() {
  return (
    <section id="story-themes-section" className="bg-[#FBF1E3] py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-5">

        {/* Section header */}
        <div className="text-center mb-10 flex flex-col gap-3 items-center">
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

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STORY_THEMES.map((theme) => (
            <StoryThemeCard key={theme.label} theme={theme} />
          ))}
        </div>

      </div>
    </section>
  );
}
