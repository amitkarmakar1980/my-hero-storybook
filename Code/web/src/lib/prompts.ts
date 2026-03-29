// Prompts for story generation
import type { StoryInput, CharacterProfile, StoryPage } from "@/types/storybook";

export function buildCharacterProfilePrompt(input: StoryInput) {
  return `
You are creating a reusable illustrated character profile for a children's storybook.

Child name: ${input.childName}
Age band: ${input.ageBand}
Theme: ${input.theme}
Traits: ${input.traits.join(", ") || "None"}

Task:
Analyze the uploaded child photo and produce a stylized, child-safe character profile for a colorful illustrated storybook.

Requirements:
- Focus only on visible visual traits
- Keep the child warm, friendly, and age-appropriate
- Do not infer sensitive attributes
- Do not mention realism or photography
- Make the result reusable across multiple pages

Return strict JSON:
{
  "characterDescription": "...",
  "styleNotes": "...",
  "recurringVisualAnchors": ["...", "...", "..."]
}
`.trim();
}

export function buildStoryGenerationPrompt(input: StoryInput, profile: CharacterProfile) {
  return `
You are an expert children's story writer.

Write a personalized 6-page storybook.

Inputs:
- Child name: ${input.childName}
- Age band: ${input.ageBand}
- Theme: ${input.theme}
- Traits: ${input.traits.join(", ") || "None"}
- Character description: ${profile.characterDescription}
- Style notes: ${profile.styleNotes}

Requirements:
- The child is the hero
- Tone is warm, playful, magical, and safe
- Structure: delightful beginning, small challenge, happy ending
- Each page should have 2-4 short sentences
- Avoid scary, dark, violent, or copyrighted content
- Keep the language age-appropriate

Return strict JSON:
{
  "title": "...",
  "coverText": "...",
  "pages": [
    { "pageNumber": 1, "text": "..." },
    { "pageNumber": 2, "text": "..." },
    { "pageNumber": 3, "text": "..." },
    { "pageNumber": 4, "text": "..." },
    { "pageNumber": 5, "text": "..." },
    { "pageNumber": 6, "text": "..." }
  ]
}
`.trim();
}

export function buildStoryRefinementPrompt(storyJson: string, input: StoryInput) {
  return `
You are refining a children's storybook.

Inputs:
- Age band: ${input.ageBand}
- Theme: ${input.theme}

Improve this story for:
- continuity
- readability
- warmth
- age appropriateness
- lower repetition

Keep:
- same title
- same 6-page structure
- same general plot

Return strict JSON in the same structure.

Story:
${storyJson}
`.trim();
}

export function buildPageImagePromptPrompt(
  page: StoryPage,
  profile: CharacterProfile,
  theme: string,
  title: string
) {
  return `
You are generating an illustration prompt for a children's storybook page.

Story title: ${title}
Theme: ${theme}
Character description: ${profile.characterDescription}
Style notes: ${profile.styleNotes}
Recurring visual anchors: ${profile.recurringVisualAnchors.join(", ")}
Page number: ${page.pageNumber}
Page text: ${page.text}

Requirements:
- same child hero across every page
- colorful illustrated storybook style
- child-safe
- emotionally expressive
- no text inside image
- make the child the visual focus

Return strict JSON:
{
  "pageNumber": ${page.pageNumber},
  "prompt": "..."
}
`.trim();
}