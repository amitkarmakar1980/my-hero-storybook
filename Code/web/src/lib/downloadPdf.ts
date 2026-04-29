import type { GeneratedStory } from "@/types/storybook";

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

  // A4 portrait in mm
  const W = 210;
  const H = 297;
  const MARGIN = 14;
  const CONTENT_W = W - MARGIN * 2;

  const CREAM = "#FBF1E3";
  const NAVY = "#171E45";
  const ORANGE = "#FC800A";
  const MUTED = "#7a7f9a";
  const ACCENT_BORDER = "#FFD5C0";

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

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
      // Center horizontally if narrower than maxW
      const offsetX = x + (maxW - drawW) / 2;
      pdf.addImage(src, "JPEG", offsetX, y, drawW, drawH, undefined, "FAST");
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

  // Orange top bar
  pdf.setFillColor(ORANGE);
  pdf.rect(0, 0, W, 5, "F");

  let y = 16;

  // Cover image — max height 110mm, preserving ratio
  if (coverImageUrl) {
    const drawnH = await drawImageFit(coverImageUrl, MARGIN, y, CONTENT_W, 110);
    y += drawnH + 12;
  } else {
    y += 10;
  }

  // Title
  setFont("bold");
  pdf.setFontSize(24);
  pdf.setTextColor(NAVY);
  const titleLines = pdf.splitTextToSize(title, CONTENT_W) as string[];
  pdf.text(titleLines, W / 2, y, { align: "center" });
  y += titleLines.length * 9 + 8;

  // Subtitle
  setFont("normal");
  pdf.setFontSize(11);
  pdf.setTextColor(MUTED);
  const subtitleLines = pdf.splitTextToSize(coverText, CONTENT_W - 16) as string[];
  pdf.text(subtitleLines, W / 2, y, { align: "center" });
  y += subtitleLines.length * 5.5 + 14;

  // Divider
  pdf.setDrawColor(ACCENT_BORDER);
  pdf.setLineWidth(0.8);
  pdf.line(W / 2 - 18, y, W / 2 + 18, y);

  // Footer
  setFont("normal");
  pdf.setFontSize(8);
  pdf.setTextColor(ORANGE);
  pdf.text("Created with My Hero Storybook", W / 2, H - 10, { align: "center" });

  // ── Story pages ────────────────────────────────────────────────────────────
  for (const page of story.pages) {
    pdf.addPage();
    pdf.setFillColor(CREAM);
    pdf.rect(0, 0, W, H, "F");

    // Accent strip
    pdf.setFillColor(ACCENT_BORDER);
    pdf.rect(0, 0, W, 2, "F");

    let py = MARGIN;

    // Page number circle
    pdf.setFillColor(255, 237, 220);
    pdf.circle(MARGIN + 4.5, py + 4.5, 4.5, "F");
    setFont("bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(ORANGE);
    pdf.text(String(page.pageNumber), MARGIN + 4.5, py + 5.5, { align: "center" });
    py += 15;

    // Illustration — fits within 118mm tall max
    const illus = pageImages[page.pageNumber];
    const MAX_ILLUS_H = 118;
    if (illus?.imageUrl) {
      const drawnH = await drawImageFit(illus.imageUrl, MARGIN, py, CONTENT_W, MAX_ILLUS_H);
      // Thin border around image
      pdf.setDrawColor(220, 200, 180);
      pdf.setLineWidth(0.25);
      const { w: nw, h: nh } = await getImageNaturalSize(illus.imageUrl);
      const ratio = nw / nh;
      let bW = CONTENT_W;
      let bH = CONTENT_W / ratio;
      if (bH > MAX_ILLUS_H) { bH = MAX_ILLUS_H; bW = MAX_ILLUS_H * ratio; }
      const bX = MARGIN + (CONTENT_W - bW) / 2;
      pdf.roundedRect(bX, py, bW, bH, 2, 2);
      py += drawnH + 10;
    } else {
      pdf.setFillColor(241, 232, 220);
      pdf.roundedRect(MARGIN, py, CONTENT_W, 80, 3, 3, "F");
      py += 90;
    }

    // Story text
    setFont("normal");
    pdf.setFontSize(12.5);
    pdf.setTextColor(NAVY);
    const pageLines = pdf.splitTextToSize(page.text, CONTENT_W) as string[];
    pdf.text(pageLines, MARGIN, py, { lineHeightFactor: 1.65 });

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
