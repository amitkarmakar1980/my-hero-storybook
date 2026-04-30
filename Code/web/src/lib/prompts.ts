// Prompts for story generation
import type { StoryInput, CharacterProfile, StoryPage, StoryCharacterInput } from "@/types/storybook";

function normalizeProfiles(profileOrProfiles: CharacterProfile | CharacterProfile[]): CharacterProfile[] {
  return Array.isArray(profileOrProfiles) ? profileOrProfiles : [profileOrProfiles];
}

function getCharacterNames(input: StoryInput): string[] {
  const namesFromCharacters = input.characters?.map((character) => character.name.trim()).filter(Boolean) ?? [];
  const names = namesFromCharacters.length > 0
    ? namesFromCharacters
    : input.characterNames?.map((name) => name.trim()).filter(Boolean) ?? [];
  if (names.length > 0) {
    return names;
  }

  return input.childName.trim() ? [input.childName.trim()] : [];
}

function getCharacterInputs(input: StoryInput): StoryCharacterInput[] {
  if (input.characters && input.characters.length > 0) {
    return input.characters
      .map((character) => ({
        ...character,
        name: character.name.trim(),
        traits: character.traits ?? [],
      }))
      .filter((character) => character.name);
  }

  const characterNames = getCharacterNames(input);
  const fallbackTraits = input.traits ?? [];

  return characterNames.map((name) => ({
    name,
    age: 6,
    traits: fallbackTraits,
  }));
}

function getCharacterInput(input: StoryInput, characterName: string): StoryCharacterInput | undefined {
  return getCharacterInputs(input).find((character) => character.name === characterName);
}

function formatCharacterNames(names: string[]): string {
  if (names.length === 0) return "the child hero";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

// =============================================================================
// PIPELINE MODE — controls which image prompt builder is used
// Set to "baseline" for simple, stable generation.
// Set to "advanced" to re-enable retry reinforcement and stricter validation.
// =============================================================================

export const IMAGE_PIPELINE_MODE: "baseline" | "advanced" = "advanced";

// =============================================================================
// PART 1 — BASELINE IMAGE PROMPT BUILDERS
// Simple, clean, stable. These are the defaults.
// =============================================================================

/**
 * Short global style instruction. Tells the model what kind of art to make.
 * Kept tight so it doesn't compete with the scene prompt.
 */
export function buildBaseStylePrompt(): string {
  return `Premium children's picture book illustration. Full-color digital painting with warm, soft lighting. Expressive, child-friendly character design. Rich environmental storytelling. Single coherent illustrated scene. Published storybook quality — warm, magical, and visually engaging. Stylized illustration is allowed, but the child's facial identity must stay unmistakably faithful to the uploaded photo reference, including hairline, hair density, and whether the head is bald, thinning, or full-haired.`;
}

export function buildImageDimensionLock(): string {
  return `PAGE FORMAT LOCK — hard constraint for every generated illustration in this book:
Use the exact same portrait 4:5 storybook page format for every image.
Every interior page illustration and the cover must share the same canvas shape, framing system, and overall image dimensions.
Do not generate landscape, square, panoramic, ultra-wide, or mixed aspect ratios.
Frame the subject and environment so the illustration fits cleanly inside that same vertical 4:5 storybook page every time.`;
}

export function buildCoverImageDimensionLock(): string {
  return `COVER FORMAT LOCK — hard constraint for the cover illustration only:
Use a wide landscape 16:9 storybook cover format.
The cover image must be clearly horizontal, not portrait, not square, not panoramic, and not mixed orientation.
Fill the full cover frame with a landscape composition so the illustration occupies the entire cover image container cleanly.`;
}

/**
 * Concise character anchor. One clear description block, one consistency rule.
 */
export function buildCharacterAnchor(profile: CharacterProfile | CharacterProfile[]): string {
  const profiles = normalizeProfiles(profile);

  return `CHARACTER IDENTITY LOCK — keep every named character consistent across every page and as close as possible to the uploaded photo reference:
${profiles
  .map((characterProfile, index) => {
    const traits = [
      typeof characterProfile.exactAge === "number" && `Exact age: ${characterProfile.exactAge}`,
      characterProfile.appearanceAge && `Age appearance: ${characterProfile.appearanceAge}`,
      characterProfile.skinTone && `Skin tone: ${characterProfile.skinTone}`,
      characterProfile.faceShape && `Face: ${characterProfile.faceShape}`,
      characterProfile.hair && `Hair: ${characterProfile.hair}`,
      characterProfile.eyes && `Eyes: ${characterProfile.eyes}`,
      characterProfile.build && `Build: ${characterProfile.build}`,
      characterProfile.signatureFeatures && `Distinctive features: ${characterProfile.signatureFeatures}`,
      characterProfile.defaultOutfit && `Outfit: ${characterProfile.defaultOutfit}`,
    ]
      .filter(Boolean)
      .join("\n");

    const recurringAnchors = characterProfile.recurringVisualAnchors?.length
      ? `Recurring visual anchors:\n${characterProfile.recurringVisualAnchors.map((anchor) => `- ${anchor}`).join("\n")}`
      : "";

    return `CHARACTER ${index + 1} — ${characterProfile.characterName}${index === 0 ? " (main character)" : ""}:
${characterProfile.characterDescription}
${traits}
${recurringAnchors}`;
  })
  .join("\n\n")}

Maintain each character's same face, hairstyle, hairline, hair density, skin tone, eye shape, age appearance, and body proportions on every page. Preserve the same recognizable facial identity from the uploaded photo, not a generic child with similar features. Never add hair if the reference is bald or thinning, and never remove hair if the reference clearly has it. When multiple named characters appear together, keep them visually distinct and on-model.`;
}

/**
 * Simple scene description. What the child is doing, where, and how they feel.
 */
export function buildScenePrompt(page: StoryPage): string {
  return `SCENE FOR PAGE ${page.pageNumber}:
"${page.text}"

Illustrate the child as the clear focal point of this story moment. Show the setting, action, and emotion described above. Include full environmental context, cinematic composition, expressive poses, layered foreground/background detail, and a strong sense of motion or wonder where appropriate. This must read like a premium storybook spread, not a generic portrait.`;
}

/**
 * Short negative constraints. Focused on the most common failure modes only.
 */
export function buildShortNegatives(): string {
  return `No text, letters, numbers, speech bubbles, captions, or labels anywhere in the image.
No black-and-white or sketch style. No collage or character sheet. No multiple copies of the child.
No landscape, square, panoramic, ultra-wide, or inconsistent aspect ratios. Do not change page dimensions between images.`;
}

/**
 * Concise self-check. One sentence, four conditions.
 */
export function buildSimplePromptSelfCheck(): string {
  return `Verify the image shows: (1) a full-color children's story scene, (2) the same child identity described above, (3) a single illustrated moment, (4) no text or lettering, (5) the exact same portrait 4:5 page format used for every image in the book. If any condition is not met, adjust and generate the corrected image.`;
}

/**
 * Assembles the final page image prompt for Imagen.
 * Baseline mode: simple 4-part structure.
 * Advanced mode: full validation and reinforcement (re-enable when prompt quality is stable).
 */
export function buildFinalImagePrompt(
  profile: CharacterProfile | CharacterProfile[],
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  return buildFinalImagePromptFromContext(
    buildSharedImageGenerationContext(profile),
    page,
    options
  );
}

export function buildSharedImageGenerationContext(
  profile: CharacterProfile | CharacterProfile[]
): string {
  if (IMAGE_PIPELINE_MODE === "advanced") {
    return [GLOBAL_STYLE_PREFIX, "", _buildCharacterAnchorAdvanced(profile)].join("\n");
  }

  return [buildBaseStylePrompt(), "", buildCharacterAnchor(profile)].join("\n");
}

export function buildFinalImagePromptFromContext(
  sharedContextPrompt: string,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  if (IMAGE_PIPELINE_MODE === "advanced") {
    return _buildAdvancedImagePromptFromContext(sharedContextPrompt, page, options);
  }

  return [
    sharedContextPrompt,
    "",
    buildImageDimensionLock(),
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
  profile: CharacterProfile | CharacterProfile[],
  storyTitle: string
): string {
  return buildCoverImagePromptFromContext(
    buildSharedImageGenerationContext(profile),
    storyTitle,
    normalizeProfiles(profile).map((character) => character.characterName)
  );
}

export function buildCoverImagePromptFromContext(
  sharedContextPrompt: string,
  storyTitle: string,
  characterNames: string[]
): string {
  const mainCharacter = characterNames[0] ?? "the main character";
  const supportingCharacters = characterNames.slice(1);

  return [
    sharedContextPrompt,
    "",
    buildCoverImageDimensionLock(),
    "",
    `COVER SCENE: ${mainCharacter} stands prominently at the center in a confident, adventurous pose that captures the spirit of the story.${supportingCharacters.length > 0 ? ` Include ${supportingCharacters.join(", ")} nearby as clearly recognizable supporting characters.` : ""} The background should feel grand, magical, and specific to the story world, with warm lighting, rich color contrast, and premium bookstore-cover composition. Leave visual space at the top of the image — the title "${storyTitle}" will be added by the app and must not appear inside the illustration.`,
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
Photo fidelity: the uploaded child photo is the canonical identity reference for face shape, facial proportions, hairline, hairstyle, skin tone, and other visible distinguishing features. Keep a strong likeness while rendering it as storybook art.
Interior page format: every interior illustration in this book uses the exact same portrait 4:5 page dimensions and framing system.

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
✗ Mixed aspect-ratio output for interior story pages
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
✓ Condition 8: Uses the required locked aspect ratio for this illustration type?

If all ✓: Proceed with image generation. If any ✗: Revise, re-check, then generate.
`.trim();
}

/** @internal Used by advanced mode only */
function _buildCharacterAnchorAdvanced(profile: CharacterProfile | CharacterProfile[]): string {
  const profiles = normalizeProfiles(profile);

  return `
CHARACTER IDENTITY LOCK — Inject verbatim on every page, no modifications:

${profiles
  .map(
    (characterProfile, index) => `Character ${index + 1}: ${characterProfile.characterName}${index === 0 ? " (main character)" : ""}
- Exact age: ${characterProfile.exactAge || "must match the stated age exactly"}
- Age appearance: ${characterProfile.appearanceAge || "matches the uploaded photo"}
- Face shape: ${characterProfile.faceShape || "matches the uploaded photo"}
- Skin tone: ${characterProfile.skinTone || "matches the uploaded photo"}
- Hair (style + color + texture): ${characterProfile.hair || "matches the uploaded photo"}
- Eye shape and color: ${characterProfile.eyes || "matches the uploaded photo"}
- Body build and proportions: ${characterProfile.build || "matches the uploaded photo"}
- Signature features: ${characterProfile.signatureFeatures || "not specified"}
- Default outfit: ${characterProfile.defaultOutfit || "not specified"}`
  )
  .join("\n\n")}

MANDATORY CONSISTENCY RULES:
→ Treat the uploaded photo as the canonical identity reference; do not genericize or redesign the face
→ Keep every named character visually distinct and consistent across all pages
→ Same face shape, facial proportions, and facial structure for each character
→ Same body type, height, and body proportions for each character
→ Same skin tone; do not shift or alter
→ Same hair color, style, texture, hairline, and hair density for each character
→ Same exact age appearance on every page; do not age characters up or down
→ Keep the first character as the primary focal hero when multiple characters appear
`.trim();
}

/** @internal Used by advanced mode only */
function _buildAdvancedImagePromptFromContext(
  sharedContextPrompt: string,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  const pageContext = options?.reinforceConsistency
    ? `CONSISTENCY REINFORCEMENT (Pages 2–6):\nYou are illustrating page ${page.pageNumber}. Match the visual style and character identity from page 1 exactly. No reinterpretation, no style drift, no character redesign.`
    : `PAGE 1 — VISUAL LANGUAGE ESTABLISHMENT:\nThis is the first page. Your illustration style, character treatment, and rendering approach will define the ENTIRE visual identity for all remaining pages.`;

  return `
${sharedContextPrompt}

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
  invalidReason: string | undefined
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
  const reinforcement = buildRetryReinforcement(invalidReason);
  return `${reinforcement}\n\n---\n\nORIGINAL SCENE REQUIREMENTS (applied again):\n\n${originalPrompt}`.trim();
}

// =============================================================================
// PART 3 — STORY GENERATION PROMPTS (unchanged)
// =============================================================================

export function buildCharacterProfilePrompt(
  input: StoryInput,
  characterName: string,
  allCharacterNames: string[]
) {
  const supportingCharacters = allCharacterNames.filter((name) => name !== characterName);
  const characterInput = getCharacterInput(input, characterName);

  return `
You are creating a reusable illustrated character profile for a children's storybook.

Character name: ${characterName}
${supportingCharacters.length > 0 ? `Other named characters in the story: ${supportingCharacters.join(", ")}` : "Other named characters in the story: None"}
Exact age: ${characterInput?.age ?? "unknown"}
Theme: ${input.theme}
Traits: ${characterInput?.traits.join(", ") || input.traits?.join(", ") || "None"}

Task:
Analyze the uploaded child photo and produce a stylized, child-safe character profile for this character in a colorful illustrated storybook.

Requirements:
- Treat the uploaded photo as the canonical identity reference for this character
- Preserve the child's facial identity as faithfully as possible while converting it into premium storybook art
- Focus only on visible visual traits
- Keep the child warm, friendly, and age-appropriate
- Do not infer sensitive attributes
- Do not mention realism or photography
- Make the result reusable across multiple pages
- The uploaded photo is only for ${characterName}
- The illustrated character must read visually as exactly ${characterInput?.age ?? "the stated"} years old
- Do not make the character look older, younger, or more generic than the uploaded child
- Call out face shape, hairline, hairstyle, eye area, smile, and any other distinctive visible features that should stay fixed in every illustration

Return strict JSON:
{
  "characterName": "${characterName}",
  "characterDescription": "...",
  "styleNotes": "...",
  "recurringVisualAnchors": ["...", "...", "..."],
  "exactAge": ${characterInput?.age ?? 6},
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

export function buildStoryGenerationPrompt(
  input: StoryInput,
  profile: CharacterProfile | CharacterProfile[]
) {
  const characterNames = getCharacterNames(input);
  const primaryCharacter = characterNames[0] ?? input.childName;
  const characterList = formatCharacterNames(characterNames);
  const profiles = normalizeProfiles(profile);
  const characters = getCharacterInputs(input);
  const primaryCharacterInput = characters[0];

  return `
You are an expert children's story writer.

Write a personalized 6-page storybook.

Inputs:
- Character names: ${characterList}
- Primary illustrated character: ${primaryCharacter}
- Primary character age: ${primaryCharacterInput?.age ?? "unknown"}
- Theme: ${input.theme}
- Character details:
${characters.map((character) => `  - ${character.name}: age ${character.age}; personality traits ${character.traits.join(", ") || "None"}`).join("\n")}
- Character references:
${profiles.map((characterProfile) => `  - ${characterProfile.characterName}: ${characterProfile.characterDescription}`).join("\n")}

Requirements:
- ${characterNames.length > 1 ? `All of these characters are part of the main cast: ${characterList}` : `The child hero is ${primaryCharacter}`}
- Every named character must appear in the story and be meaningfully included in the plot
- Do not omit any named character from the 6-page story
- The way each character behaves, speaks, and is described must fit their exact age
- Story moments should feel plausible for these exact ages while still being magical and adventurous
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
  const characterNames = getCharacterNames(input);
  const primaryCharacterInput = getCharacterInputs(input)[0];

  return `
You are refining a children's storybook.

Inputs:
- Character names: ${formatCharacterNames(characterNames)}
- Primary character age: ${primaryCharacterInput?.age ?? "unknown"}
- Theme: ${input.theme}

Improve this story for:
- continuity
- readability
- warmth
- age appropriateness
- lower repetition
- exact age fit for every named character

Keep:
- same title
- same 6-page structure
- same general plot
- every named character included in the story
- each named character behaving like their exact entered age

Return strict JSON in the same structure.

Story:
${storyJson}
`.trim();
}
