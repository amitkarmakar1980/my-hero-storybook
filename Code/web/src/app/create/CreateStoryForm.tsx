"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { STORY_THEMES } from "@/lib/storyThemes";
import type { StoryTheme, StoryTrait, StoryLength } from "@/types/storybook";

// ── Constants ────────────────────────────────────────────────────────────────

const PERSONALITY_TRAITS: StoryTrait[] = ["Brave", "Curious", "Funny", "Kind"];
const TRAIT_ICONS: Record<StoryTrait, string> = {
  Brave: "🦁",
  Curious: "🔭",
  Funny: "😄",
  Kind: "💛",
};

const STORY_LENGTH_OPTIONS: Array<{
  value: StoryLength;
  label: string;
  description: string;
}> = [
  {
    value: "short",
    label: "Short",
    description: "Best for quick read-alouds with more room for illustrations.",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Adds more story detail on each page without feeling too dense.",
  },
  {
    value: "long",
    label: "Long",
    description: "Most detailed version, with fuller page-by-page storytelling.",
  },
];

const MAX_PHOTO_SIZE_BYTES = 4 * 1024 * 1024;
const TARGET_UPLOAD_PHOTO_BYTES = 420 * 1024;
const MAX_UPLOAD_PHOTO_DIMENSION = 1500;
const INITIAL_UPLOAD_PHOTO_QUALITY = 0.9;
const MIN_UPLOAD_PHOTO_QUALITY = 0.6;
const MAX_LOGGED_IN_CHARACTERS = 5;

const LOADING_STAGES = [
  { emoji: "📸", text: "Studying your hero very carefully…" },
  { emoji: "🧠", text: "The AI is having a very important think…" },
  { emoji: "🌍", text: "Building an entire world from scratch…" },
  { emoji: "✍️", text: "Writing the most epic adventure ever told…" },
  { emoji: "☕", text: "Waking up the AI artist (it likes coffee)…" },
  { emoji: "🎨", text: "Mixing the perfect shade of adventure…" },
  { emoji: "🦕", text: "Convincing the dinosaurs to sit still…" },
  { emoji: "✨", text: "Sprinkling just the right amount of magic…" },
  { emoji: "🦄", text: "Shooing away the unicorn photobombers…" },
  { emoji: "🚀", text: "Almost ready — hang tight, hero incoming…" },
] as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeUploadFilename(filename: string) {
  const trimmed = filename.trim() || "character-photo";
  return trimmed.replace(/\.[^.]+$/, "") + ".jpg";
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not process the selected photo."));
    };
    image.src = objectUrl;
  });
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare the selected photo."));
        return;
      }

      resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function preparePhotoForUpload(blob: Blob): Promise<{ base64: string; blob: Blob; mimeType: string }> {
  const image = await loadImageFromBlob(blob);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > MAX_UPLOAD_PHOTO_DIMENSION
    ? MAX_UPLOAD_PHOTO_DIMENSION / largestSide
    : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the selected photo.");
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = INITIAL_UPLOAD_PHOTO_QUALITY;
  let optimizedBlob = await canvasToJpegBlob(canvas, quality);

  while (optimizedBlob.size > TARGET_UPLOAD_PHOTO_BYTES && quality > MIN_UPLOAD_PHOTO_QUALITY) {
    quality = Math.max(MIN_UPLOAD_PHOTO_QUALITY, quality - 0.08);
    optimizedBlob = await canvasToJpegBlob(canvas, quality);
  }

  const dataUrl = await blobToDataUrl(optimizedBlob);
  const [, base64 = ""] = dataUrl.split(",", 2);

  return {
    base64,
    blob: optimizedBlob,
    mimeType: optimizedBlob.type || "image/jpeg",
  };
}

function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return null;
}

function buildResponseError(response: Response, responseText: string): string {
  const trimmedText = responseText.trim();

  if (response.status === 413 || /^Request Entity Too Large/i.test(trimmedText)) {
    return "The selected photo is too large for the deployed app. Try a smaller image.";
  }

  if (trimmedText) {
    return trimmedText;
  }

  return `Request failed (${response.status}).`;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  const fallbackError = buildResponseError(response, responseText);

  if (!responseText) {
    if (!response.ok) {
      throw new Error(fallbackError);
    }

    return {} as T;
  }

  try {
    const payload = JSON.parse(responseText) as T;

    if (!response.ok) {
      throw new Error(extractApiErrorMessage(payload) ?? fallbackError);
    }

    return payload;
  } catch {
    if (!response.ok) {
      throw new Error(fallbackError);
    }

    throw new Error("Received an invalid server response.");
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StoryCreationData {
  characters: Array<{
    name: string;
    age: string;
    traits: StoryTrait[];
  }>;
  selectedTheme: StoryTheme | "";
  storyLength: StoryLength;
}

interface RequiredFieldErrors {
  characters: string;
  selectedTheme: string;
}

interface FieldTouchedState {
  characters: boolean;
  selectedTheme: boolean;
}

interface SavedPhoto {
  id: string;
  url: string;
  storageUrl: string;
  filename: string;
  createdAt: string;
}

interface PreparedCharacterPhotoPayload {
  characterName: string;
  uploadedImageBase64?: string;
  uploadedImageMimeType?: string;
  uploadedImageName?: string;
  persistedPhotoUrl?: string;
  uploadBlob?: Blob;
}

type CharacterPhotoSelection = {
  file: File | null;
  previewUrl: string | null;
  previewSource: "upload" | "saved" | null;
  selectedSavedPhoto: SavedPhoto | null;
};

function createEmptyCharacterPhotoSelection(): CharacterPhotoSelection {
  return {
    file: null,
    previewUrl: null,
    previewSource: null,
    selectedSavedPhoto: null,
  };
}

function revokeCharacterPhotoPreview(selection: CharacterPhotoSelection | undefined) {
  if (selection?.previewSource === "upload" && selection.previewUrl) {
    URL.revokeObjectURL(selection.previewUrl);
  }
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
      <div className="pl-0 md:pl-10">{children}</div>
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

function normalizeCharacterNames(names: string[]): string[] {
  return names.map((name) => name.trim()).filter(Boolean);
}

function formatCharacterNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function createEmptyCharacterDraft() {
  return {
    name: "",
    age: "",
    traits: [] as StoryTrait[],
  };
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function CreateStoryForm() {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user?.id;

  const [storyData, setStoryData] = useState<StoryCreationData>({
    characters: [createEmptyCharacterDraft()],
    selectedTheme: "",
    storyLength: "short",
  });
  const [touched, setTouched] = useState<FieldTouchedState>({
    characters: false,
    selectedTheme: false,
  });
  const [characterPhotos, setCharacterPhotos] = useState<CharacterPhotoSelection[]>([
    createEmptyCharacterPhotoSelection(),
  ]);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const [isLoadingSavedPhotos, setIsLoadingSavedPhotos] = useState(false);
  const [activeSavedPhotoPickerIndex, setActiveSavedPhotoPickerIndex] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string>("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string>("");
  const [stageIndex, setStageIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const router = useRouter();
  const photoInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const characterPhotosRef = useRef<CharacterPhotoSelection[]>([createEmptyCharacterPhotoSelection()]);

  useEffect(() => {
    characterPhotosRef.current = characterPhotos;
  }, [characterPhotos]);

  useEffect(() => {
    return () => {
      characterPhotosRef.current.forEach((selection) => revokeCharacterPhotoPreview(selection));
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setSavedPhotos([]);
      setActiveSavedPhotoPickerIndex(null);
      return;
    }

    let isMounted = true;

    const loadSavedPhotos = async () => {
      setIsLoadingSavedPhotos(true);
      try {
        const response = await fetch("/api/profile/photos");
        const data = await readJsonResponse<{ photos?: SavedPhoto[] }>(response);
        if (isMounted) {
          setSavedPhotos(data.photos ?? []);
        }
      } catch {
        if (isMounted) {
          setSavedPhotos([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingSavedPhotos(false);
        }
      }
    };

    void loadSavedPhotos();

    return () => {
      isMounted = false;
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoading) {
      setStageIndex(0);
      setLoadingProgress(0);
      return;
    }
    // Slow ticker — stays at 88% max so we can push to 100 manually when done
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + 0.18, 88);
      setLoadingProgress(p);
      setStageIndex(
        Math.min(
          Math.floor((p / 88) * (LOADING_STAGES.length - 2)),
          LOADING_STAGES.length - 3
        )
      );
      if (p >= 88) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [isLoading]);

  // ── Derived state ──

  const normalizedCharacters = storyData.characters
    .map((character) => ({
      ...character,
      name: character.name.trim(),
    }))
    .filter((character) => character.name);
  const normalizedCharacterNames = normalizeCharacterNames(
    normalizedCharacters.map((character) => character.name)
  );
  const hasBlankCharacterField = storyData.characters.some((character) => !character.name.trim());
  const hasMissingCharacterPhoto = storyData.characters.some((character, index) => {
    if (!character.name.trim()) return false;
    const selection = characterPhotos[index];
    return !selection?.file && !selection?.selectedSavedPhoto;
  });
  const hasMissingCharacterAge = storyData.characters.some(
    (character) => !!character.name.trim() && !character.age.trim()
  );
  const hasInvalidCharacterAge = storyData.characters.some(
    (character) =>
      !!character.name.trim() &&
      (!Number.isInteger(Number(character.age)) || Number(character.age) < 1 || Number(character.age) > 100)
  );
  const characterSummary = formatCharacterNames(normalizedCharacterNames);

  const errors: RequiredFieldErrors = {
    characters:
      normalizedCharacterNames.length === 0
        ? "Please enter at least one character name."
        : hasBlankCharacterField
        ? "Fill in each character name or remove the empty fields."
        : !isSignedIn && normalizedCharacterNames.length > 1
        ? "Sign in to include more than one character."
        : normalizedCharacterNames.length > MAX_LOGGED_IN_CHARACTERS
        ? "You can include up to 5 characters in one story."
        : hasMissingCharacterAge
        ? "Choose an age for each character."
        : hasInvalidCharacterAge
        ? "Enter a valid numeric age between 1 and 100 for each character."
        : hasMissingCharacterPhoto
        ? "Please add a photo for each character."
        : "",
    selectedTheme: !storyData.selectedTheme ? "Please choose a story theme." : "",
  };
  const isFormValid = !errors.characters && !errors.selectedTheme;
  const shouldShowError = (field: keyof FieldTouchedState) =>
    (touched[field] || submitAttempted) && !!errors[field];

  // ── Handlers ──

  const handleCharacterNameChange = (index: number, value: string) => {
    setStoryData((prev) => ({
      ...prev,
      characters: prev.characters.map((character, currentIndex) =>
        currentIndex === index ? { ...character, name: value } : character
      ),
    }));
  };
  const handleCharacterNamesBlur = () =>
    setTouched((prev) => ({ ...prev, characters: true }));
  const handleAddCharacter = () => {
    if (!isSignedIn || storyData.characters.length >= MAX_LOGGED_IN_CHARACTERS) {
      return;
    }

    setStoryData((prev) => ({
      ...prev,
      characters: [...prev.characters, createEmptyCharacterDraft()],
    }));
    setCharacterPhotos((prev) => [...prev, createEmptyCharacterPhotoSelection()]);
    setTouched((prev) => ({ ...prev, characters: true }));
  };
  const handleRemoveCharacter = (index: number) => {
    setStoryData((prev) => {
      const nextCharacters = prev.characters.filter((_, currentIndex) => currentIndex !== index);
      return {
        ...prev,
        characters: nextCharacters.length > 0 ? nextCharacters : [createEmptyCharacterDraft()],
      };
    });
    setCharacterPhotos((prev) => {
      const removedSelection = prev[index];
      revokeCharacterPhotoPreview(removedSelection);
      const nextSelections = prev.filter((_, currentIndex) => currentIndex !== index);
      return nextSelections.length > 0 ? nextSelections : [createEmptyCharacterPhotoSelection()];
    });
    setActiveSavedPhotoPickerIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
    setTouched((prev) => ({ ...prev, characters: true }));
  };
  const handleCharacterAgeChange = (index: number, value: string) => {
    const normalizedValue = value.replace(/[^0-9]/g, "").slice(0, 3);
    setStoryData((prev) => ({
      ...prev,
      characters: prev.characters.map((character, currentIndex) =>
        currentIndex === index ? { ...character, age: normalizedValue } : character
      ),
    }));
    setTouched((prev) => ({ ...prev, characters: true }));
  };
  const handleThemeSelect = (theme: StoryTheme) => {
    setStoryData((prev) => ({ ...prev, selectedTheme: theme }));
    setTouched((prev) => ({ ...prev, selectedTheme: true }));
  };
  const handleStoryLengthSelect = (storyLength: StoryLength) => {
    setStoryData((prev) => ({ ...prev, storyLength }));
  };
  const handleTraitToggle = (index: number, trait: StoryTrait) =>
    setStoryData((prev) => ({
      ...prev,
      characters: prev.characters.map((character, currentIndex) => {
        if (currentIndex !== index) {
          return character;
        }

        return {
          ...character,
          traits: character.traits.includes(trait)
            ? character.traits.filter((currentTrait) => currentTrait !== trait)
            : [...character.traits, trait],
        };
      }),
    }));

  const handlePhotoFileSelected = (index: number, file: File) => {
    setPhotoError("");
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("Photo must be under 4 MB. Please choose a smaller image.");
      return;
    }
    const newUrl = URL.createObjectURL(file);
    setCharacterPhotos((prev) => {
      const next = [...prev];
      const current = next[index] ?? createEmptyCharacterPhotoSelection();
      revokeCharacterPhotoPreview(current);
      next[index] = {
        file,
        previewUrl: newUrl,
        previewSource: "upload",
        selectedSavedPhoto: null,
      };
      return next;
    });
    setActiveSavedPhotoPickerIndex(null);
  };
  const handlePhotoInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFileSelected(index, file);
  };
  const handlePhotoRemove = (index: number) => {
    setCharacterPhotos((prev) => {
      const next = [...prev];
      revokeCharacterPhotoPreview(next[index]);
      next[index] = createEmptyCharacterPhotoSelection();
      return next;
    });
    setPhotoError("");
    setActiveSavedPhotoPickerIndex((prev) => (prev === index ? null : prev));
    if (photoInputRefs.current[index]) {
      photoInputRefs.current[index]!.value = "";
    }
  };

  const handleSavedPhotoSelect = (index: number, photo: SavedPhoto) => {
    setCharacterPhotos((prev) => {
      const next = [...prev];
      const current = next[index] ?? createEmptyCharacterPhotoSelection();
      revokeCharacterPhotoPreview(current);
      next[index] = {
        file: null,
        previewUrl: photo.url,
        previewSource: "saved",
        selectedSavedPhoto: photo,
      };
      return next;
    });

    if (photoInputRefs.current[index]) {
      photoInputRefs.current[index]!.value = "";
    }

    setPhotoError("");
    setActiveSavedPhotoPickerIndex(null);
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
      const characters = normalizedCharacters.map((character) => ({
        name: character.name,
        age: Number(character.age),
        traits: character.traits,
      }));
      const characterNames = characters.map((character) => character.name);
      const childName = formatCharacterNames(characterNames);
      const preparedCharacterPhotos = await Promise.all(
        characterNames.map(async (characterName, index) => {
          const selection = characterPhotos[index] ?? createEmptyCharacterPhotoSelection();
          let uploadedImageBase64: string | undefined;
          let uploadedImageMimeType: string | undefined;
          let uploadedImageName: string | undefined;
          let uploadBlob: Blob | undefined;
          const persistedPhotoUrl = selection.selectedSavedPhoto?.storageUrl;

          if (selection.file) {
            const preparedPhoto = await preparePhotoForUpload(selection.file);
            uploadedImageBase64 = preparedPhoto.base64;
            uploadedImageMimeType = preparedPhoto.mimeType;
            uploadedImageName = normalizeUploadFilename(selection.file.name);
            uploadBlob = preparedPhoto.blob;
          } else if (selection.selectedSavedPhoto) {
            const photoResponse = await fetch(selection.selectedSavedPhoto.url);
            if (!photoResponse.ok) {
              throw new Error("Could not load one of the selected saved photos. Please try again.");
            }

            const photoBlob = await photoResponse.blob();
            const preparedPhoto = await preparePhotoForUpload(photoBlob);
            uploadedImageBase64 = preparedPhoto.base64;
            uploadedImageMimeType = preparedPhoto.mimeType;
            uploadedImageName = normalizeUploadFilename(selection.selectedSavedPhoto.filename);
            uploadBlob = preparedPhoto.blob;
          }

          return {
            characterName,
            uploadedImageBase64,
            uploadedImageMimeType,
            uploadedImageName,
            persistedPhotoUrl,
            uploadBlob,
          } satisfies PreparedCharacterPhotoPayload;
        })
      );

      const characterPhotoPayloads = preparedCharacterPhotos.map((characterPhoto) => ({
        characterName: characterPhoto.characterName,
        uploadedImageBase64: characterPhoto.uploadedImageBase64,
        uploadedImageMimeType: characterPhoto.uploadedImageMimeType,
        uploadedImageName: characterPhoto.uploadedImageName,
        persistedPhotoUrl: characterPhoto.persistedPhotoUrl,
      }));

      const photoUploadPromise = Promise.all(
        preparedCharacterPhotos.map(async (characterPhoto) => {
          if (!characterPhoto.uploadBlob || !isSignedIn || characterPhoto.persistedPhotoUrl) {
            return characterPhoto.persistedPhotoUrl;
          }

          try {
            const formData = new FormData();
            formData.set(
              "photo",
              characterPhoto.uploadBlob,
              characterPhoto.uploadedImageName ?? `${characterPhoto.characterName}-photo.jpg`
            );

            const res = await fetch("/api/profile/photos", {
              method: "POST",
              body: formData,
            });

            const { photo } = await readJsonResponse<{ photo: { url: string } }>(res);
            return photo.url as string;
          } catch {
            return undefined;
          }
        })
      );

      const storyPromise = fetch("/api/generate-storybook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName,
          characterNames,
          theme: storyData.selectedTheme as StoryTheme,
          storyLength: storyData.storyLength,
          characters,
          traits: characters[0]?.traits,
          characterPhotos: characterPhotoPayloads,
          ...(characterPhotoPayloads[0]?.uploadedImageBase64
            ? {
                uploadedImageBase64: characterPhotoPayloads[0].uploadedImageBase64,
                uploadedImageMimeType: characterPhotoPayloads[0].uploadedImageMimeType,
                uploadedImageName: characterPhotoPayloads[0].uploadedImageName,
              }
            : {}),
        }),
      });

      const [res, uploadedPhotoUrls] = await Promise.all([storyPromise, photoUploadPromise]);
      const data = await readJsonResponse<Record<string, unknown>>(res);

      const persistedCharacterPhotos = characterPhotoPayloads.map((characterPhoto, index) => ({
        ...characterPhoto,
        persistedPhotoUrl: uploadedPhotoUrls[index] ?? characterPhoto.persistedPhotoUrl,
      }));
      const mainCharacterPhoto = persistedCharacterPhotos[0];

      const draftData = {
        ...data,
        theme: storyData.selectedTheme,
        storyLength: storyData.storyLength,
        childName,
        characterNames,
        characters,
        characterPhotos: persistedCharacterPhotos,
        childPhotoUrl: mainCharacterPhoto?.persistedPhotoUrl ?? undefined,
        childPhotoBase64: mainCharacterPhoto?.uploadedImageBase64 ?? undefined,
        childPhotoMimeType: mainCharacterPhoto?.uploadedImageMimeType ?? undefined,
      };
      sessionStorage.setItem("heroStorybookDraft", JSON.stringify(draftData));

      // data is the raw API response — contains imageGenerationContext, coverImagePrompt, imagePrompts, story
      const apiData = data as Record<string, unknown>;
      const imageGenerationContext = apiData.imageGenerationContext;
      const coverImagePrompt = apiData.coverImagePrompt;
      const imagePrompts = Array.isArray(apiData.imagePrompts) ? apiData.imagePrompts as Array<{ pageNumber: number }> : [];
      const storyData2 = apiData.story;

      // For signed-in users: generate cover + page 1 here, then navigate to /story/[id]
      if (isSignedIn && imageGenerationContext && coverImagePrompt) {
        let coverBase64: string | undefined;
        let page1Base64: string | undefined;

        // Generate cover
        try {
          setStageIndex(LOADING_STAGES.length - 4);
          const coverRes = await fetch("/api/generate-story-images", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageGenerationContext, coverImagePrompt }),
          });
          const coverData = await coverRes.json() as { images?: Array<{ imageUrl?: string; isPlaceholder?: boolean }> };
          const coverImg = coverData.images?.[0];
          if (coverImg?.imageUrl && !coverImg.isPlaceholder) coverBase64 = coverImg.imageUrl;
        } catch { /* non-fatal */ }

        // Generate page 1
        try {
          setStageIndex(LOADING_STAGES.length - 3);
          const prompt1 = imagePrompts.find(p => p.pageNumber === 1);
          if (prompt1 && storyData2) {
            const p1Res = await fetch("/api/generate-story-images", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageGenerationContext, story: storyData2, imagePrompts: [prompt1] }),
            });
            const p1Data = await p1Res.json() as { images?: Array<{ imageUrl?: string; isPlaceholder?: boolean }> };
            const p1Img = p1Data.images?.[0];
            if (p1Img?.imageUrl && !p1Img.isPlaceholder) page1Base64 = p1Img.imageUrl;
          }
        } catch { /* non-fatal */ }

        // Save story with cover + page 1
        setStageIndex(LOADING_STAGES.length - 2);
        setLoadingProgress(95);
        const pageImagesBase64: Record<number, string> = {};
        if (page1Base64) pageImagesBase64[1] = page1Base64;
        const story2 = storyData2 as { title?: string; coverText?: string } | undefined;

        const saveRes = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: story2?.title ?? "",
            coverText: story2?.coverText ?? "",
            theme: storyData.selectedTheme ?? "",
            childName, characterNames, characters,
            characterPhotos: persistedCharacterPhotos,
            childPhotoUrl: mainCharacterPhoto?.persistedPhotoUrl,
            childPhotoBase64: mainCharacterPhoto?.uploadedImageBase64,
            childPhotoMimeType: mainCharacterPhoto?.uploadedImageMimeType,
            coverImageBase64: coverBase64,
            pageImagesBase64,
            storyJson: storyData2,
          }),
        });
        const saveData = await saveRes.json() as { storyId?: string };

        if (saveData.storyId) {
          setStageIndex(LOADING_STAGES.length - 1);
          setLoadingProgress(100);
          const remainingPrompts = imagePrompts.filter(p => p.pageNumber !== 1);
          if (remainingPrompts.length > 0) {
            sessionStorage.setItem("heroStorybookPendingGen", JSON.stringify({
              storyId: saveData.storyId,
              imageGenerationContext,
              story: storyData2,
              pendingPageNumbers: remainingPrompts.map(p => p.pageNumber),
            }));
          }
          router.push(`/story/${saveData.storyId}`);
          return;
        }
      }

      // Fallback for guests or if save failed: go to story-preview
      router.push("/story-preview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setApiError(message);
      setIsLoading(false);
    }
  };

  // ── Render ──

  if (isLoading) {
    const heroName = characterSummary || "your child";
    const stage = LOADING_STAGES[stageIndex];
    return (
      <div className="flex flex-col items-center text-center gap-9 py-14 px-4 min-h-[420px] justify-center">
        <p className="max-w-xl text-sm leading-relaxed text-[#020202]/55">
          AI image generation takes time. You can come back later to view your story from Your Name &gt; My Profile.
        </p>

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

  const renderCharacterPhotoSelector = (index: number) => {
    const selection = characterPhotos[index] ?? createEmptyCharacterPhotoSelection();
    const isSavedPickerOpen = activeSavedPhotoPickerIndex === index;
    const hasPhoto = !!selection.previewUrl;

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#FFD5C0] bg-[#FFF9F2] p-4">
        <div>
          <p className="text-sm font-semibold text-[#171E45]">
            {index === 0 ? "Main character photo" : `Photo for character ${index + 1}`}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#020202]/45">
            {index === 0
              ? "This photo defines the main hero's look across the book."
              : "Use a different photo so this character stays visually distinct in the illustrations."}
          </p>
        </div>

        {hasPhoto ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[#FFD5C0] bg-[#FCF7EE] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selection.previewUrl ?? undefined}
              alt={selection.selectedSavedPhoto?.filename ?? `Character ${index + 1} photo preview`}
              className="h-14 w-14 rounded-xl object-cover border border-[#FFD5C0]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#171E45]">
                {selection.selectedSavedPhoto?.filename ?? selection.file?.name ?? `Character ${index + 1} photo`}
              </p>
              <p className="text-[11px] text-[#020202]/35">
                {selection.selectedSavedPhoto
                  ? "Using a saved photo from your profile"
                  : `${((selection.file?.size ?? 0) / 1024).toFixed(0)} KB`}
              </p>
            </div>
            <span className="text-lg text-[#FC800A]" aria-hidden="true">✓</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => photoInputRefs.current[index]?.click()}
            suppressHydrationWarning
            className="rounded-2xl border-2 border-dashed border-[#FFD5C0] bg-[#FCF7EE] px-4 py-5 text-left
                       hover:border-[#FC800A]/40 hover:bg-[#FBF1E3]
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
          >
            <span className="block text-sm font-semibold text-[#171E45]">Upload a photo</span>
            <span className="mt-1 block text-xs leading-relaxed text-[#020202]/45">
              JPG, PNG, or WebP up to 4 MB
            </span>
          </button>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => photoInputRefs.current[index]?.click()}
            suppressHydrationWarning
            className="rounded-full bg-[#FBF1E3] px-3 py-2 text-xs font-semibold text-[#FC800A]
                       hover:bg-[#FFE8D0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
          >
            {hasPhoto ? "Upload different photo" : "Upload photo"}
          </button>
          {isSignedIn && (
            <button
              type="button"
              onClick={() => setActiveSavedPhotoPickerIndex((prev) => (prev === index ? null : index))}
              className="rounded-full border border-[#FFD5C0] bg-white px-3 py-2 text-xs font-semibold text-[#171E45]
                         hover:border-[#FC800A]/40 hover:text-[#FC800A]
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
            >
              {isSavedPickerOpen ? "Hide saved photos" : "Use saved photo"}
            </button>
          )}
          {hasPhoto && (
            <button
              type="button"
              onClick={() => handlePhotoRemove(index)}
              className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-500
                         hover:border-red-300 hover:text-red-600
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300"
            >
              Remove
            </button>
          )}
        </div>

        <input
          ref={(element) => {
            photoInputRefs.current[index] = element;
          }}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handlePhotoInputChange(index, e)}
          suppressHydrationWarning
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {isSignedIn && isSavedPickerOpen && (
          <div className="rounded-2xl border border-[#FFD5C0] bg-white/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#171E45]">Choose from saved photos</p>
                <p className="text-xs text-[#020202]/45">Pick one from your profile library</p>
              </div>
              {isLoadingSavedPhotos && <span className="text-xs text-[#020202]/35">Loading…</span>}
            </div>

            {savedPhotos.length === 0 ? (
              <p className="text-xs text-[#020202]/40">No saved photos yet. Upload one once and it will appear here next time.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {savedPhotos.map((photo) => {
                  const isSelected = selection.selectedSavedPhoto?.id === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleSavedPhotoSelect(index, photo)}
                      className={`relative aspect-square overflow-hidden rounded-2xl border-2 transition-all duration-200
                                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                                  ${isSelected
                                    ? "border-[#FC800A] shadow-[0_8px_24px_rgba(252,128,10,0.28)] scale-[1.02]"
                                    : "border-[#FFD5C0] hover:border-[#FC800A]/40 hover:-translate-y-0.5"
                                  }`}
                      aria-pressed={isSelected}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-[#171E45]/65 px-2 py-1 text-[10px] font-semibold text-white">
                        {photo.filename}
                      </span>
                      {isSelected && (
                        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#FC800A] text-xs font-bold text-white shadow-md">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10" suppressHydrationWarning>

      {/* ① Character blocks */}
      <StoryFormSection
        number={1}
        title={isSignedIn ? "Who should appear in the story?" : "What&apos;s your child&apos;s name?"}
        hint={isSignedIn ? "Each character block includes name, photo, exact age, and personality traits. The first character is the main character." : undefined}
      >
        <div className="flex flex-col gap-4">
            {storyData.characters.map((character, index) => (
              <div key={index} className="rounded-[1.75rem] border border-[#FFD5C0] bg-white/80 p-4 md:p-5 lg:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#020202]/45">
                        Character {index + 1}
                      </span>
                      {index === 0 && (
                        <span className="rounded-full bg-[#FC800A]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FC800A]">
                          Main character
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-[#020202]/45">
                      Add the exact age, photo, and traits so this character stays recognizable in every illustration.
                    </p>
                  </div>

                  {isSignedIn && storyData.characters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCharacter(index)}
                      className="rounded-full border border-[#FFD5C0] bg-white px-4 py-2 text-sm font-semibold text-[#171E45]
                                 hover:border-[#FC800A]/40 hover:text-[#FC800A]
                                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
                    >
                      Remove character
                    </button>
                  )}
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)] xl:items-start">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor={`character-name-${index}`} className="sr-only">
                        {`Character ${index + 1} name`}
                      </label>
                      <input
                        id={`character-name-${index}`}
                        type="text"
                        value={character.name}
                        onChange={(e) => handleCharacterNameChange(index, e.target.value)}
                        onBlur={handleCharacterNamesBlur}
                        suppressHydrationWarning
                        placeholder={index === 0 ? "e.g. Emma" : `Character ${index + 1}`}
                        maxLength={40}
                        autoComplete="off"
                        aria-invalid={shouldShowError("characters")}
                        aria-describedby={shouldShowError("characters") ? "characters-error" : undefined}
                        className={`w-full rounded-2xl px-5 py-3.5 bg-[#FCF7EE] border-2 text-[#020202]
                                    text-base placeholder:text-[#020202]/30 focus:outline-none focus:ring-2
                                    transition-all duration-200
                                    ${shouldShowError("characters")
                                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                                      : "border-[#FFD5C0] focus:border-[#FC800A] focus:ring-[#FC800A]/15"
                                    }`}
                      />
                    </div>

                    <div>
                      <label htmlFor={`character-age-${index}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#020202]/45">
                        Age
                      </label>
                      <input
                        id={`character-age-${index}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={character.age}
                        onChange={(e) => handleCharacterAgeChange(index, e.target.value)}
                        onBlur={handleCharacterNamesBlur}
                        placeholder="e.g. 6"
                        maxLength={3}
                        className={`w-full rounded-2xl px-5 py-3.5 bg-[#FCF7EE] border-2 text-[#020202]
                                    text-base placeholder:text-[#020202]/30 focus:outline-none focus:ring-2
                                    transition-all duration-200
                                    ${shouldShowError("characters")
                                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                                      : "border-[#FFD5C0] focus:border-[#FC800A] focus:ring-[#FC800A]/15"
                                    }`}
                      />
                      <p className="mt-1 text-[11px] leading-relaxed text-[#020202]/45">
                        Illustrations will depict this character at this exact age.
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Personality traits</p>
                      <div className="flex flex-wrap gap-2.5" role="group" aria-label={`Personality traits for character ${index + 1}`}>
                        {PERSONALITY_TRAITS.map((trait) => {
                          const isSelected = character.traits.includes(trait);
                          return (
                            <button
                              key={trait}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => handleTraitToggle(index, trait)}
                              suppressHydrationWarning
                              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium
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
                    </div>
                  </div>

                  {renderCharacterPhotoSelector(index)}
                </div>
              </div>
            ))}

            {isSignedIn ? (
              <div className="flex items-center justify-between gap-3 text-xs text-[#020202]/45">
                <span>{storyData.characters.length} / {MAX_LOGGED_IN_CHARACTERS} characters</span>
                <button
                  type="button"
                  onClick={handleAddCharacter}
                  disabled={storyData.characters.length >= MAX_LOGGED_IN_CHARACTERS}
                  className="rounded-full bg-[#FBF1E3] px-4 py-2 text-sm font-semibold text-[#FC800A]
                             hover:bg-[#FFE8D0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                             disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add character
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#020202]/40">Sign in to include up to 5 characters in one story.</p>
            )}

            {shouldShowError("characters") && (
              <ValidationError id="characters-error" message={errors.characters} />
            )}
        </div>
        {photoError && <ValidationError message={photoError} />}
        {!isSignedIn && (
          <p className="text-xs text-[#020202]/35 flex items-center gap-1.5 md:pl-10">
            <span aria-hidden="true">🔒</span>
            Your photo is used only to generate this story and is never stored.
          </p>
        )}
      </StoryFormSection>

      {/* ② Story theme — larger cards */}
      <StoryFormSection number={2} title="Choose a story world" hint="Once the characters are ready, pick the world for their adventure.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" role="radiogroup" aria-label="Story theme" aria-required="true">
          {STORY_THEMES.filter((theme) => isSignedIn || !theme.premium).map((theme) => {
            const isSelected = storyData.selectedTheme === theme.label;
            return (
              <button
                key={theme.label}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleThemeSelect(theme.label as StoryTheme)}
                suppressHydrationWarning
                className={`relative overflow-hidden rounded-2xl flex flex-col text-left bg-white
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            transition-all duration-200 group
                            ${isSelected
                              ? "ring-2 scale-[1.03] shadow-[0_8px_28px_rgba(0,0,0,0.15)]"
                              : "ring-1 ring-[#E5D0B8] hover:ring-[#FC800A]/40 hover:-translate-y-0.5 hover:shadow-lg"
                            }`}
                style={{ ringColor: isSelected ? theme.accentColor : undefined } as React.CSSProperties}
              >
                {/* ── Immersive hero zone ── */}
                <div className="relative overflow-hidden w-full" style={{ height: "10rem" }}>
                  {/* Saturated gradient */}
                  <div className="absolute inset-0" style={{
                    background: `linear-gradient(145deg, ${theme.accentColor} 0%, ${theme.glowColor} 70%, ${theme.accentColor}dd 100%)`,
                  }} />
                  {/* Depth overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/40" />
                  {/* Spotlight */}
                  <div className="absolute inset-0" style={{
                    background: `radial-gradient(ellipse 55% 55% at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 100%)`,
                  }} />
                  {/* Far depth decoration */}
                  <span aria-hidden="true" className="absolute -bottom-4 -right-4 text-[5rem] opacity-[0.1] select-none" style={{ lineHeight: 1 }}>
                    {theme.decorations[2]}
                  </span>
                  {/* Mid decoration */}
                  <span aria-hidden="true" className="absolute top-2 left-3 text-xl opacity-50 select-none"
                    style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
                    {theme.decorations[1]}
                  </span>
                  {/* Hero icon */}
                  <div className="absolute inset-0 flex items-center justify-center pb-5">
                    <span aria-hidden="true" className="text-[4rem] select-none group-hover:scale-110 transition-transform duration-300" style={{
                      lineHeight: 1,
                      filter: `drop-shadow(0 0 18px rgba(255,255,255,0.55)) drop-shadow(0 4px 12px rgba(0,0,0,0.5))`,
                    }}>
                      {theme.icon}
                    </span>
                  </div>
                  {/* Bottom scrim + title */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-3 pb-2 pt-6">
                    <span className="text-white text-sm font-semibold leading-tight block"
                      style={{ fontFamily: "var(--font-rowdies)", textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>
                      {theme.label}
                    </span>
                  </div>
                  {/* Selected checkmark */}
                  {isSelected && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md"
                      style={{ backgroundColor: theme.accentColor }} aria-hidden="true">✓</span>
                  )}
                </div>

                {/* ── Content zone ── */}
                <div className="px-3 py-3 flex-1">
                  <span className="text-xs text-[#171E45]/80 leading-relaxed">
                    {theme.shortDescription}
                  </span>
                </div>

                {/* Accent bottom bar */}
                <div className="h-0.5 w-full" style={{
                  background: isSelected
                    ? `linear-gradient(90deg, ${theme.accentColor}, ${theme.glowColor})`
                    : "transparent",
                }} />
              </button>
            );
          })}
        </div>
        {shouldShowError("selectedTheme") && <ValidationError message={errors.selectedTheme} />}
      </StoryFormSection>

      <StoryFormSection number={3} title="Choose story length" hint="Short is the default. You can switch to a fuller page-by-page version here.">
        <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Story length">
          {STORY_LENGTH_OPTIONS.map((option) => {
            const isSelected = storyData.storyLength === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleStoryLengthSelect(option.value)}
                className={`rounded-2xl border p-4 text-left transition-all duration-200
                            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                            ${isSelected
                              ? "border-[#FC800A] bg-[#FFF4E8] shadow-[0_8px_22px_rgba(252,128,10,0.12)]"
                              : "border-[#FFD5C0] bg-white/80 hover:border-[#FC800A]/35 hover:bg-[#FFF9F2]"
                            }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-[#171E45]" style={{ fontFamily: "var(--font-rowdies)" }}>
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#FC800A] text-[11px] font-bold text-white" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#020202]/55">{option.description}</p>
              </button>
            );
          })}
        </div>
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
              ? `All ${STORY_THEMES.length} story worlds unlocked`
              : `Sign in to unlock ${STORY_THEMES.filter(t => t.premium).length} more story worlds`}
          </p>
        )}
      </div>

    </form>
  );
}
