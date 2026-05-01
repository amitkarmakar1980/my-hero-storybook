import type { GeneratedStory, StoryLength } from "@/types/storybook";

interface PageImageData {
  imageUrl?: string;
}

interface DownloadPdfOptions {
  title: string;
  coverText: string;
  story: GeneratedStory;
  coverImageUrl: string | undefined;
  pageImages: Record<number, PageImageData>;
}

function inferStoryLength(story: GeneratedStory): StoryLength {
  const pageWordCounts = story.pages.map((page) => {
    const words = page.text.trim().match(/\S+/g);
    return words?.length ?? 0;
  });

  const averageWordsPerPage = pageWordCounts.reduce((sum, count) => sum + count, 0) / Math.max(pageWordCounts.length, 1);

  if (averageWordsPerPage >= 95) {
    return "long";
  }

  if (averageWordsPerPage >= 68) {
    return "standard";
  }

  return "short";
}

function getStoryTextLayout(story: GeneratedStory): { fontSize: number; lineHeightFactor: number } {
  const storyLength = inferStoryLength(story);

  if (storyLength === "short") {
    return { fontSize: 14, lineHeightFactor: 1.7 };
  }

  if (storyLength === "standard") {
    return { fontSize: 13, lineHeightFactor: 1.68 };
  }

  return { fontSize: 12, lineHeightFactor: 1.65 };
}

// ── Font loading ──────────────────────────────────────────────────────────────

async function fetchFontBase64(path: string): Promise<string> {
  const res = await fetch(path);
  const buffer = await res.arrayBuffer();
  // Convert ArrayBuffer → base64 in chunks to avoid call-stack overflow on large fonts
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ── Image helpers ─────────────────────────────────────────────────────────────

function getImageNaturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = src;
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function downloadStoryPdf(opts: DownloadPdfOptions): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const { title, coverText, story, coverImageUrl, pageImages } = opts;

  // A4 landscape in mm
  const W = 297;
  const H = 210;
  const MARGIN = 14;
  const CONTENT_W = W - MARGIN * 2;

  const CREAM = "#FBF1E3";
  const NAVY = "#171E45";
  const ORANGE = "#FC800A";
  const MUTED = "#7a7f9a";
  const ACCENT_BORDER = "#FFD5C0";

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const storyTextLayout = getStoryTextLayout(story);

  // ── Embed Poppins ─────────────────────────────────────────────────────────
  // Fetch from Google Fonts static CDN (CSS2 API gives direct TTF/WOFF2 URLs)
  try {
    // Fetch TTF files from public/fonts (same-origin, no CORS, jsPDF requires TTF not WOFF2)
    const [regularB64, boldB64] = await Promise.all([
      fetchFontBase64("/fonts/Poppins-Regular.ttf"),
      fetchFontBase64("/fonts/Poppins-Bold.ttf"),
    ]);
    pdf.addFileToVFS("Poppins-Regular.ttf", regularB64);
    pdf.addFont("Poppins-Regular.ttf", "Poppins", "normal");
    pdf.addFileToVFS("Poppins-Bold.ttf", boldB64);
    pdf.addFont("Poppins-Bold.ttf", "Poppins", "bold");
  } catch {
    // Fall back to helvetica silently if font files unavailable
  }

  const setFont = (style: "normal" | "bold") => {
    try {
      pdf.setFont("Poppins", style);
    } catch {
      pdf.setFont("helvetica", style);
    }
  };

  // ── Draw image preserving aspect ratio ────────────────────────────────────
  // Fits the image within (maxW x maxH) without stretching.
  async function drawImageFit(
    src: string,
    x: number,
    y: number,
    maxW: number,
    maxH: number
  ): Promise<number> {
    // Returns the actual drawn height so callers can flow content below it
    try {
      const { w: nw, h: nh } = await getImageNaturalSize(src);
      const ratio = nw / nh;
      let drawW = maxW;
      let drawH = maxW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = maxH * ratio;
      }
      // Center inside the frame when the fitted image does not use the full slot.
      const offsetX = x + (maxW - drawW) / 2;
      const offsetY = y + (maxH - drawH) / 2;
      pdf.addImage(src, "JPEG", offsetX, offsetY, drawW, drawH, undefined, "FAST");
      return drawH;
    } catch {
      pdf.setFillColor(241, 232, 220);
      pdf.roundedRect(x, y, maxW, maxH, 4, 4, "F");
      return maxH;
    }
  }

  // ── Cover page ─────────────────────────────────────────────────────────────
  pdf.setFillColor(CREAM);
  pdf.rect(0, 0, W, H, "F");

  const COVER_TITLE_H = H * 0.2;
  const COVER_IMAGE_H = H * 0.6;
  const COVER_FOOTER_H = H * 0.14;
  const coverImageY = COVER_TITLE_H;
  const coverFooterY = H - COVER_FOOTER_H + 2;

  setFont("bold");
  pdf.setFontSize(24);
  pdf.setTextColor(NAVY);
  const titleLines = pdf.splitTextToSize(title, CONTENT_W - 24) as string[];
  const titleBlockHeight = titleLines.length * 8.5;
  const titleY = Math.max(22, (COVER_TITLE_H - titleBlockHeight) / 2 + 10);
  pdf.text(titleLines, W / 2, titleY, { align: "center" });

  if (coverImageUrl) {
    await drawImageFit(coverImageUrl, MARGIN, coverImageY, CONTENT_W, COVER_IMAGE_H);
  } else {
    pdf.setFillColor(241, 232, 220);
    pdf.roundedRect(MARGIN, coverImageY + 8, CONTENT_W, COVER_IMAGE_H - 16, 4, 4, "F");
  }

  setFont("normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED);
  const subtitleLines = pdf.splitTextToSize(coverText, CONTENT_W - 40) as string[];
  pdf.text(subtitleLines, W / 2, coverFooterY, { align: "center", lineHeightFactor: 1.45, maxWidth: CONTENT_W - 40 });

  // ── Story pages ────────────────────────────────────────────────────────────
  for (const page of story.pages) {
    pdf.addPage();
    pdf.setFillColor(CREAM);
    pdf.rect(0, 0, W, H, "F");

    // Accent strip
    pdf.setFillColor(ACCENT_BORDER);
    pdf.rect(0, 0, W, 2, "F");

    const SPREAD_GAP = 10;
    const IMAGE_COLUMN_W = (CONTENT_W - SPREAD_GAP) * 0.56;
    const TEXT_COLUMN_W = CONTENT_W - SPREAD_GAP - IMAGE_COLUMN_W;
    const SPREAD_TOP = MARGIN + 10;
    const SPREAD_H = H - SPREAD_TOP - MARGIN - 10;
    const IMAGE_X = MARGIN;
    const TEXT_X = MARGIN + IMAGE_COLUMN_W + SPREAD_GAP;
    const DIVIDER_X = MARGIN + IMAGE_COLUMN_W + SPREAD_GAP / 2;

    // Center separator for the landscape spread
    pdf.setDrawColor(230, 212, 190);
    pdf.setLineWidth(0.45);
    pdf.line(DIVIDER_X, SPREAD_TOP, DIVIDER_X, SPREAD_TOP + SPREAD_H);

    // Illustration on the left page
    const illus = pageImages[page.pageNumber];
    const MAX_ILLUS_H = SPREAD_H;
    if (illus?.imageUrl) {
      await drawImageFit(illus.imageUrl, IMAGE_X, SPREAD_TOP, IMAGE_COLUMN_W, MAX_ILLUS_H);
      // Thin border around image
      pdf.setDrawColor(220, 200, 180);
      pdf.setLineWidth(0.25);
      const { w: nw, h: nh } = await getImageNaturalSize(illus.imageUrl);
      const ratio = nw / nh;
      let bW = IMAGE_COLUMN_W;
      let bH = IMAGE_COLUMN_W / ratio;
      if (bH > MAX_ILLUS_H) { bH = MAX_ILLUS_H; bW = MAX_ILLUS_H * ratio; }
      const bX = IMAGE_X + (IMAGE_COLUMN_W - bW) / 2;
      const bY = SPREAD_TOP + (MAX_ILLUS_H - bH) / 2;
      pdf.roundedRect(bX, bY, bW, bH, 2, 2);
    } else {
      pdf.setFillColor(241, 232, 220);
      pdf.roundedRect(IMAGE_X, SPREAD_TOP, IMAGE_COLUMN_W, MAX_ILLUS_H, 3, 3, "F");
    }

    const TEXT_PADDING_X = 6;
    const TEXT_PADDING_Y = 12;
    const textWidth = TEXT_COLUMN_W - TEXT_PADDING_X * 2;

    setFont("normal");
    pdf.setFontSize(storyTextLayout.fontSize);
    pdf.setTextColor(NAVY);
    const pageLines = pdf.splitTextToSize(page.text, textWidth) as string[];
    const textDimensions = pdf.getTextDimensions(pageLines.join("\n"), {
      fontSize: storyTextLayout.fontSize,
      maxWidth: textWidth,
    });
    const textTop = Math.max(
      SPREAD_TOP + TEXT_PADDING_Y,
      SPREAD_TOP + (SPREAD_H - textDimensions.h) / 2
    );

    pdf.text(pageLines, TEXT_X + TEXT_PADDING_X, textTop, {
      baseline: "top",
      lineHeightFactor: storyTextLayout.lineHeightFactor,
      maxWidth: textWidth,
    });

    // Footer
    setFont("normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED);
    pdf.text(`Page ${page.pageNumber}`, W / 2, H - 8, { align: "center" });
  }

  // ── "The End" page ─────────────────────────────────────────────────────────
  pdf.addPage();
  pdf.setFillColor(CREAM);
  pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(ORANGE);
  pdf.rect(0, 0, W, 5, "F");

  setFont("bold");
  pdf.setFontSize(28);
  pdf.setTextColor(NAVY);
  pdf.text("The End", W / 2, H / 2 - 8, { align: "center" });

  setFont("normal");
  pdf.setFontSize(10);
  pdf.setTextColor(ORANGE);
  pdf.text("- Created with My Hero Storybook -", W / 2, H / 2 + 8, { align: "center" });

  // ── Save ───────────────────────────────────────────────────────────────────
  const fileName = `${title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
  pdf.save(fileName);
}
