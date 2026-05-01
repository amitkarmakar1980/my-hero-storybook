export type AgeBand = "3-4" | "5-6" | "7-8";

export type StoryTheme =
  | "Space Explorer"
  | "Jungle Adventure"
  | "Magic School"
  | "Underwater Kingdom"
  | "Dinosaur World"
  | "Fairy Tale Castle"
  | "Pirate Seas"
  | "Arctic Quest"
  | "Superhero City"
  | "Enchanted Garden"
  | "Robot Workshop"
  | "Cloud Kingdom"
  | "Dragon Rider"
  | "Lost Civilization"
  | "Candy Kingdom";

export type StoryTrait = "Brave" | "Curious" | "Funny" | "Kind";

export type StoryLength = "short" | "standard" | "long";

export type IllustrationStyle =
  | "classic-storybook"
  | "watercolor"
  | "cartoon"
  | "gouache"
  | "colored-pencil"
  | "paper-cut"
  | "soft-digital-painting";

export interface StoryCharacterInput {
  name: string;
  age: number;
  traits: StoryTrait[];
}

export interface CharacterPhotoInput {
  characterName: string;
  uploadedImageMimeType?: string;
  uploadedImageBase64?: string;
  uploadedImageName?: string;
  persistedPhotoUrl?: string;
}

export interface PersistedCharacterPhoto {
  characterName: string;
  persistedPhotoUrl: string;
  uploadedImageName?: string;
}

export interface StoryInput {
  childName: string;
  characterNames?: string[];
  characters?: StoryCharacterInput[];
  characterPhotos?: CharacterPhotoInput[];
  ageBand?: AgeBand;
  theme: StoryTheme;
  storyLength?: StoryLength;
  pageCount?: number;
  illustrationStyle?: IllustrationStyle;
  traits?: StoryTrait[];
  uploadedImageMimeType?: string;
  uploadedImageBase64?: string;
  uploadedImageName?: string;
}

export interface CharacterProfile {
  characterName: string;
  characterDescription: string;
  styleNotes: string;
  recurringVisualAnchors: string[];
  exactAge?: number;
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

export interface StoredStoryData extends GeneratedStory {
  characterNames?: string[];
  characters?: StoryCharacterInput[];
  characterPhotos?: PersistedCharacterPhoto[];
  illustrationStyle?: IllustrationStyle;
}

export interface PageImagePrompt {
  pageNumber: number;
  prompt?: string;
  retryCount?: number;
}

export interface CoverImagePrompt {
  prompt: string;
}

export interface StoryImageGenerationContext {
  characterNames: string[];
  characterProfiles: CharacterProfile[];
  characterPhotos: CharacterPhotoInput[];
  sharedContextPrompt: string;
  illustrationStyle?: IllustrationStyle;
}

export interface GeneratedStorybook {
  childName: string;
  characterNames?: string[];
  characters?: StoryCharacterInput[];
  characterPhotos?: CharacterPhotoInput[];
  characterProfiles?: CharacterProfile[];
  illustrationStyle?: IllustrationStyle;
  imageGenerationContext?: StoryImageGenerationContext;
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
