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
  const GLOBAL_STYLE_PREFIX = "A bright, colorful, soft 3D-style children's storybook illustration, consistent character design, smooth lighting, rounded shapes, Pixar-like quality";

  return `
You are generating a visual illustration prompt for a children's storybook page.
ALL images must be visually consistent and use the EXACT same art style.

CRITICAL - Apply this style to EVERY image:
"${GLOBAL_STYLE_PREFIX}"

Story Context:
- Title: ${title}
- Theme: ${theme}
- Genre: ${theme} adventure story for children

Character (MUST appear consistently in EVERY image):
- Name: Check the page text for context
- Visual Description: ${profile.characterDescription}
- Consistent Visual Anchors: ${profile.recurringVisualAnchors.join(", ")}
- Style Notes: ${profile.styleNotes}

Current Page:
- Page Number: ${page.pageNumber}
- Scene: ${page.text}

REQUIREMENTS for this illustration:
1. Style: ${GLOBAL_STYLE_PREFIX}
2. Main subject: The child character (featured prominently)
3. Setting: Reflect the page's story
4. Mood: Warm, joyful, adventurous - match the page text
5. Colors: Bright, vibrant, child-friendly palette
6. No text or words in the image
7. Character must be visually consistent with previous pages
8. Include: The character's recurring visual anchors (${profile.recurringVisualAnchors.join(", ")})
9. Quality: High-quality, polished illustration (NOT sketch, NOT black & white, NOT realistic photography)
10. Lighting: Soft, glowing, magical lighting appropriate for children's book

Return ONLY valid JSON (no markdown, no code blocks):
{
  "pageNumber": ${page.pageNumber},
  "prompt": "Complete detailed prompt that includes the global style prefix and all requirements"
}
`.trim();
}