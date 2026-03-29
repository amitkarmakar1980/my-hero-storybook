// Shared story theme definitions — used by the landing page and the create form

export interface StoryTheme {
  id: string;
  icon: string;
  label: string;
  description: string;         // Full description for landing page cards
  shortDescription: string;    // Concise version for the create form
  bgColor: string;
  accentColor: string;
  iconBg: string;
  tagBg: string;
  tagText: string;
  glowColor: string;
  decorations: [string, string, string];
}

export const STORY_THEMES: StoryTheme[] = [
  {
    id: "space-explorer",
    icon: "🚀",
    label: "Space Explorer",
    description:
      "Blast off into a galaxy of wonder. Your child pilots their own rocket through dazzling nebulae and makes friends with star creatures.",
    shortDescription: "Rockets, stars, and alien friends",
    bgColor: "#EEF0FF",
    accentColor: "#973FEA",
    iconBg: "rgba(151,63,234,0.15)",
    tagBg: "rgba(151,63,234,0.12)",
    tagText: "#6B1FC0",
    glowColor: "#973FEA",
    decorations: ["⭐", "🌙", "🪐"],
  },
  {
    id: "jungle-adventure",
    icon: "🦁",
    label: "Jungle Adventure",
    description:
      "Swing through emerald canopies, discover hidden waterfalls, and lead a tribe of playful animals on a grand expedition.",
    shortDescription: "Wild animals and hidden treasures",
    bgColor: "#F0F9E0",
    accentColor: "#88B520",
    iconBg: "rgba(136,181,32,0.18)",
    tagBg: "rgba(136,181,32,0.15)",
    tagText: "#4A6810",
    glowColor: "#88B520",
    decorations: ["🌿", "🐒", "🌺"],
  },
  {
    id: "magic-school",
    icon: "🪄",
    label: "Magic School",
    description:
      "Enroll in a school of spells and wonder. Your child brews potions, tames dragons, and becomes the most talented young wizard.",
    shortDescription: "Spells, potions, and friendly dragons",
    bgColor: "#FEF0F6",
    accentColor: "#F96EA0",
    iconBg: "rgba(249,110,160,0.18)",
    tagBg: "rgba(249,110,160,0.15)",
    tagText: "#B02A62",
    glowColor: "#F96EA0",
    decorations: ["✨", "🌟", "🦋"],
  },
];
