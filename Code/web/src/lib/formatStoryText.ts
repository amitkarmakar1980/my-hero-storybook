/**
 * Splits story page text into readable paragraphs.
 * Groups sentences in pairs so long pages get natural breathing room.
 */
export function formatStoryText(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return [text.trim()];

  // Group into pairs of 2 sentences per paragraph
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = sentences.slice(i, i + 2).join(" ").trim();
    if (chunk) paragraphs.push(chunk);
  }
  return paragraphs;
}
