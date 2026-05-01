import type { IllustrationStyle } from "@/types/storybook";

export interface IllustrationStyleOption {
  value: IllustrationStyle;
  label: string;
  shortDescription: string;
  promptDirective: string;
  // Column position (0-indexed) in the 3×3 style-samples.png grid
  sampleGridCol: number;
  // Y background-position % to center the face within the card
  sampleYPercent: number;
  preview: {
    sky: string;
    ground: string;
    accent: string;
    frame: string;
    texture: string;
  };
}

export const DEFAULT_ILLUSTRATION_STYLE: IllustrationStyle = "classic-storybook";

export const ILLUSTRATION_STYLE_OPTIONS: IllustrationStyleOption[] = [
  {
    value: "classic-storybook",
    label: "Classic Storybook",
    shortDescription: "Warm editorial picture-book art with polished scene storytelling.",
    promptDirective:
      "Art style: classic premium children's storybook illustration. Warm editorial scene design, polished painterly rendering, soft light, rounded expressive characters, and rich environmental storytelling.",
    sampleGridCol: 0,
    sampleYPercent: 17,
    preview: {
      sky: "#f6d39f",
      ground: "#f7ede1",
      accent: "#d36b3d",
      frame: "#c86b4b",
      texture: "#f0b77d",
    },
  },
  {
    value: "watercolor",
    label: "Watercolor",
    shortDescription: "Dreamier washes, softer edges, airy texture, and luminous color bleeding.",
    promptDirective:
      "Art style: watercolor children's illustration. Soft translucent paint washes, gentle pigment blooms, textured paper feel, lighter edges, and dreamy atmospheric color transitions.",
    sampleGridCol: 1,
    sampleYPercent: 17,
    preview: {
      sky: "#bfe1e8",
      ground: "#e8f1e6",
      accent: "#6aa6b8",
      frame: "#7fba9e",
      texture: "#d5eef4",
    },
  },
  {
    value: "cartoon",
    label: "Cartoon",
    shortDescription: "Bolder shapes, cleaner silhouettes, bright color blocks, and playful energy.",
    promptDirective:
      "Art style: high-end cartoon illustration for children. Bold simplified shapes, crisp silhouettes, bright color blocking, playful facial expressions, and lively readable compositions.",
    sampleGridCol: 2,
    sampleYPercent: 17,
    preview: {
      sky: "#8fd0ff",
      ground: "#fde68a",
      accent: "#ff7a45",
      frame: "#24477a",
      texture: "#ffd166",
    },
  },
  {
    value: "gouache",
    label: "Gouache",
    shortDescription: "Matte paint, richer blocks of color, and dense, tactile brush coverage.",
    promptDirective:
      "Art style: gouache picture-book painting. Matte opaque paint, rich layered color shapes, tactile brush coverage, handcrafted depth, and bold but refined storybook composition.",
    sampleGridCol: 0,
    sampleYPercent: 60,
    preview: {
      sky: "#a7c4a0",
      ground: "#f5d8b5",
      accent: "#bc5f3d",
      frame: "#546b5b",
      texture: "#d9b489",
    },
  },
  {
    value: "colored-pencil",
    label: "Colored Pencil",
    shortDescription: "Hand-drawn line energy with layered pencil texture and softer shading.",
    promptDirective:
      "Art style: colored-pencil children's book illustration. Visible layered pencil texture, hand-drawn contours, soft crosshatching, gentle shading, and warm tactile paper character.",
    sampleGridCol: 2,
    sampleYPercent: 60,
    preview: {
      sky: "#d8d0f2",
      ground: "#f7e8c8",
      accent: "#d97b5b",
      frame: "#7a5d8f",
      texture: "#efe6fa",
    },
  },
  {
    value: "paper-cut",
    label: "Paper Cut",
    shortDescription: "Layered shapes, graphic depth, bold composition, and crafted collage feeling.",
    promptDirective:
      "Art style: paper-cut storybook collage. Layered cut-paper shapes, graphic depth, clear silhouette stacking, handcrafted composition, and playful dimensional overlaps.",
    sampleGridCol: 1,
    sampleYPercent: 100,
    preview: {
      sky: "#9ed6cb",
      ground: "#f4c98b",
      accent: "#e76f51",
      frame: "#1f5f63",
      texture: "#f8e7bc",
    },
  },
  {
    value: "soft-digital-painting",
    label: "Soft Digital Painting",
    shortDescription: "Clean modern rendering with painterly softness and smooth light gradients.",
    promptDirective:
      "Art style: soft digital painting for children's books. Clean modern rendering, smooth painterly gradients, polished lighting, soft edges, and premium contemporary storybook finish.",
    sampleGridCol: 1,
    sampleYPercent: 60,
    preview: {
      sky: "#ffd7c9",
      ground: "#fdeedb",
      accent: "#f28a61",
      frame: "#7c3f58",
      texture: "#ffe7dd",
    },
  },
];

export function getIllustrationStyleOption(style: IllustrationStyle | undefined): IllustrationStyleOption {
  return (
    ILLUSTRATION_STYLE_OPTIONS.find((option) => option.value === style) ??
    ILLUSTRATION_STYLE_OPTIONS[0]
  );
}

export function getIllustrationStyleDirective(style: IllustrationStyle | undefined): string {
  return getIllustrationStyleOption(style).promptDirective;
}
