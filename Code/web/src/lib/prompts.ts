// Prompts for story generation
import type { StoryInput, CharacterProfile, StoryPage } from "@/types/storybook";

// =============================================================================
// PIPELINE MODE — controls which image prompt builder is used
// Set to "baseline" for simple, stable generation.
// Set to "advanced" to re-enable retry reinforcement and stricter validation.
// =============================================================================

export const IMAGE_PIPELINE_MODE: "baseline" | "advanced" = "baseline";

// =============================================================================
// PART 1 — BASELINE IMAGE PROMPT BUILDERS
// Simple, clean, stable. These are the defaults.
// =============================================================================

/**
 * Short global style instruction. Tells the model what kind of art to make.
 * Kept tight so it doesn't compete with the scene prompt.
 */
export function buildBaseStylePrompt(): string {
  return `Premium children's picture book illustration. Full-color digital painting with warm, soft lighting. Expressive, child-friendly character design. Rich environmental storytelling. Single coherent illustrated scene. Published storybook quality — warm, magical, and visually engaging.`;
}

/**
 * Concise character anchor. One clear description block, one consistency rule.
 */
export function buildCharacterAnchor(profile: CharacterProfile): string {
  const traits = [
    profile.appearanceAge   && `Age appearance: ${profile.appearanceAge}`,
    profile.skinTone        && `Skin tone: ${profile.skinTone}`,
    profile.faceShape       && `Face: ${profile.faceShape}`,
    profile.hair            && `Hair: ${profile.hair}`,
    profile.eyes            && `Eyes: ${profile.eyes}`,
    profile.build           && `Build: ${profile.build}`,
    profile.signatureFeatures && `Distinctive features: ${profile.signatureFeatures}`,
    profile.defaultOutfit   && `Outfit: ${profile.defaultOutfit}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `CHILD HERO CHARACTER — keep identical across every page:
${profile.characterDescription}
${traits}

Maintain the same face, hairstyle, skin tone, age appearance, and body proportions on every page. This is the same child throughout the entire book.`;
}

/**
 * Simple scene description. What the child is doing, where, and how they feel.
 */
export function buildScenePrompt(page: StoryPage): string {
  return `SCENE FOR PAGE ${page.pageNumber}:
"${page.text}"

Illustrate the child as the clear focal point of this story moment. Show the setting, action, and emotion described above. Include full environmental context — not an isolated portrait.`;
}

/**
 * Short negative constraints. Focused on the most common failure modes only.
 */
export function buildShortNegatives(): string {
  return `No text, letters, numbers, speech bubbles, captions, or labels anywhere in the image.
No black-and-white or sketch style. No collage or character sheet. No multiple copies of the child.`;
}

/**
 * Concise self-check. One sentence, four conditions.
 */
export function buildSimplePromptSelfCheck(): string {
  return `Verify the image shows: (1) a full-color children's story scene, (2) the same child identity described above, (3) a single illustrated moment, (4) no text or lettering. If any condition is not met, adjust and generate the corrected image.`;
}

/**
 * Assembles the final page image prompt for Imagen.
 * Baseline mode: simple 4-part structure.
 * Advanced mode: full validation and reinforcement (re-enable when prompt quality is stable).
 */
export function buildFinalImagePrompt(
  profile: CharacterProfile,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  if (IMAGE_PIPELINE_MODE === "advanced") {
    return _buildAdvancedImagePrompt(profile, page, options);
  }

  // Baseline: style → character → scene → negatives → self-check
  return [
    buildBaseStylePrompt(),
    "",
    buildCharacterAnchor(profile),
    "",
    buildScenePrompt(page),
    "",
    buildShortNegatives(),
    "",
    buildSimplePromptSelfCheck(),
  ].join("\n");
}

/**
 * Dedicated cover image prompt. Simpler and focused on a hero moment.
 */
export function buildCoverImagePrompt(
  profile: CharacterProfile,
  storyTitle: string
): string {
  return [
    `Premium children's picture book cover illustration. Full-color, warm, magical, visually striking. Strong central composition suitable for a book cover.`,
    "",
    buildCharacterAnchor(profile),
    "",
    `COVER SCENE: The child hero stands prominently at the center in a confident, adventurous pose that captures the spirit of their story. Magical, rich background with warm lighting and vibrant colors. Leave visual space at the top of the image — the title "${storyTitle}" will be added by the app and must not appear inside the illustration.`,
    "",
    buildShortNegatives(),
    "",
    buildSimplePromptSelfCheck(),
  ].join("\n");
}

// =============================================================================
// PART 2 — ADVANCED IMAGE PROMPT BUILDERS (disabled by default)
// Re-enable by setting IMAGE_PIPELINE_MODE = "advanced"
// =============================================================================

// Global style prefix used by the advanced path
export const GLOBAL_STYLE_PREFIX = `
VISUAL STYLE DIRECTIVE — Critical, locked, unchanging across all pages:

This is a PREMIUM CHILDREN'S PICTURE BOOK ILLUSTRATION.
Art direction: warm, whimsical, editorially polished storybook scene.
Rendering: full-color digital painting style inspired by soft watercolor and gouache.
Character design: rounded, friendly, expressive child-friendly faces.
Composition: complete environment storytelling, not isolated portraits.
Quality: published children's book illustration; editorial storybook standard.
Emotional tone: magically warm, playful, wonder-filled, age-appropriate.
Consistency: this exact style persists on every page of this book.

Visual anti-failures (explicit prohibitions):
• NOT sketch-like, line-art-only, or technical drawing
• NOT manga, anime, or comic-book style illustration
• NOT storyboard, concept art sheet, or multiple-pose grid
• NOT character sheet, pose turnaround, or repeated-clone collage
• NOT monochrome, black-and-white, or limited-palette drawing
• NOT photorealistic, 3D-rendered, or photograph
• NOT UI mockup, app screen, or digital interface
• NOT portrait on blank floating background; must show environment
• NOT avatar-style isolated head; must be integrated into scene
• NOT generic stock children's art; must be premium storybook quality
`.trim();

export function buildNegativeConstraints(): string {
  return `
HARD NEGATIVE REQUIREMENTS — No image ever produced should match ANY of these:

Content restrictions (will reject image if present):
✗ Any rendered text: letters, words, numbers, captions, labels, speech bubbles, dialogue boxes
✗ Any typographic content: handwriting, signs, posters, banners, logos, titles, page numbers
✗ Any printed or written marks: watermarks, copyright text, subtitles
✗ Black-and-white or monochrome rendering
✗ Sketch, line-art-only, or technical drawing appearance
✗ Collage, character sheet, pose grid, or multiple-clone composition
✗ Photorealistic or 3D-render look
✗ Manga, anime, or storyboard style
✗ Avatar portrait on blank background (must be scene-integrated)
✗ Deformed anatomy: missing/extra fingers, incorrect proportions, disconnected limbs
✗ Off-model child (inconsistent with character profile from prior pages)
✗ Generic stock art or unrelated subject matter
`.trim();
}

export function buildNegativeConstraintsBlock(): string {
  return buildNegativeConstraints();
}

export function buildPromptSelfCheckBlock(): string {
  return `
MANDATORY PROMPT SELF-CHECK — Before generating image, verify:

✓ Condition 1: Same child identity as established in the character anchor?
✓ Condition 2: Same face shape, hairstyle, skin tone, age appearance, body proportions?
✓ Condition 3: ONE coherent story scene with clear setting?
✓ Condition 4: NO instruction to render text, letters, numbers, or typographic content?
✓ Condition 5: Matches global style (premium full-color storybook illustration)?
✓ Condition 6: Free of requests for sketch, monochrome, line-art, or avatar-portrait?
✓ Condition 7: Environment and storytelling integration (not isolated floating portrait)?

If all ✓: Proceed with image generation. If any ✗: Revise, re-check, then generate.
`.trim();
}

/** @internal Used by advanced mode only */
function _buildCharacterAnchorAdvanced(profile: CharacterProfile): string {
  return `
CHARACTER IDENTITY LOCK — Inject verbatim on every page, no modifications:

The child hero must maintain IDENTICAL visual identity across every page.

Physical appearance (locked, unchanging):
- Age appearance: ${profile.appearanceAge || "matches the uploaded photo"}
- Face shape: ${profile.faceShape || "matches the uploaded photo"}
- Skin tone: ${profile.skinTone || "matches the uploaded photo"}
- Hair (style + color + texture): ${profile.hair || "matches the uploaded photo"}
- Eye shape and color: ${profile.eyes || "matches the uploaded photo"}
- Body build and proportions: ${profile.build || "matches the uploaded photo"}
- Signature features: ${profile.signatureFeatures || "not specified"}
- Default outfit: ${profile.defaultOutfit || "not specified"}

MANDATORY CONSISTENCY RULES:
→ Same face shape, facial proportions, and facial structure across all pages
→ Same body type, height, and body proportions
→ Same skin tone; do not shift or alter
→ Same hair color, style, and texture
→ Same age appearance on every page
→ Show ONE main child hero on every page
`.trim();
}

/** @internal Used by advanced mode only */
function _buildAdvancedImagePrompt(
  profile: CharacterProfile,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  const pageContext = options?.reinforceConsistency
    ? `CONSISTENCY REINFORCEMENT (Pages 2–6):\nYou are illustrating page ${page.pageNumber}. Match the visual style and character identity from page 1 exactly. No reinterpretation, no style drift, no character redesign.`
    : `PAGE 1 — VISUAL LANGUAGE ESTABLISHMENT:\nThis is the first page. Your illustration style, character treatment, and rendering approach will define the ENTIRE visual identity for all remaining pages.`;

  return `
${GLOBAL_STYLE_PREFIX}

${_buildCharacterAnchorAdvanced(profile)}

${pageContext}

SCENE FOR THIS PAGE (this is the only part that changes):
Story moment: "${page.text}"
Illustration task:
- Depict the exact scene and action described above
- Show the child as clear focal point in this specific moment
- Include full environment context: setting, atmosphere, supporting elements
- Express the emotion and action of the scene

${buildNegativeConstraints()}

${buildPromptSelfCheckBlock()}

FINALIZE: Generate one coherent, premium children's storybook illustration matching all conditions above.
`.trim();
}

export function buildRetryReinforcement(
  invalidReason: string | undefined,
  qualityFlags?: string[]
): string {
  if (!invalidReason) {
    return `RETRY ATTEMPT — REINFORCED REQUIREMENTS:\nThe previous attempt did not meet quality standards. Apply stricter adherence to ALL conditions below:`;
  }

  const reinforcements: Record<string, string> = {
    monochrome_or_black_and_white: `RETRY — FULL COLOR REQUIREMENT:\nThe previous image was monochrome. MUST be FULL COLOR with rich, saturated palette. Warm, vibrant, colorful painting style only.`,
    line_art_or_sketch: `RETRY — NO SKETCH, NO LINE ART:\nThe previous attempt was line-art or sketch-style. MUST be full PAINTED illustration. Soft, blended brushwork. No visible outlines.`,
    isolated_face_or_avatar: `RETRY — FULL ENVIRONMENTAL SCENE:\nThe previous image showed only an isolated face. MUST be a complete ENVIRONMENTAL SCENE. Show the character interacting with the world.`,
    collage_or_character_sheet: `RETRY — SINGLE COHERENT SCENE:\nThe previous attempt was a collage or character sheet. MUST be ONE SINGLE COHERENT SCENE. One child, one pose, one moment.`,
    text_artifact: `RETRY — ABSOLUTELY NO TEXT:\nThe previous image contained text or labels. ABSOLUTELY NO TEXT of any kind. Pure visual storytelling only.`,
    inconsistent_character: `RETRY — CONSISTENT CHARACTER IDENTITY:\nThe child's appearance was inconsistent. SAME face, hairstyle, body proportions, skin tone, and age as page 1.`,
    low_information_scene: `RETRY — RICH STORY SCENE:\nThe previous scene had insufficient detail. RICH, detailed environment. Multiple layers of visual storytelling.`,
  };

  return reinforcements[invalidReason] || `RETRY ATTEMPT — REINFORCED STANDARDS:\nReapply all base requirements with heightened precision.`;
}

export function buildRetryImagePrompt(
  originalPrompt: string,
  invalidReason: string | undefined,
  qualityFlags?: string[]
): string {
  const reinforcement = buildRetryReinforcement(invalidReason, qualityFlags);
  return `${reinforcement}\n\n---\n\nORIGINAL SCENE REQUIREMENTS (applied again):\n\n${originalPrompt}`.trim();
}

// =============================================================================
// PART 3 — STORY GENERATION PROMPTS (unchanged)
// =============================================================================

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
  "recurringVisualAnchors": ["...", "...", "..."],
  "appearanceAge": "description of age appearance (e.g., 'appears 5-6 years old')",
  "faceShape": "face shape (e.g., 'round, soft features')",
  "skinTone": "skin tone (e.g., 'warm medium brown')",
  "hair": "detailed hair description (e.g., 'shoulder-length curly black hair')",
  "eyes": "eye description (e.g., 'large brown eyes, bright and curious')",
  "build": "body build (e.g., 'average build, playful proportions')",
  "signatureFeatures": "unique identifying features (e.g., 'happy smile, expressive face')",
  "defaultOutfit": "baseline clothing (e.g., 'colorful shirt, comfortable pants')"
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
  ],
  "ending": "..."
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
