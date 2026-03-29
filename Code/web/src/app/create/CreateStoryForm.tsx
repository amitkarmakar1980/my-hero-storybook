"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { STORY_THEMES } from "@/lib/storyThemes";
import type { AgeBand, StoryTheme, StoryTrait } from "@/types/storybook";

// ── Constants ────────────────────────────────────────────────────────────────

const PERSONALITY_TRAITS: StoryTrait[] = ["Brave", "Curious", "Funny", "Kind"];

const AGE_BANDS = [
  { value: "3-4" as AgeBand, label: "3–4 years" },
  { value: "5-6" as AgeBand, label: "5–6 years" },
  { value: "7-8" as AgeBand, label: "7–8 years" },
];

// Gemini inline data limit is ~4 MB; keep photo uploads safely under that
const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
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

// ── Main form ────────────────────────────────────────────────────────────────

export default function CreateStoryForm() {
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

  const router = useRouter();
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
    selectedTheme: !storyData.selectedTheme ? "Please choose a story theme." : "",
  };

  const isFormValid = !errors.childName && !errors.ageBand && !errors.selectedTheme;

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

  const handleThemeSelect = (theme: StoryTheme) => {
    setStoryData((prev) => ({ ...prev, selectedTheme: theme }));
    setTouched((prev) => ({ ...prev, selectedTheme: true }));
  };

  const handleTraitToggle = (trait: StoryTrait) => {
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

      const res = await fetch("/api/generate-storybook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: storyData.childName,
          ageBand: storyData.ageBand as AgeBand,
          theme: storyData.selectedTheme as StoryTheme,
          traits: storyData.selectedTraits,
          ...(uploadedImageBase64
            ? { uploadedImageBase64, uploadedImageMimeType, uploadedImageName }
            : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Story generation failed. Please try again.");
      }

      sessionStorage.setItem("heroStorybookDraft", JSON.stringify(data));
      router.push("/story-preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setApiError(message);
      setIsLoading(false);
    }
  };

  // ── Render ──

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-9">

      {/* ① Child's name */}
      <StoryFormSection number={1} title="What's your child's name?">
        <label htmlFor="childName-input" className="sr-only">
          Child's name
        </label>
        <input
          id="childName-input"
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
                onClick={() => handleAgeBandSelect(value)}
                className={`rounded-full px-6 py-2.5 text-sm font-medium
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200
                            ${isSelected
                              ? "bg-[#FC800A] text-white border-2 border-[#FC800A] font-semibold shadow-[0_4px_14px_rgba(252,128,10,0.4)] scale-[1.05]"
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
            const isSelected = storyData.selectedTheme === theme.label;
            return (
              <button
                key={theme.label}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleThemeSelect(theme.label as StoryTheme)}
                className={`relative rounded-2xl p-4 flex flex-col gap-2 text-left
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            hover:-translate-y-0.5 hover:shadow-md
                            transition-all duration-200
                            ${isSelected
                              ? "border-2 scale-[1.03] shadow-[0_6px_24px_rgba(0,0,0,0.13)]"
                              : "border-2 border-transparent hover:border-[#FFD5C0] hover:-translate-y-0.5 hover:shadow-md"
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
        {shouldShowError("selectedTheme") && (
          <ValidationError message={errors.selectedTheme} />
        )}
      </StoryFormSection>


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
            <span className="text-sm font-medium text-[#171E45]/70">Click to upload a photo</span>
            <span className="text-xs text-[#020202]/55 text-center leading-snug max-w-[200px]">
              We&apos;ll turn this into your child&apos;s story character
            </span>
            <span className="text-xs text-[#020202]/30 mt-0.5">JPG or PNG · max 4 MB</span>
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

        {/* Privacy trust signal */}
        <p className="mt-3 text-xs text-[#020202]/38 flex items-center gap-1.5">
          <span aria-hidden="true">🔒</span>
          Your photo is used only to generate this story and is not stored.
        </p>
      </StoryFormSection>

      {/* ── Submit ── */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          aria-disabled={!isFormValid || isLoading}
          className={`w-full sm:w-auto rounded-full px-10 py-4 text-base font-semibold
                      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                      transition-[background-color,transform,box-shadow,opacity] duration-200
                      ${isFormValid && !isLoading
                        ? `bg-[#FC800A] text-white
                           shadow-[0_6px_20px_rgba(252,128,10,0.38)]
                           hover:bg-[#e5720a] hover:-translate-y-0.5
                           hover:shadow-[0_8px_26px_rgba(252,128,10,0.48)]
                           active:scale-[0.97]`
                        : isLoading
                          ? "bg-[#FC800A]/80 text-white cursor-wait"
                          : "bg-[#020202]/8 text-[#020202]/30 cursor-not-allowed"
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
            "Create My Story"
          )}
        </button>

        {submitAttempted && !isFormValid && !isLoading && (
          <p role="alert" className="text-sm text-red-500 text-center">
            Please complete the required fields above.
          </p>
        )}

        {apiError && (
          <p role="alert" className="text-sm text-red-500 text-center max-w-sm">
            {apiError}
          </p>
        )}

        {!isLoading && (
          <p className="text-xs text-[#020202]/40 text-center">
            No account needed &middot; Your story will be ready in about 30 seconds
          </p>
        )}
      </div>

    </form>
  );
}
