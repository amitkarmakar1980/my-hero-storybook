// Prompts for story generation
import type { StoryInput, CharacterProfile, StoryPage } from "@/types/storybook";

// =============================================================================
// ① GLOBAL STYLE PREFIX — Applied verbatim to every image generation
// =============================================================================
// This single source of truth ensures EVERY page has identical visual language.
// Do NOT let page prompts override, reinterpret, or supplement these style rules.
// =============================================================================

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

Rendering demands:
✓ Full-color palette with depth and visual richness
✓ Polished, finished, production-ready appearance
✓ Soft painterly shading with integrated lighting
✓ Clean readable composition suitable for children's book page
✓ Visually coherent scene with storytelling content
✓ Emotionally warm and engaging illustration

This style applies to EVERY page without exception. Do not deviate.
`.trim();

// =============================================================================
// NEGATIVE CONSTRAINTS BLOCK — Hard anti-failure rules
// =============================================================================
// These are explicit prohibitions embedded in every image prompt.
// =============================================================================

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

Composition restrictions:
✗ Do not show floating isolated portrait without environment
✗ Do not produce character-sheet or pose-reference grids
✗ Do not show multiple different versions of the same child
✗ Do not produce minimal-detail placeholder-like output
✗ Do not crop faces awkwardly or cut off critical body parts
`.trim();
}

// =============================================================================
// CHARACTER ANCHOR — Reused verbatim on every page for identity lock
// =============================================================================
// Extract the character profile ONCE and inject it unchanged on every page.
// This ensures the same child appears throughout the book.
// =============================================================================

export function buildCharacterAnchor(profile: CharacterProfile): string {
  return `
CHARACTER IDENTITY LOCK — Inject verbatim on every page, no modifications:

The child hero must maintain IDENTICAL visual identity across every page.
Do not shift, redesign, reinterpret, or invent variations of this character.

Physical appearance (locked, unchanging):
- Age appearance: ${profile.appearanceAge || "not specified, but matches the uploaded photo"}
- Face shape: ${profile.faceShape || "not specified, but matches the uploaded photo"}
- Face expression: capable of changing with emotion/scene, but facial structure stays same
- Skin tone: ${profile.skinTone || "not specified, but matches the uploaded photo"}
- Hair (style + color + texture): ${profile.hair || "not specified, but matches the uploaded photo"}
- Eye shape and color: ${profile.eyes || "not specified, but matches the uploaded photo"}
- Body build and proportions: ${profile.build || "not specified, but matches the uploaded photo"}
- Height relative to surroundings: remains consistent page to page
- Signature features/marks: ${profile.signatureFeatures || "not specified"}
- Default/baseline outfit: ${profile.defaultOutfit || "not specified"}

MANDATORY CONSISTENCY RULES — Never violated:
→ Same face shape, same facial proportions, same facial structure across all pages
→ Same body type, same height, same body proportions (not heavier, lighter, older, younger)
→ Same skin tone; do not shift or alter
→ Same hair color, hair style, hair texture
→ Same age appearance; child must look same age consistently
→ Same identity and recognizability
→ If wearing different outfit on a scene, the clothing difference must be MINOR and STORY-JUSTIFIED
→ Do not create alternate versions, redesigns, or reinterpretations of this child
→ Show ONE main central child hero on every page (unless story explicitly introduces other characters)
→ If secondary characters appear, the main child remains visually unchanged and clearly identifiable

CRITICAL: This is the SAME CHILD throughout the book. Treat as single continuous character.
`.trim();
}

// =============================================================================
// PAGE SCENE BLOCK — What changes per page (only this part varies)
// =============================================================================

export function buildScenePrompt(page: StoryPage): string {
  return `
SCENE FOR THIS PAGE (this is the only part that changes):

Story moment: "${page.text}"

Illustration task:
- Depict the exact scene and action described above
- Show the child as clear focal point in this specific moment
- Include full environment context: setting, atmosphere, supporting elements
- Express the emotion and action of the scene
- Composition should be readable, balanced, and engaging
`.trim();
}

// =============================================================================
// NEGATIVE CONSTRAINTS BLOCK — Hard rules, no exceptions
// =============================================================================

export function buildNegativeConstraintsBlock(): string {
  return buildNegativeConstraints();
}

// =============================================================================
// PROMPT SELF-CHECKING INSTRUCTION — Model validates its own prompt before generation
// =============================================================================
// This block is embedded in the final prompt sent to Imagen.
// The model self-validates BEFORE attempting image generation.
// =============================================================================

export function buildPromptSelfCheckBlock(): string {
  return `
MANDATORY PROMPT SELF-CHECK — Before generating image, verify:

Before attempting to generate the image, perform an internal checklist:

✓ Condition 1: Does this prompt describe the same child identity as established in the character anchor?
  → If NO: revise prompt to lock character identity
  
✓ Condition 2: Does the prompt preserve body proportions, face shape, hairstyle, skin tone, age appearance, and clothing consistency?
  → If NO: revise prompt to enforce character consistency
  
✓ Condition 3: Does the prompt describe ONE coherent story scene with clear setting and context?
  → If NO: revise to ensure single meaningful scene, not character sheet/collage/grid
  
✓ Condition 4: Does the prompt contain ANY instruction to render text, letters, numbers, captions, labels, or typographic content?
  → If YES: remove all text/typography instructions and revise
  
✓ Condition 5: Does the prompt match the specified global style (premium full-color storybook illustration)?
  → If NO: revise to emphasize style requirements
  
✓ Condition 6: Is the prompt free of requests for sketch, monochrome, line-art, avatar-portrait, or generic stock art?
  → If NO: revise to prohibit these styles
  
✓ Condition 7: Does the prompt describe environment and storytelling integration (not isolated floating portrait)?
  → If NO: revise to integrate child into scene with environment context

SELF-CHECK OUTCOME:
- If all conditions ✓ PASS: Proceed with image generation using this prompt AS-IS. Do not modify.
- If any condition ✗ FAILS: REVISE the prompt to satisfy that condition, then re-check, then generate.
- Return ONE final prompt only (not multiple candidates).
- Do NOT attempt image generation if conditions are not met.
`.trim();
}

// =============================================================================
// FINAL IMAGE PROMPT BUILDER — Assembles all 5 parts for Imagen
// =============================================================================
// This is the complete prompt sent to Imagen. It includes:
// 1. Global style block
// 2. Fixed character anchor
// 3. Page scene block
// 4. Negative constraints block
// 5. Prompt self-checking instruction block
// =============================================================================

export function buildFinalImagePrompt(
  profile: CharacterProfile,
  page: StoryPage,
  options?: { reinforceConsistency?: boolean }
): string {
  const pageContext = options?.reinforceConsistency
    ? `
CONSISTENCY REINFORCEMENT (Pages 2-6):
You are illustrating page ${page.pageNumber}. The visual style, character identity, and illustration medium
must match EXACTLY the style and character established on page 1.
No reinterpretation. No style drift. No character redesign. Same book, same visual language.
`
    : `
PAGE 1 — VISUAL LANGUAGE ESTABLISHMENT:
This is the first page. Your illustration style, character treatment, and rendering approach
will define the ENTIRE visual identity for the remaining 6 pages.
Make this a premium, polished, masterful children's storybook image that all subsequent pages will match.
`;

  return `
${GLOBAL_STYLE_PREFIX}

${buildCharacterAnchor(profile)}

${pageContext}

${buildScenePrompt(page)}

${buildNegativeConstraintsBlock()}

${buildPromptSelfCheckBlock()}

FINALIZE: Generate one coherent, premium children's storybook illustration matching all conditions above.
`.trim();
}

// =============================================================================
// COVER IMAGE PROMPT BUILDER
// =============================================================================
// The cover uses the same architecture and must match interior pages.
// =============================================================================

export function buildCoverImagePrompt(
  profile: CharacterProfile,
  storyTitle: string
): string {
  return `
${GLOBAL_STYLE_PREFIX}

${buildCharacterAnchor(profile)}

FRONT COVER ILLUSTRATION — Hero Moment:

This is the front cover for the children's storybook titled "${storyTitle}".
The child character should appear in a CONFIDENT, HEROIC, MAGICAL pose that captures the spirit of adventure.

Cover requirements:
- Central focus: Child in dynamic, aspirational, heroic pose
- Pose should feel ADVENTUROUS, BRAVE, MAGICAL, not static or neutral
- Setting: Full magical/fantastical environment with atmosphere, depth, and visual richness
- Lighting: Cinematic, warm, emotionally compelling, draws the eye
- Colors: Rich, vibrant, premium palette — NOT flat, muted, or desaturated
- Composition: Strong visual hierarchy; clear focal point; book-cover-ready design
- Quality: Striking, highly polished, shareable, professional children's book cover art

Important: Include clear visual space at the TOP of the image for the title text to be overlaid by the app.
The title will be added in the application UI, not inside the image.
Do NOT render title, subtitle, or any text inside the cover illustration.

${buildNegativeConstraintsBlock()}

${buildPromptSelfCheckBlock()}

FINALIZE: Generate one stunning, premium children's storybook cover illustration matching all conditions above.
`.trim();
}

// =============================================================================
// CHARACTER PROFILE GENERATION PROMPT
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

// =============================================================================
// STORY GENERATION PROMPT
// =============================================================================

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

// =============================================================================
// STORY REFINEMENT PROMPT
// =============================================================================

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

// =============================================================================
// RETRY REINFORCEMENT BUILDERS
// =============================================================================
// Build targeted reinforcement prompts based on specific validation failures.
// Applied as a prefix to the retry attempt to correct common issues.
// =============================================================================

export function buildRetryReinforcement(
  invalidReason: string | undefined,
  qualityFlags?: string[]
): string {
  if (!invalidReason) {
    return `
RETRY ATTEMPT — REINFORCED REQUIREMENTS:

The previous attempt did not meet quality standards. Apply stricter adherence
to ALL conditions below:
`;
  }

  // Build targeted reinforcement based on specific failure
  const reinforcements: Record<string, string> = {
    monochrome_or_black_and_white: `
RETRY — FULL COLOR REQUIREMENT:

The previous image was monochrome or had insufficient color depth.

CORRECTED REQUIREMENTS:
✓ MUST be FULL COLOR with rich, saturated palette
✓ NO black-and-white rendering
✓ NO grayscale
✓ NO limited-palette drawings
✓ Use warm, vibrant, colorful painting style
✓ Every major element must have distinct, visible color
✓ Rich environmental colors supporting the scene
✓ Premium full-color children's book illustration only

RETRY: Generate with maximum color richness and palette diversity.
`,

    line_art_or_sketch: `
RETRY — NO SKETCH, NO LINE ART:

The previous attempt was line-art or sketch-style.

CORRECTED REQUIREMENTS:
✓ MUST NOT be sketch, line art, or drawn in outline style
✓ MUST be full PAINTED OR RENDERED illustration
✓ Use soft, integrated shading (not outline-based)
✓ Shapes defined by color and value, not borders
✓ Watercolor-inspired or gouache-inspired rendering
✓ Polished, blended brushwork appearance
✓ NO visible pen lines, no ink outlines
✓ Premium storybook painting, not technical drawing

RETRY: Render as soft, painted, blended, full-color scene.
`,

    isolated_face_or_avatar: `
RETRY — FULL ENVIRONMENTAL SCENE:

The previous image showed only an isolated face or avatar portrait.

CORRECTED REQUIREMENTS:
✓ MUST be a complete ENVIRONMENTAL SCENE, not a portrait
✓ NO isolated head floating on blank background
✓ NO headshot, avatar, or icon
✓ Show the character INTERACTING with the world around them
✓ Include meaningful scenery, setting, props, and context
✓ Character is PART of the world, not isolated from it
✓ Scene must tell a story through environment
✓ Full-body integration or at minimum character in scene context

RETRY: Generate a rich scene with the child as part of their story world.
`,

    collage_or_character_sheet: `
RETRY — SINGLE COHERENT SCENE:

The previous attempt was a collage, character sheet, or multiple-pose board.

CORRECTED REQUIREMENTS:
✓ MUST be ONE SINGLE COHERENT SCENE (not multiple panels)
✓ NO repeated child in same image
✓ NO character sheet layout
✓ NO pose turnaround
✓ NO multiple-version collage
✓ NO character design board
✓ Single unified illustration showing one moment in the story
✓ One child, one pose, one moment, one scene

RETRY: Generate one unified, single-moment story illustration.
`,

    text_artifact: `
RETRY — ABSOLUTELY NO TEXT:

The previous image contained words, letters, numbers, labels, speech bubbles, or handwriting.

CORRECTED REQUIREMENTS:
✓ ABSOLUTELY NO TEXT of any kind in the generated image
✓ NO words, NO labels, NO letters, NO numbers
✓ NO speech bubbles, NO thought bubbles
✓ NO handwriting, NO script, NO typography
✓ NO page numbers, NO book marks
✓ NO signs with readable text
✓ Pure visual storytelling only — text belongs in the book layout, not the image
✓ The Illustration must communicate entirely through visuals

RETRY: Generate with zero text—pure visual illustration only.
`,

    inconsistent_character: `
RETRY — CONSISTENT CHARACTER IDENTITY:

The child's appearance was inconsistent with previous page(s).

CORRECTED REQUIREMENTS:
✓ SAME face as established on page 1
✓ SAME hairstyle and hair color
✓ SAME body proportions and build
✓ SAME apparent age
✓ SAME skin tone
✓ SAME distinct features and personal visual markers
✓ 100% character identity match across all pages
✓ This is the SAME CHILD on every page—no redesign, no variation

RETRY: Render the exact same child from page 1, unchanged.
`,

    low_information_scene: `
RETRY — RICH, DETAILED, STORY-FILLED SCENE:

The previous scene had insufficient detail or narrative content.

CORRECTED REQUIREMENTS:
✓ RICH, detailed environment with multiple visual elements
✓ Tells a clear story moment through visual composition
✓ Multiple layers of detail supporting narrative
✓ Foreground, mid-ground, background all visually interesting
✓ Props and environmental details that advance the plot
✓ NOT sparse or empty-looking
✓ NOT minimal or simplistic
✓ Genuine illustrative depth and storytelling complexity

RETRY: Generate with maximum visual richness and narrative detail.
`,
  };

  return reinforcements[invalidReason] || `
RETRY ATTEMPT — REINFORCED STANDARDS:

The previous attempt did not meet storybook quality standards.
Reapply all base requirements with heightened precision and attention to detail.
`;
}

// =============================================================================
// PUBLIC API FOR VALIDATED IMAGE GENERATION
// =============================================================================
// These helpers are used by the image generation pipeline to support retries.
// =============================================================================

export function buildRetryImagePrompt(
  originalPrompt: string,
  invalidReason: string | undefined,
  qualityFlags?: string[]
): string {
  const reinforcement = buildRetryReinforcement(invalidReason, qualityFlags);
  
  return `${reinforcement}

---

ORIGINAL SCENE REQUIREMENTS (applied again):

${originalPrompt}
`.trim();
}