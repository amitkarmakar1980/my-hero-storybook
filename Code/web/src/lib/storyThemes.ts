// Display configuration for Hero Storybook story themes.
// StoryThemeConfig is the visual/UI data; the StoryTheme string union
// in @/types/storybook is what gets sent to the API.

export interface StoryThemeConfig {
  label: string;
  icon: string;
  description: string;
  shortDescription: string;
  bgColor: string;
  accentColor: string;
  iconBg: string;
  tagBg: string;
  tagText: string;
  glowColor: string;
  decorations: [string, string, string];
  premium?: boolean;
}

export const STORY_THEMES: StoryThemeConfig[] = [
  {
    label: "Space Explorer",
    icon: "🚀",
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
    label: "Jungle Adventure",
    icon: "🦁",
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
    label: "Magic School",
    icon: "🪄",
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
  {
    label: "Underwater Kingdom",
    icon: "🐠",
    description:
      "Dive into a shimmering ocean realm. Your child befriends dolphins, discovers sunken treasure, and becomes the hero of the deep.",
    shortDescription: "Oceans, merfolk, and hidden treasure",
    bgColor: "#EBF7FF",
    accentColor: "#0EA5E9",
    iconBg: "rgba(14,165,233,0.15)",
    tagBg: "rgba(14,165,233,0.12)",
    tagText: "#0369A1",
    glowColor: "#0EA5E9",
    decorations: ["🌊", "🐚", "🪸"],
    premium: true,
  },
  {
    label: "Dinosaur World",
    icon: "🦕",
    description:
      "Travel back 65 million years. Your child rides a friendly triceratops, hatches dinosaur eggs, and saves a prehistoric valley.",
    shortDescription: "Dinos, volcanoes, and big adventures",
    bgColor: "#F0F7EC",
    accentColor: "#65A30D",
    iconBg: "rgba(101,163,13,0.15)",
    tagBg: "rgba(101,163,13,0.12)",
    tagText: "#3F6212",
    glowColor: "#65A30D",
    decorations: ["🌿", "🥚", "🌋"],
    premium: true,
  },
  {
    label: "Fairy Tale Castle",
    icon: "🏰",
    description:
      "Enter an enchanted kingdom of knights and royalty. Your child outwits the dragon, rescues the kingdom, and is crowned a legend.",
    shortDescription: "Knights, dragons, and royal quests",
    bgColor: "#F5F0FF",
    accentColor: "#7C3AED",
    iconBg: "rgba(124,58,237,0.15)",
    tagBg: "rgba(124,58,237,0.12)",
    tagText: "#5B21B6",
    glowColor: "#7C3AED",
    decorations: ["👑", "⚔️", "🌹"],
    premium: true,
  },
];
