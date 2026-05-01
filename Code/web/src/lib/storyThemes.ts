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
  backgroundImageUrl?: string;
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1511936606692-5e0d73f6b638?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1514539079130-25950c84af65?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1558613468-da6379080163?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1515593761628-37c272a009f9?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1446062061624-594b6e3403d7?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1490750967868-88df5691cc36?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&h=400&fit=crop&q=80&auto=format",
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
    backgroundImageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&h=400&fit=crop&q=80&auto=format",
  },
  {
    label: "Dragon Rider",
    icon: "🐉",
    description:
      "Your child befriends a baby dragon and together they soar over mountains, outsmart rivals, and prove that the greatest dragons choose the kindest riders.",
    shortDescription: "Dragons, mountain peaks, and daring flights",
    bgColor: "#FFF7ED",
    accentColor: "#F97316",
    iconBg: "rgba(249,115,22,0.15)",
    tagBg: "rgba(249,115,22,0.12)",
    tagText: "#9A3412",
    glowColor: "#F97316",
    decorations: ["🔥", "🏔️", "🥚"],
    premium: true,
    backgroundImageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&h=400&fit=crop&q=80&auto=format",
  },
  {
    label: "Lost Civilization",
    icon: "🗿",
    description:
      "Deep in the jungle lies a forgotten city full of ancient puzzles and glowing temples. Your child deciphers the mysteries and becomes the greatest explorer ever known.",
    shortDescription: "Temples, ancient puzzles, and hidden secrets",
    bgColor: "#F5F0E8",
    accentColor: "#92400E",
    iconBg: "rgba(146,64,14,0.15)",
    tagBg: "rgba(146,64,14,0.12)",
    tagText: "#78350F",
    glowColor: "#B45309",
    decorations: ["🏛️", "🔍", "💎"],
    premium: true,
    backgroundImageUrl: "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=600&h=400&fit=crop&q=80&auto=format",
  },
  {
    label: "Candy Kingdom",
    icon: "🍭",
    description:
      "Welcome to a land where rivers run with chocolate and clouds are made of candy floss! Your child becomes the hero who saves the sweetest kingdom from a sour spell.",
    shortDescription: "Candy castles, sugar rivers, and sweet magic",
    bgColor: "#FFF0F6",
    accentColor: "#DB2777",
    iconBg: "rgba(219,39,119,0.15)",
    tagBg: "rgba(219,39,119,0.12)",
    tagText: "#9D174D",
    glowColor: "#DB2777",
    decorations: ["🍫", "🍬", "🌈"],
    premium: true,
    backgroundImageUrl: "https://images.unsplash.com/photo-1499195333224-3ce974eecb47?w=600&h=400&fit=crop&q=80&auto=format",
  },
];
