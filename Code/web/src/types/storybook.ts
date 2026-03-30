export type AgeBand = "3-4" | "5-6" | "7-8";

export type StoryTheme =
  | "Space Explorer"
  | "Jungle Adventure"
  | "Magic School";

export type StoryTrait = "Brave" | "Curious" | "Funny" | "Kind";

export interface StoryInput {
  childName: string;
  ageBand: AgeBand;
  theme: StoryTheme;
  traits: StoryTrait[];
  uploadedImageMimeType?: string;
  uploadedImageBase64?: string;
  uploadedImageName?: string;
}

export interface CharacterProfile {
  characterDescription: string;
  styleNotes: string;
  recurringVisualAnchors: string[];
  appearanceAge?: string;
  faceShape?: string;
  skinTone?: string;
  hair?: string;
  eyes?: string;
  build?: string;
  signatureFeatures?: string;
  defaultOutfit?: string;
}

export interface StoryPage {
  pageNumber: number;
  text: string;
}

export interface GeneratedStory {
  title: string;
  coverText: string;
  pages: StoryPage[];
  ending: string;
}

export interface PageImagePrompt {
  pageNumber: number;
  prompt?: string;
  retryCount?: number;
}

export interface CoverImagePrompt {
  prompt: string;
}

export interface GeneratedStorybook {
  childName: string;
  characterProfile: CharacterProfile;
  story: GeneratedStory;
  coverImagePrompt: CoverImagePrompt;
  imagePrompts: PageImagePrompt[];
}

export type InvalidImageReason =
  | "monochrome_or_black_and_white"
  | "line_art_or_sketch"
  | "isolated_face_or_avatar"
  | "collage_or_character_sheet"
  | "text_artifact"
  | "inconsistent_character"
  | "low_information_scene"
  | "placeholder"
  | "generation_failed";

export interface PageImageQuality {
  isValid: boolean;
  invalidReason?: InvalidImageReason;
  qualityFlags?: string[];
  attempts: number;
  maxAttempts: number;
}

export interface GeneratedStoryImage {
  pageNumber: number;
  imageUrl?: string;
  error?: string;
  isPlaceholder?: boolean;
  attempts?: number;
  // Quality gate fields — now includes detailed reason and flag tracking
  quality?: PageImageQuality;
}
