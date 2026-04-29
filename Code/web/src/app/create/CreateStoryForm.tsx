"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { STORY_THEMES } from "@/lib/storyThemes";
import type { AgeBand, StoryTheme, StoryTrait } from "@/types/storybook";

// ── Constants ────────────────────────────────────────────────────────────────

const PERSONALITY_TRAITS: StoryTrait[] = ["Brave", "Curious", "Funny", "Kind"];
const TRAIT_ICONS: Record<StoryTrait, string> = {
  Brave: "🦁",
  Curious: "🔭",
  Funny: "😄",
  Kind: "💛",
};

const AGE_BANDS = [
  { value: "3-4" as AgeBand, label: "3–4 years", emoji: "🌱" },
  { value: "5-6" as AgeBand, label: "5–6 years", emoji: "⭐" },
  { value: "7-8" as AgeBand, label: "7–8 years", emoji: "🚀" },
];

const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;

const LOADING_STAGES = [
  { emoji: "📸", text: "Reading your child's details…" },
  { emoji: "🎭", text: "Crafting your hero's character…" },
  { emoji: "🌍", text: "Building the story world…" },
  { emoji: "✍️", text: "Writing the adventure…" },
  { emoji: "✨", text: "Weaving in the magic…" },
  { emoji: "📖", text: "Finishing the final pages…" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StoryCreationData {
  childName: string;
  ageBand: AgeBand | "";
  selectedTheme: StoryTheme | "";
  selectedTraits: StoryTrait[];
}

interface RequiredFieldErrors {
  childName: string;
  ageBand: string;
  selectedTheme: string;
}

interface FieldTouchedState {
  childName: boolean;
  ageBand: boolean;
  selectedTheme: boolean;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function StoryFormSection({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="mt-0.5 w-7 h-7 rounded-full bg-[#FC800A] text-white text-xs font-bold
                     flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(252,128,10,0.35)]"
        >
          {number}
        </span>
        <div>
          <legend className="text-base font-semibold text-[#171E45] leading-snug">{title}</legend>
          {hint && <p className="text-xs text-[#020202]/40 mt-0.5 leading-relaxed">{hint}</p>}
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </fieldset>
  );
}

function ValidationError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-red-500 flex items-center gap-1.5">
      <span aria-hidden="true">⚠</span>
      {message}
    </p>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function CreateStoryForm() {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user?.id;

  const [storyData, setStoryData] = useState<StoryCreationData>({
    childName: "",
    ageBand: "",
    selectedTheme: "",
    selectedTraits: [],
  });
  const [touched, setTouched] = useState<FieldTouchedState>({
    childName: false,
    ageBand: false,
    selectedTheme: false,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");
  const [stageIndex, setStageIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const activePhotoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (activePhotoUrlRef.current) URL.revokeObjectURL(activePhotoUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setStageIndex(0);
      setLoadingProgress(0);
      return;
    }
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + 0.28, 93);
      setLoadingProgress(p);
      setStageIndex(
        Math.min(
          Math.floor((p / 93) * LOADING_STAGES.length),
          LOADING_STAGES.length - 1
        )
      );
      if (p >= 93) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [isLoading]);

  // ── Derived state ──

  const errors: RequiredFieldErrors = {
    childName: !storyData.childName.trim() ? "Please enter your child's name." : "",
    ageBand: !storyData.ageBand ? "Please select an age group." : "",
    selectedTheme: !storyData.selectedTheme ? "Please choose a story theme." : "",
  };
  const isFormValid = !errors.childName && !errors.ageBand && !errors.selectedTheme;
  const shouldShowError = (field: keyof FieldTouchedState) =>
    (touched[field] || submitAttempted) && !!errors[field];

  // ── Handlers ──

  const handleChildNameChange = (value: string) =>
    setStoryData((prev) => ({ ...prev, childName: value }));
  const handleChildNameBlur = () =>
    setTouched((prev) => ({ ...prev, childName: true }));
  const handleAgeBandSelect = (band: AgeBand) => {
    setStoryData((prev) => ({ ...prev, ageBand: band }));
    setTouched((prev) => ({ ...prev, ageBand: true }));
  };
  const handleThemeSelect = (theme: StoryTheme) => {
    setStoryData((prev) => ({ ...prev, selectedTheme: theme }));
    setTouched((prev) => ({ ...prev, selectedTheme: true }));
  };
  const handleTraitToggle = (trait: StoryTrait) =>
    setStoryData((prev) => ({
      ...prev,
      selectedTraits: prev.selectedTraits.includes(trait)
        ? prev.selectedTraits.filter((t) => t !== trait)
        : [...prev.selectedTraits, trait],
    }));

  const handlePhotoFileSelected = (file: File) => {
    setPhotoError("");
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Photo must be under 4 MB. Please choose a smaller image.");
      return;
    }
    if (activePhotoUrlRef.current) URL.revokeObjectURL(activePhotoUrlRef.current);
    const newUrl = URL.createObjectURL(file);
    activePhotoUrlRef.current = newUrl;
    setPhotoFile(file);
    setPhotoPreviewUrl(newUrl);
  };
  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFileSelected(file);
  };
  const handlePhotoRemove = () => {
    if (activePhotoUrlRef.current) URL.revokeObjectURL(activePhotoUrlRef.current);
    activePhotoUrlRef.current = null;
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPhotoError("");
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isFormValid) return;

    // Block premium themes for guests
    const selectedThemeConfig = STORY_THEMES.find((t) => t.label === storyData.selectedTheme);
    if (selectedThemeConfig?.premium && !isSignedIn) {
      signIn("google");
      return;
    }

    setIsLoading(true);
    setApiError("");
    try {
      let uploadedImageBase64: string | undefined;
      let uploadedImageMimeType: string | undefined;
      let uploadedImageName: string | undefined;
      if (photoFile) {
        uploadedImageBase64 = await fileToBase64(photoFile);
        uploadedImageMimeType = photoFile.type;
        uploadedImageName = photoFile.name;
      }

      // Upload photo to profile (if signed in) in parallel with story generation
      const photoUploadPromise = (async () => {
        if (!uploadedImageBase64 || !isSignedIn) return undefined;
        try {
          const res = await fetch("/api/profile/photos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photoBase64: uploadedImageBase64,
              filename: uploadedImageName ?? photoFile?.name ?? "child-photo.jpg",
              mimeType: uploadedImageMimeType ?? photoFile?.type ?? "image/jpeg",
            }),
          });
          if (!res.ok) return undefined;
          const { photo } = await res.json() as { photo: { url: string } };
          return photo.url as string;
        } catch {
          return undefined;
        }
      })();

      const storyPromise = fetch("/api/generate-storybook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: storyData.childName,
          ageBand: storyData.ageBand as AgeBand,
          theme: storyData.selectedTheme as StoryTheme,
          traits: storyData.selectedTraits,
          ...(uploadedImageBase64 ? { uploadedImageBase64, uploadedImageMimeType, uploadedImageName } : {}),
        }),
      });

      const [res, childPhotoUrl] = await Promise.all([storyPromise, photoUploadPromise]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Story generation failed. Please try again.");

      sessionStorage.setItem("heroStorybookDraft", JSON.stringify({
        ...data,
        theme: storyData.selectedTheme,
        childPhotoUrl: childPhotoUrl ?? undefined,
        childPhotoBase64: uploadedImageBase64 ?? undefined,
        childPhotoMimeType: uploadedImageMimeType ?? undefined,
      }));
      router.push("/story-preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setApiError(message);
      setIsLoading(false);
    }
  };

  // ── Render ──

  if (isLoading) {
    const heroName = storyData.childName.trim().split(" ")[0] || "your child";
    const stage = LOADING_STAGES[stageIndex];
    return (
      <div className="flex flex-col items-center text-center gap-9 py-14 px-4 min-h-[420px] justify-center">
        {/* Bouncing stage emoji — key forces re-mount animation on change */}
        <div key={stageIndex} className="text-6xl animate-bounce" aria-hidden="true">
          {stage.emoji}
        </div>

        {/* Headline + stage message */}
        <div className="flex flex-col gap-1.5">
          <h2
            className="text-2xl text-[#171E45]"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            Creating {heroName}&apos;s story
          </h2>
          <p className="text-sm text-[#020202]/50">{stage.text}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-[280px] flex flex-col gap-2">
          <div
            className="h-2.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,213,192,0.5)" }}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${loadingProgress}%`,
                background: "linear-gradient(to right, #FC800A, #FFB178)",
              }}
            />
          </div>
          <p className="text-xs text-[#020202]/30 text-right">
            Takes about 30 seconds
          </p>
        </div>

        {/* Stage dots */}
        <div className="flex items-center gap-2" aria-hidden="true">
          {LOADING_STAGES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i < stageIndex
                  ? "w-2 h-2 bg-[#FC800A]"
                  : i === stageIndex
                  ? "w-3 h-3 bg-[#FC800A]/70"
                  : "w-2 h-2 bg-[#FFD5C0]"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10" suppressHydrationWarning>

      {/* ① Child's name */}
      <StoryFormSection number={1} title="What's your child's name?">
        <label htmlFor="childName-input" className="sr-only">Child's name</label>
        <input
          id="childName-input"
          type="text"
          value={storyData.childName}
          onChange={(e) => handleChildNameChange(e.target.value)}
          onBlur={handleChildNameBlur}
          suppressHydrationWarning
          placeholder="e.g. Emma"
          maxLength={40}
          autoComplete="off"
          aria-invalid={shouldShowError("childName")}
          aria-describedby={shouldShowError("childName") ? "childName-error" : undefined}
          className={`w-full rounded-2xl px-5 py-3.5 bg-[#FCF7EE] border-2 text-[#020202]
                      text-base placeholder:text-[#020202]/30 focus:outline-none focus:ring-2
                      transition-all duration-200
                      ${shouldShowError("childName")
                        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                        : "border-[#FFD5C0] focus:border-[#FC800A] focus:ring-[#FC800A]/15"
                      }`}
        />
        {shouldShowError("childName") && (
          <ValidationError id="childName-error" message={errors.childName} />
        )}
      </StoryFormSection>

      {/* ② Age group */}
      <StoryFormSection number={2} title="How old are they?">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Age group" aria-required="true">
          {AGE_BANDS.map(({ value, label, emoji }) => {
            const isSelected = storyData.ageBand === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleAgeBandSelect(value)}
                suppressHydrationWarning
                className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isSelected
                              ? "bg-[#FC800A] text-white border-2 border-[#FC800A] font-semibold shadow-[0_4px_14px_rgba(252,128,10,0.4)] scale-[1.04]"
                              : "bg-[#FCF7EE] text-[#171E45] border-2 border-[#FFD5C0] hover:border-[#FC800A]/40 hover:bg-[#FBF1E3]"
                            }`}
              >
                <span aria-hidden="true">{emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
        {shouldShowError("ageBand") && <ValidationError message={errors.ageBand} />}
      </StoryFormSection>

      {/* ③ Story theme — larger cards */}
      <StoryFormSection number={3} title="Choose a story world" hint="Your child will be the hero of this adventure">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Story theme" aria-required="true">
          {STORY_THEMES.map((theme) => {
            const isSelected = storyData.selectedTheme === theme.label;
            const isLocked = !!theme.premium && !isSignedIn;
            return (
              <button
                key={theme.label}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  if (isLocked) { signIn("google"); return; }
                  handleThemeSelect(theme.label as StoryTheme);
                }}
                suppressHydrationWarning
                className={`relative rounded-2xl p-5 flex flex-col gap-3 text-left
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isLocked ? "opacity-75 cursor-pointer" : ""}
                            ${isSelected
                              ? "border-2 scale-[1.03] shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
                              : "border-2 border-transparent hover:border-[#FFD5C0] hover:-translate-y-0.5 hover:shadow-md"
                            }`}
                style={{
                  backgroundColor: theme.bgColor,
                  borderColor: isSelected ? theme.accentColor : undefined,
                }}
              >
                {/* Lock badge for premium themes */}
                {isLocked && (
                  <span
                    className="absolute top-3 right-3 flex items-center gap-1 rounded-full px-2 py-0.5
                               bg-[#171E45]/10 text-[#171E45]/60 text-[10px] font-semibold"
                    aria-label="Sign in required"
                  >
                    <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M4 4.5V3a2 2 0 1 1 4 0v1.5h.5A1.5 1.5 0 0 1 10 6v4a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 2 10V6A1.5 1.5 0 0 1 3.5 4.5H4Zm1.5-1.5a.5.5 0 0 1 1 0V4.5h-1V3Z" clipRule="evenodd"/>
                    </svg>
                    Sign in
                  </span>
                )}

                {/* Selected checkmark */}
                {isSelected && !isLocked && (
                  <span
                    className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center
                               justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: theme.accentColor }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}

                {/* Icon — larger */}
                <span className="text-4xl" aria-hidden="true">{theme.icon}</span>

                <span
                  className="text-base font-semibold text-[#171E45] leading-tight"
                  style={{ fontFamily: "var(--font-rowdies)" }}
                >
                  {theme.label}
                </span>

                <span className="text-xs text-[#171E45]/55 leading-relaxed">
                  {theme.shortDescription}
                </span>
              </button>
            );
          })}
        </div>
        {shouldShowError("selectedTheme") && <ValidationError message={errors.selectedTheme} />}
      </StoryFormSection>

      {/* ④ Personality traits */}
      <StoryFormSection number={4} title="Any personality traits? (optional)" hint="We'll weave these into your child's character">
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Personality traits">
          {PERSONALITY_TRAITS.map((trait) => {
            const isSelected = storyData.selectedTraits.includes(trait);
            return (
              <button
                key={trait}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleTraitToggle(trait)}
                suppressHydrationWarning
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isSelected
                              ? "bg-[#FC800A] text-white border-2 border-[#FC800A] shadow-[0_3px_12px_rgba(252,128,10,0.35)]"
                              : "bg-[#FCF7EE] text-[#171E45]/65 border-2 border-[#FFD5C0] hover:border-[#FC800A]/40 hover:text-[#171E45]"
                            }`}
              >
                <span aria-hidden="true">{TRAIT_ICONS[trait]}</span>
                {trait}
              </button>
            );
          })}
        </div>
      </StoryFormSection>

      {/* ⑤ Photo upload — premium treatment */}
      <StoryFormSection number={5} title="Add a photo of your child" hint="Optional but recommended — helps us personalize the illustrations">
        {photoPreviewUrl && photoFile ? (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FCF7EE] border-2 border-[#FFD5C0]">
            <img
              src={photoPreviewUrl}
              alt="Uploaded photo preview"
              className="w-16 h-16 rounded-xl object-cover border-2 border-[#FFD5C0] shadow-sm flex-shrink-0"
            />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#171E45] truncate">{photoFile.name}</p>
              <p className="text-xs text-[#020202]/35">
                {(photoFile.size / 1024).toFixed(0)} KB
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  suppressHydrationWarning
                  className="text-xs font-semibold text-[#FC800A] hover:underline underline-offset-2 transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  suppressHydrationWarning
                  className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
            <span className="text-2xl flex-shrink-0" aria-hidden="true">✓</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            suppressHydrationWarning
            className="w-full rounded-2xl border-2 border-dashed border-[#FFD5C0] bg-[#FCF7EE]
                       flex flex-col items-center gap-3 py-10 px-6 cursor-pointer
                       hover:border-[#FC800A]/40 hover:bg-[#FBF1E3]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                       transition-all duration-200"
            aria-label="Upload a photo of your child"
          >
            {/* Camera icon in a warm circle */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl
                         shadow-[0_2px_10px_rgba(252,128,10,0.15)]"
              style={{ background: "linear-gradient(135deg, #FBF1E3 0%, #FFE8D0 100%)" }}
              aria-hidden="true"
            >
              📷
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-sm font-semibold text-[#171E45]/80">Upload a photo</span>
              <span className="text-sm text-[#020202]/45 max-w-[220px] leading-snug">
                We&apos;ll turn it into your child&apos;s illustrated story character
              </span>
            </div>
            <span className="text-xs text-[#020202]/30">JPG or PNG · max 4 MB</span>
          </button>
        )}

        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoInputChange}
          suppressHydrationWarning
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {photoError && <ValidationError message={photoError} />}

        <p className="mt-3 text-xs text-[#020202]/35 flex items-center gap-1.5">
          <span aria-hidden="true">🔒</span>
          {isSignedIn
            ? "Photo saved to your profile library for future stories."
            : "Your photo is used only to generate this story and is never stored."}
        </p>
      </StoryFormSection>

      {/* ── Submit ── */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          suppressHydrationWarning
          aria-disabled={!isFormValid || isLoading}
          className={`w-full sm:w-auto rounded-full px-12 py-4 text-base font-semibold
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                      transition-[background-color,transform,box-shadow,opacity] duration-200
                      ${isFormValid && !isLoading
                        ? `bg-[#FC800A] text-white
                           shadow-[0_6px_24px_rgba(252,128,10,0.42)]
                           hover:bg-[#e5720a] hover:-translate-y-0.5
                           hover:shadow-[0_10px_30px_rgba(252,128,10,0.52)]
                           active:scale-[0.97]`
                        : isLoading
                          ? "bg-[#FC800A]/80 text-white cursor-wait"
                          : "bg-[#FCF7EE] text-[#020202]/25 border-2 border-[#FFD5C0] cursor-not-allowed"
                      }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2.5">
              <svg
                className="animate-spin w-4 h-4 text-white flex-shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <title>Creating story</title>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating your story…
            </span>
          ) : (
            "✦ Create My Story"
          )}
        </button>

        {submitAttempted && !isFormValid && !isLoading && (
          <p role="alert" className="text-sm text-red-500 text-center">
            Please complete the required fields above.
          </p>
        )}

        {apiError && (
          <p role="alert" className="text-sm text-red-500 text-center max-w-sm leading-relaxed">
            {apiError}
          </p>
        )}

        {!isLoading && (
          <p className="text-xs text-[#020202]/35 text-center">
            {isSignedIn
              ? "All 6 story worlds unlocked · Ready in about 30 seconds"
              : "Sign in to unlock 3 more story worlds · Ready in about 30 seconds"}
          </p>
        )}
      </div>

    </form>
  );
}
