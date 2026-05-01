// Prompts for story generation
import { getIllustrationStyleDirective, getIllustrationStyleOption } from "@/lib/illustrationStyles";
import type { IllustrationStyle, StoryInput, CharacterProfile, StoryPage, StoryCharacterInput, StoryLength } from "@/types/storybook";

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

function getStoryLength(input: StoryInput): StoryLength {
  return input.storyLength ?? "short";
}

function buildStoryLengthRequirements(input: StoryInput): string {
  const storyLength = getStoryLength(input);

  if (storyLength === "long") {
    return `Story length: long.
- Each page should be 6-8 sentences and at least 100 words.
- Keep each page substantial, immersive, and descriptive while still readable aloud.`;
  }

  if (storyLength === "standard") {
    return `Story length: standard.
- Each page should be 4-6 sentences and roughly 70-90 words.
- Give each page more narrative detail than a short picture-book page without becoming dense.`;
  }

  return `Story length: short.
- Each page should be 2-4 sentences and roughly 45-65 words.
- Keep the writing concise, airy, and illustration-friendly.`;
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
export function buildBaseStylePrompt(illustrationStyle?: IllustrationStyle): string {
  return `Premium children's picture book illustration. ${getIllustrationStyleDirective(illustrationStyle)} Full-color rendering with warm, soft lighting. Expressive, child-friendly character design. Rich environmental storytelling. Single coherent illustrated scene. Published storybook quality — warm, magical, and visually engaging. Stylized illustration is allowed, but the child's facial identity must stay unmistakably faithful to the uploaded photo reference, including hairline, hair density, and whether the head is bald, thinning, or full-haired.`;
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
  return `ILLUSTRATION FOR PAGE ${page.pageNumber}:
Story moment: "${page.text}"

Draw exactly what happens in this moment: the child character performing the specific action described, in the specific setting described, with the specific emotion described. Show the full scene — foreground, background, environment, lighting, and atmosphere. The child must be the clear focal point. Use expressive poses and rich environmental detail. This must be a complete illustrated scene, not a portrait or character study.`;
}

/**
 * Short negative constraints. Focused on the most common failure modes only.
 */
export function buildShortNegatives(): string {
  return `ABSOLUTE RULE — NO TEXT: Do not render any text, words, letters, numbers, signs, labels, captions, speech bubbles, or written marks anywhere in the image. Not on signs, not on books, not on clothing, not anywhere.
No black-and-white or sketch style. No collage or character sheet. No multiple copies of the child.`;
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
  options?: { reinforceConsistency?: boolean; illustrationStyle?: IllustrationStyle }
): string {
  return buildFinalImagePromptFromContext(
    buildSharedImageGenerationContext(profile, options?.illustrationStyle),
    page,
    options
  );
}

export function buildSharedImageGenerationContext(
  profile: CharacterProfile | CharacterProfile[],
  illustrationStyle?: IllustrationStyle
): string {
  if (IMAGE_PIPELINE_MODE === "advanced") {
    return [buildAdvancedGlobalStylePrefix(illustrationStyle), "", _buildCharacterAnchorAdvanced(profile)].join("\n");
  }

  return [buildBaseStylePrompt(illustrationStyle), "", buildCharacterAnchor(profile)].join("\n");
}

export function buildImagenCharacterDescription(profile: CharacterProfile): string {
  const parts = [
    profile.exactAge && `${profile.exactAge}-year-old`,
    profile.skinTone,
    profile.faceShape ? `face with ${profile.faceShape}` : null,
    profile.hair,
    profile.eyes ? `${profile.eyes}` : null,
    profile.build,
    profile.signatureFeatures,
  ].filter(Boolean);

  const appearance = parts.length > 0 ? parts.join(", ") : profile.characterDescription;
  const outfit = profile.defaultOutfit ?? "colorful age-appropriate clothing";

  return `${profile.characterName}: ${appearance}, wearing ${outfit}.`;
}

export function buildImagenSharedContext(
  profile: CharacterProfile | CharacterProfile[],
  illustrationStyle?: IllustrationStyle
): string {
  const profiles = normalizeProfiles(profile);
  const characterLines = profiles.map(buildImagenCharacterDescription).join(" ");

  return `Children's picture book illustration. ${getIllustrationStyleDirective(illustrationStyle)} Warm soft lighting, whimsical and magical feel, rich detail, published storybook quality. No text, no words, no letters, no signs, no labels anywhere. Not a sketch or line art. Not monochrome.

Character: ${characterLines}`;
}

/** For Imagen models — short, visual, no instruction language. Negative prompt handles the "don'ts". */
export function buildImagenPagePrompt(sharedContext: string, page: StoryPage): string {
  return `${sharedContext}\n\nScene: ${page.text}`;
}

/** For Imagen cover — short, visual. */
export function buildImagenCoverPrompt(sharedContext: string, storyTitle: string, characterNames: string[]): string {
  const mainCharacter = characterNames[0] ?? "the main character";
  const supporting = characterNames.slice(1);
  return `${sharedContext}\n\nScene: ${mainCharacter} stands confidently at the center in an adventurous pose, set against a grand magical world full of color and wonder.${supporting.length > 0 ? ` ${supporting.join(" and ")} appear nearby.` : ""} Wide landscape composition, rich warm lighting, vibrant colors, storybook cover quality.`;
}

/** For Gemini models — full instruction prompt with style directives and self-check. */
export function buildFinalImagePromptFromContext(
  sharedContextPrompt: string,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean; illustrationStyle?: IllustrationStyle }
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
  storyTitle: string,
  illustrationStyle?: IllustrationStyle
): string {
  return buildCoverImagePromptFromContext(
    buildSharedImageGenerationContext(profile, illustrationStyle),
    storyTitle,
    normalizeProfiles(profile).map((character) => character.characterName)
  );
}

/** For Gemini models — full instruction prompt for cover. */
export function buildCoverImagePromptFromContext(
  sharedContextPrompt: string,
  storyTitle: string,
  characterNames: string[],
  illustrationStyle?: IllustrationStyle
): string {
  const mainCharacter = characterNames[0] ?? "the main character";
  const supportingCharacters = characterNames.slice(1);
  const styleDirective = getIllustrationStyleDirective(illustrationStyle);

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
    "",
    `FINALIZE: Generate as ${getIllustrationStyleOption(illustrationStyle).label}: ${styleDirective}`,
  ].join("\n");
}

// =============================================================================
// PART 2 — ADVANCED IMAGE PROMPT BUILDERS (disabled by default)
// Re-enable by setting IMAGE_PIPELINE_MODE = "advanced"
// =============================================================================

function buildAdvancedGlobalStylePrefix(illustrationStyle?: IllustrationStyle): string {
  const styleLabel = getIllustrationStyleOption(illustrationStyle).label;
  const styleDirective = getIllustrationStyleDirective(illustrationStyle);

  return `ILLUSTRATION STYLE — this is the single most important instruction in this prompt:
Generate as ${styleLabel}: ${styleDirective}
Every visual decision — rendering technique, texture, color treatment, line quality, finish — must follow this style. Do not default to a generic storybook look.

CHILDREN'S PICTURE BOOK REQUIREMENTS:
- Character design: rounded, friendly, expressive child-friendly faces
- Composition: complete environment storytelling, not isolated portraits
- Emotional tone: warm, playful, wonder-filled, age-appropriate
- Consistency: this exact style and character identity persists on every page
- Photo fidelity: the uploaded child photo is the canonical identity reference — keep face shape, hairline, hair density, skin tone, and age appearance faithful to the photo while rendering in the chosen style
- Interior page format: portrait 4:5 storybook page for every illustration

Hard prohibitions (these override nothing above — the style directive above takes full precedence):
• NOT a character sheet, pose grid, or multi-panel collage
• NOT storyboard or concept art layout
• NOT photorealistic or 3D-rendered
• NOT portrait on blank background — must show a full scene environment
• NOT avatar-style isolated head — must be integrated into the scene
• NOT any rendered text, letters, numbers, signs, or labels anywhere`.trim();
}

export function buildNegativeConstraints(): string {
  return `
HARD NEGATIVE REQUIREMENTS:
✗ Any rendered text: letters, words, numbers, captions, labels, speech bubbles, signs, posters
✗ Character sheet, pose grid, repeated-clone composition, or multi-panel collage layout
✗ Photorealistic or 3D-render look
✗ Storyboard or concept art layout
✗ Avatar portrait on blank background — must be a full scene
✗ Deformed anatomy: missing/extra fingers, incorrect proportions, disconnected limbs
✗ Off-model child (inconsistent with character profile)
✗ Mixed aspect-ratio output for interior story pages
NOTE: monochrome, sketch-like, flat, or textured rendering is ALLOWED when it matches the chosen illustration style.
`.trim();
}

export function buildNegativeConstraintsBlock(): string {
  return buildNegativeConstraints();
}

export function buildPromptSelfCheckBlock(): string {
  return `
SELF-CHECK before generating:
✓ Is the illustration style (named at the top of this prompt) clearly visible in the rendering technique?
✓ Same child identity — face, hair, skin tone, age — as the character anchor?
✓ One coherent story scene with environment, not an isolated portrait?
✓ Zero text, letters, or symbols anywhere in the image?
✓ Correct portrait 4:5 aspect ratio?

If any ✗: adjust and generate correctly.
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
  options?: { reinforceConsistency?: boolean; illustrationStyle?: IllustrationStyle }
): string {
  const styleDirective = getIllustrationStyleDirective(options?.illustrationStyle);

  const pageContext = options?.reinforceConsistency
    ? `CONSISTENCY REINFORCEMENT (Pages 2–6):\nYou are illustrating page ${page.pageNumber}. Match the visual style and character identity from page 1 exactly. No reinterpretation, no style drift, no character redesign.`
    : `PAGE 1 — VISUAL LANGUAGE ESTABLISHMENT:\nThis is the first page. Your illustration style, character treatment, and rendering approach will define the ENTIRE visual identity for all remaining pages.`;

  return `
${sharedContextPrompt}

${pageContext}

ILLUSTRATION SCENE — page ${page.pageNumber}:
Story moment: "${page.text}"

Illustration task — draw exactly what this sentence describes:
- Show the specific action the character is performing
- Show the specific location/setting described
- Show the emotional expression matching the moment
- Include full environment: foreground, midground, background, lighting, atmosphere
- The named character must be the clear visual focal point
- Rich environmental detail, cinematic composition, expressive pose

${buildNegativeConstraints()}

${buildPromptSelfCheckBlock()}

FINALIZE: Generate as ${getIllustrationStyleOption(options?.illustrationStyle).label}: ${styleDirective}
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
    line_art_or_sketch: `RETRY — FULLY RENDERED IN THE REQUESTED STYLE:\nThe previous attempt looked unfinished. Keep the chosen illustration style, but make it feel complete, polished, intentional, and premium. Do not fall back to a rough draft, accidental outline-only render, or low-detail sketch.`,
    isolated_face_or_avatar: `RETRY — FULL ENVIRONMENTAL SCENE:\nThe previous image showed only an isolated face. MUST be a complete ENVIRONMENTAL SCENE. Show the character interacting with the world.`,
    collage_or_character_sheet: `RETRY — SINGLE COHERENT SCENE:\nThe previous attempt read like a layout sheet or collage. MUST be ONE SINGLE COHERENT SCENE. One story moment, one composition, one environment.`,
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

Write a personalized ${input.pageCount ?? 6}-page storybook.

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
- Do not omit any named character from the ${input.pageCount ?? 6}-page story
- The way each character behaves, speaks, and is described must fit their exact age
- Story moments should feel plausible for these exact ages while still being magical and adventurous
- NEVER mention any character's age explicitly in the story text — no phrases like "5-year-old", "aged 7", "who was 6", etc. Age is used only to calibrate behaviour and vocabulary, not to be stated in the narrative
- Tone is warm, playful, magical, and safe
- Structure: delightful beginning, small challenge, happy ending
- ${buildStoryLengthRequirements(input).replace(/\n/g, "\n- ")}
- Avoid scary, dark, violent, or copyrighted content
- Keep the language age-appropriate

Return strict JSON:
{
  "title": "...",
  "coverText": "...",
  "pages": [
${Array.from({ length: input.pageCount ?? 6 }, (_, i) => `    { "pageNumber": ${i + 1}, "text": "..." }`).join(",\n")}
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
- matching the requested page length for a ${getStoryLength(input)} story

Remove any explicit age references — do not include phrases like "5-year-old", "aged 7", "who was 6" or any numeric age mention in the story text. Age shapes behaviour and vocabulary only.

Keep:
- same title
- EXACTLY ${input.pageCount ?? 6} pages — do not add or remove any pages
- same general plot
- every named character included in the story
- each named character behaving like their exact entered age
- ${buildStoryLengthRequirements(input).replace(/\n/g, "\n- ")}

Return strict JSON with EXACTLY ${input.pageCount ?? 6} pages:
{
  "title": "...",
  "coverText": "...",
  "pages": [
${Array.from({ length: input.pageCount ?? 6 }, (_, i) => `    { "pageNumber": ${i + 1}, "text": "..." }`).join(",\n")}
  ],
  "ending": "..."
}

Story to refine:
${storyJson}
`.trim();
}
