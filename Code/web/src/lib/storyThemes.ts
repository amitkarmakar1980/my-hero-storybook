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
  {
    label: "Pirate Seas",
    icon: "🏴‍☠️",
    description:
      "Set sail on a daring high-seas adventure. Your child captains a galleon, decodes ancient treasure maps, and outsmarts the sneakiest pirates.",
    shortDescription: "Ships, treasure maps, and ocean daring",
    bgColor: "#FFF7ED",
    accentColor: "#EA6C00",
    iconBg: "rgba(234,108,0,0.15)",
    tagBg: "rgba(234,108,0,0.12)",
    tagText: "#92400E",
    glowColor: "#EA6C00",
    decorations: ["⚓", "🗺️", "💎"],
    premium: true,
  },
  {
    label: "Arctic Quest",
    icon: "🐧",
    description:
      "Brave a shimmering frozen world. Your child mushed sleds, befriends polar bears and penguins, and discovers a magical aurora hidden in the ice.",
    shortDescription: "Ice, auroras, and polar friends",
    bgColor: "#EFF6FF",
    accentColor: "#3B82F6",
    iconBg: "rgba(59,130,246,0.15)",
    tagBg: "rgba(59,130,246,0.12)",
    tagText: "#1D4ED8",
    glowColor: "#3B82F6",
    decorations: ["❄️", "🌌", "🐻‍❄️"],
    premium: true,
  },
  {
    label: "Superhero City",
    icon: "⚡",
    description:
      "Your child discovers they have superpowers! They soar above a glittering city, protect their neighbours, and learn that kindness is the greatest power of all.",
    shortDescription: "Powers, capes, and saving the day",
    bgColor: "#FFF1F1",
    accentColor: "#EF4444",
    iconBg: "rgba(239,68,68,0.15)",
    tagBg: "rgba(239,68,68,0.12)",
    tagText: "#991B1B",
    glowColor: "#EF4444",
    decorations: ["🦸", "🌆", "💥"],
    premium: true,
  },
  {
    label: "Enchanted Garden",
    icon: "🌸",
    description:
      "Step into a secret garden where flowers talk, fairies grant wishes, and every petal hides a tiny door to a new world of wonder.",
    shortDescription: "Fairies, talking flowers, and hidden magic",
    bgColor: "#FDF2F8",
    accentColor: "#EC4899",
    iconBg: "rgba(236,72,153,0.15)",
    tagBg: "rgba(236,72,153,0.12)",
    tagText: "#9D174D",
    glowColor: "#EC4899",
    decorations: ["🌺", "🧚", "🍄"],
    premium: true,
  },
  {
    label: "Robot Workshop",
    icon: "🤖",
    description:
      "Your child is the greatest young inventor in the galaxy! They build brilliant robots, solve impossible puzzles, and save the city with pure ingenuity.",
    shortDescription: "Robots, gadgets, and brilliant inventions",
    bgColor: "#F0F4FF",
    accentColor: "#6366F1",
    iconBg: "rgba(99,102,241,0.15)",
    tagBg: "rgba(99,102,241,0.12)",
    tagText: "#3730A3",
    glowColor: "#6366F1",
    decorations: ["⚙️", "💡", "🔧"],
    premium: true,
  },
  {
    label: "Cloud Kingdom",
    icon: "☁️",
    description:
      "Soar above the world into a kingdom built of clouds and sunshine. Your child rides sky whales, befriends storm sprites, and discovers the secret of rainbows.",
    shortDescription: "Sky adventures, cloud castles, and rainbows",
    bgColor: "#F0FAFF",
    accentColor: "#0891B2",
    iconBg: "rgba(8,145,178,0.15)",
    tagBg: "rgba(8,145,178,0.12)",
    tagText: "#155E75",
    glowColor: "#0891B2",
    decorations: ["🌤️", "🌈", "🐳"],
    premium: true,
  },
];
