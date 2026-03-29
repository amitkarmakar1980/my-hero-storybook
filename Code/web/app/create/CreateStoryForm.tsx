"use client";

import { useState, useEffect, useRef } from "react";
import { STORY_THEMES } from "../lib/storyThemes";

// ── Constants ────────────────────────────────────────────────────────────────

const PERSONALITY_TRAITS = ["Brave", "Curious", "Funny", "Kind"] as const;
type PersonalityTrait = (typeof PERSONALITY_TRAITS)[number];

const AGE_BANDS = [
  { value: "3-4", label: "3–4 years" },
  { value: "5-6", label: "5–6 years" },
  { value: "7-8", label: "7–8 years" },
] as const;
type AgeBand = (typeof AGE_BANDS)[number]["value"];

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Types ────────────────────────────────────────────────────────────────────

interface StoryCreationData {
  childName: string;
  ageBand: AgeBand | "";
  selectedThemeId: string;
  selectedTraits: PersonalityTrait[];
}

interface RequiredFieldErrors {
  childName: string;
  ageBand: string;
  selectedThemeId: string;
}

interface FieldTouchedState {
  childName: boolean;
  ageBand: boolean;
  selectedThemeId: boolean;
}

// ── Sub-components ───────────────────────────────────────────────────────────

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
    <fieldset className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 w-6 h-6 rounded-full bg-[#FC800A] text-white text-xs font-bold
                     flex items-center justify-center flex-shrink-0"
        >
          {number}
        </span>
        <div>
          <legend className="text-base font-semibold text-[#171E45] leading-snug">{title}</legend>
          {hint && <p className="text-xs text-[#020202]/45 mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="pl-9">{children}</div>
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

function SectionDivider() {
  return <hr className="border-[#FFD5C0]" />;
}

// ── Success screen ───────────────────────────────────────────────────────────

function StoryCreationSuccess({ childName, themeId }: { childName: string; themeId: string }) {
  const theme = STORY_THEMES.find((t) => t.id === themeId);
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <span className="text-6xl" aria-hidden="true">
        {theme?.icon ?? "📖"}
      </span>
      <div className="flex flex-col gap-2">
        <h2
          className="text-3xl text-[#171E45]"
          style={{ fontFamily: "var(--font-rowdies)" }}
        >
          {childName}&apos;s story is on its way!
        </h2>
        <p className="text-base text-[#020202]/60 max-w-sm mx-auto leading-relaxed">
          We&apos;re crafting a personalized {theme?.label} adventure.
          It will be ready in just a moment.
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-[#FBF1E3] border border-[#FFD5C0] px-5 py-2.5">
        <span className="text-[#88B520]" aria-hidden="true">✓</span>
        <span className="text-sm font-medium text-[#171E45]">Story request received</span>
      </div>
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function CreateStoryForm() {
  const [storyData, setStoryData] = useState<StoryCreationData>({
    childName: "",
    ageBand: "",
    selectedThemeId: "",
    selectedTraits: [],
  });

  const [touched, setTouched] = useState<FieldTouchedState>({
    childName: false,
    ageBand: false,
    selectedThemeId: false,
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string>("");

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const activePhotoUrlRef = useRef<string | null>(null);

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (activePhotoUrlRef.current) URL.revokeObjectURL(activePhotoUrlRef.current);
    };
  }, []);

  // ── Derived state ──

  const errors: RequiredFieldErrors = {
    childName: !storyData.childName.trim() ? "Please enter your child's name." : "",
    ageBand: !storyData.ageBand ? "Please select an age group." : "",
    selectedThemeId: !storyData.selectedThemeId ? "Please choose a story theme." : "",
  };

  const isFormValid = !errors.childName && !errors.ageBand && !errors.selectedThemeId;

  const shouldShowError = (field: keyof FieldTouchedState) =>
    (touched[field] || submitAttempted) && !!errors[field];

  // ── Handlers ──

  const handleChildNameChange = (value: string) => {
    setStoryData((prev) => ({ ...prev, childName: value }));
  };

  const handleChildNameBlur = () => {
    setTouched((prev) => ({ ...prev, childName: true }));
  };

  const handleAgeBandSelect = (band: AgeBand) => {
    setStoryData((prev) => ({ ...prev, ageBand: band }));
    setTouched((prev) => ({ ...prev, ageBand: true }));
  };

  const handleThemeSelect = (themeId: string) => {
    setStoryData((prev) => ({ ...prev, selectedThemeId: themeId }));
    setTouched((prev) => ({ ...prev, selectedThemeId: true }));
  };

  const handleTraitToggle = (trait: PersonalityTrait) => {
    setStoryData((prev) => ({
      ...prev,
      selectedTraits: prev.selectedTraits.includes(trait)
        ? prev.selectedTraits.filter((t) => t !== trait)
        : [...prev.selectedTraits, trait],
    }));
  };

  const handlePhotoFileSelected = (file: File) => {
    setPhotoError("");
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Photo must be under 10 MB. Please choose a smaller image.");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isFormValid) return;

    // TODO: connect to backend — send storyData + photoFile
    console.log("Story creation submitted:", { ...storyData, photoFile });
    setIsSubmitted(true);
  };

  // ── Render ──

  if (isSubmitted) {
    return (
      <StoryCreationSuccess
        childName={storyData.childName}
        themeId={storyData.selectedThemeId}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">

      {/* ① Child's name */}
      <StoryFormSection number={1} title="What's your child's name?">
        <input
          type="text"
          value={storyData.childName}
          onChange={(e) => handleChildNameChange(e.target.value)}
          onBlur={handleChildNameBlur}
          placeholder="e.g. Emma"
          maxLength={40}
          autoComplete="off"
          aria-invalid={shouldShowError("childName")}
          aria-describedby={shouldShowError("childName") ? "childName-error" : undefined}
          className={`w-full rounded-xl px-4 py-3 bg-[#FCF7EE] border text-[#020202]
                      placeholder:text-[#020202]/30 focus:outline-none focus:ring-2
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

      <SectionDivider />

      {/* ② Age group */}
      <StoryFormSection number={2} title="How old are they?">
        <div
          className="flex flex-wrap gap-3"
          role="radiogroup"
          aria-label="Age group"
          aria-required="true"
        >
          {AGE_BANDS.map(({ value, label }) => {
            const isSelected = storyData.ageBand === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleAgeBandSelect(value as AgeBand)}
                className={`rounded-full px-6 py-2.5 text-sm font-medium
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isSelected
                              ? "bg-[#FC800A] text-white border-2 border-[#FC800A] font-semibold shadow-[0_3px_10px_rgba(252,128,10,0.3)]"
                              : "bg-[#FCF7EE] text-[#171E45] border-2 border-[#FFD5C0] hover:border-[#FC800A]/40 hover:bg-[#FBF1E3]"
                            }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {shouldShowError("ageBand") && (
          <ValidationError message={errors.ageBand} />
        )}
      </StoryFormSection>

      <SectionDivider />

      {/* ③ Story theme */}
      <StoryFormSection
        number={3}
        title="Choose a story world"
        hint="Your child will be the hero of this adventure"
      >
        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          role="radiogroup"
          aria-label="Story theme"
          aria-required="true"
        >
          {STORY_THEMES.map((theme) => {
            const isSelected = storyData.selectedThemeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleThemeSelect(theme.id)}
                className={`relative rounded-2xl p-4 flex flex-col gap-2 text-left
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            hover:-translate-y-0.5 hover:shadow-md
                            transition-all duration-200
                            ${isSelected
                              ? "border-2 shadow-md"
                              : "border-2 border-transparent hover:border-[#FFD5C0]"
                            }`}
                style={{
                  backgroundColor: theme.bgColor,
                  borderColor: isSelected ? theme.accentColor : undefined,
                }}
              >
                {/* Selected checkmark */}
                {isSelected && (
                  <span
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center
                               justify-center text-white text-[10px] font-bold shadow-sm"
                    style={{ backgroundColor: theme.accentColor }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}

                <span className="text-2xl" aria-hidden="true">{theme.icon}</span>

                <span
                  className="text-sm font-semibold text-[#171E45] leading-tight"
                  style={{ fontFamily: "var(--font-rowdies)" }}
                >
                  {theme.label}
                </span>

                <span className="text-xs text-[#171E45]/55 leading-snug">
                  {theme.shortDescription}
                </span>
              </button>
            );
          })}
        </div>
        {shouldShowError("selectedThemeId") && (
          <ValidationError message={errors.selectedThemeId} />
        )}
      </StoryFormSection>

      <SectionDivider />

      {/* ④ Personality traits */}
      <StoryFormSection
        number={4}
        title="Any personality traits? (optional)"
        hint="We'll weave these into how your child's character is described"
      >
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Personality traits"
        >
          {PERSONALITY_TRAITS.map((trait) => {
            const isSelected = storyData.selectedTraits.includes(trait);
            return (
              <button
                key={trait}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleTraitToggle(trait)}
                className={`rounded-full px-5 py-2 text-sm font-medium
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isSelected
                              ? "bg-[#FC800A]/10 text-[#FC800A] border-2 border-[#FC800A] font-semibold"
                              : "bg-[#FCF7EE] text-[#171E45]/65 border-2 border-[#FFD5C0] hover:border-[#FC800A]/40 hover:text-[#171E45]"
                            }`}
              >
                {isSelected && (
                  <span aria-hidden="true" className="mr-1 text-xs">✓</span>
                )}
                {trait}
              </button>
            );
          })}
        </div>
      </StoryFormSection>

      <SectionDivider />

      {/* ⑤ Photo upload */}
      <StoryFormSection
        number={5}
        title="Add a photo of your child (optional)"
        hint="We'll use it to illustrate your child's character"
      >
        {photoPreviewUrl && photoFile ? (
          /* Photo preview */
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FCF7EE] border border-[#FFD5C0]">
            <img
              src={photoPreviewUrl}
              alt="Uploaded photo preview"
              className="w-16 h-16 rounded-xl object-cover border-2 border-[#FFD5C0] shadow-sm flex-shrink-0"
            />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-medium text-[#171E45] truncate">{photoFile.name}</p>
              <p className="text-xs text-[#020202]/40">
                {(photoFile.size / 1024).toFixed(0)} KB
              </p>
              <div className="flex gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="text-xs font-medium text-[#FC800A] hover:underline underline-offset-2 transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handlePhotoRemove}
                  className="text-xs font-medium text-red-400 hover:text-red-600 hover:underline underline-offset-2 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Upload zone */
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-[#FFD5C0] bg-[#FCF7EE]
                       flex flex-col items-center gap-2 py-8 px-4 cursor-pointer
                       hover:border-[#FC800A]/50 hover:bg-[#FBF1E3]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                       transition-all duration-200"
            aria-label="Upload a photo of your child"
          >
            <span className="text-3xl" aria-hidden="true">📷</span>
            <span className="text-sm font-medium text-[#171E45]/60">Click to upload a photo</span>
            <span className="text-xs text-[#020202]/35">JPG or PNG · max 10 MB</span>
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {photoError && (
          <ValidationError message={photoError} />
        )}
      </StoryFormSection>

      {/* ── Submit ── */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="submit"
          aria-disabled={!isFormValid}
          className={`w-full sm:w-auto rounded-full px-10 py-4 text-base font-semibold
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                      transition-all duration-200
                      ${isFormValid
                        ? `bg-[#FC800A] text-white
                           shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                           hover:bg-[#e5720a] hover:-translate-y-0.5
                           hover:shadow-[0_8px_26px_rgba(252,128,10,0.48)]
                           active:scale-[0.97]`
                        : "bg-[#020202]/8 text-[#020202]/30 cursor-not-allowed"
                      }`}
        >
          Create My Story
        </button>

        {submitAttempted && !isFormValid && (
          <p role="alert" className="text-sm text-red-500 text-center">
            Please complete the required fields above.
          </p>
        )}

        <p className="text-xs text-[#020202]/40 text-center">
          No account needed &middot; Your story will be ready in seconds
        </p>
      </div>

    </form>
  );
}
