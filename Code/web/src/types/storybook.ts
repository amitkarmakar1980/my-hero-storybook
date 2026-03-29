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
}

export interface StoryPage {
  pageNumber: number;
  text: string;
}

export interface GeneratedStory {
  title: string;
  coverText: string;
  pages: StoryPage[];
}

export interface PageImagePrompt {
  pageNumber: number;
  prompt: string;
}

export interface GeneratedStorybook {
  characterProfile: CharacterProfile;
  story: GeneratedStory;
  imagePrompts: PageImagePrompt[];
}

export interface GeneratedStoryImage {
  pageNumber: number;
  imageUrl?: string;
  error?: string;
}
