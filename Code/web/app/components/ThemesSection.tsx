import { STORY_THEMES, type StoryTheme } from "../lib/storyThemes";

function StoryThemeCard({ theme }: { theme: StoryTheme }) {
  return (
    <button
      type="button"
      className="relative overflow-hidden rounded-3xl p-7 flex flex-col gap-5 text-left w-full
                 shadow-[0_4px_20px_rgba(0,0,0,0.06)]
                 hover:scale-[1.025] hover:shadow-[0_14px_36px_rgba(0,0,0,0.13)]
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                 active:scale-[0.99]
                 transition-all duration-300 cursor-pointer"
      style={{ backgroundColor: theme.bgColor }}
      aria-label={`Select ${theme.label} as your story theme`}
    >
      {/* Radial glow in top-right corner */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-36 h-36 opacity-20 rounded-full"
        style={{
          background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
          transform: "translate(30%, -30%)",
        }}
      />

      {/* Ambient decoration emojis */}
      <span aria-hidden="true" className="absolute top-5 right-6 text-xl opacity-30">
        {theme.decorations[1]}
      </span>
      <span aria-hidden="true" className="absolute bottom-8 right-8 text-sm opacity-20">
        {theme.decorations[2]}
      </span>

      {/* Theme icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl
                   shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
        style={{ backgroundColor: theme.iconBg }}
      >
        {theme.icon}
      </div>

      {/* Title and description */}
      <div className="flex flex-col gap-2 flex-1">
        <h3
          className="text-2xl leading-tight text-[#171E45]"
          style={{ fontFamily: "var(--font-rowdies)" }}
        >
          {theme.label}
        </h3>
        <p className="text-sm leading-relaxed text-[#171E45]/60">
          {theme.description}
        </p>
      </div>

      {/* Theme identifier pill */}
      <div className="pt-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: theme.tagBg, color: theme.tagText }}
        >
          <span aria-hidden="true">{theme.decorations[0]}</span>
          {theme.label}
        </span>
      </div>
    </button>
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
          <p className="text-base text-[#020202]/60 max-w-md leading-relaxed">
            Every story starts with a world. Pick a theme and we&apos;ll craft a tale made just for your little one.
          </p>
        </div>

        {/* Theme cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STORY_THEMES.map((theme) => (
            <StoryThemeCard key={theme.id} theme={theme} />
          ))}
        </div>

      </div>
    </section>
  );
}
