import type { QuestionBoundary, PageImage } from "@/types/exam";

const RENDER_SCALE = 2; // 2x for crisp images

let pdfjsInitialized = false;

async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjsInitialized = true;
  }
  return pdfjsLib;
}

/**
 * Render all pages of a PDF to images (canvas → data URL)
 */
export async function renderPdfPages(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<PageImage[]> {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: PageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(i, pdf.numPages);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      dataUrl: canvas.toDataURL("image/png"),
    });
  }

  return pages;
}

/**
 * Detect question boundaries by analysing text positions from the PDF.
 * Looks for patterns like "1.", "1)", "Q1", "(1)" at the start of a text line.
 */
export async function detectQuestionBoundaries(
  file: File,
): Promise<QuestionBoundary[]> {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Pattern to detect question numbers at the start of text items
  const questionPattern = /^\s*(?:Q\.?\s*)?(\d{1,3})\s*[\.\)\]\:\-]/i;

  interface RawHit {
    pageNumber: number;
    questionNumber: number;
    yFraction: number; // 0 = top of page, 1 = bottom
  }

  const hits: RawHit[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!("str" in item)) continue;

      const match = item.str.match(questionPattern);
      if (!match) continue;

      const qNum = parseInt(match[1], 10);
      if (qNum <= 0 || qNum > 999) continue;

      // PDF coordinates: origin is bottom-left, Y increases upward
      // Convert to top-down fraction
      const tx = item.transform;
      const yFromBottom = tx[5]; // Y coordinate in PDF space
      const yFraction = 1 - yFromBottom / viewport.height;

      hits.push({ pageNumber: i, questionNumber: qNum, yFraction });
    }
  }

  // De-duplicate: if same question number appears multiple times, keep the first
  const seen = new Set<number>();
  const unique: RawHit[] = [];
  for (const hit of hits) {
    if (!seen.has(hit.questionNumber)) {
      seen.add(hit.questionNumber);
      unique.push(hit);
    }
  }

  // Sort by question number
  unique.sort((a, b) => a.questionNumber - b.questionNumber);

  // Convert to boundaries: each question's region extends from its Y to the next question's Y
  const boundaries: QuestionBoundary[] = [];

  for (let i = 0; i < unique.length; i++) {
    const current = unique[i];
    const next = unique[i + 1];

    // Start position: small margin above the question number
    const yStart = Math.max(0, current.yFraction - 0.02);

    let yEnd: number;
    if (next && next.pageNumber === current.pageNumber) {
      // Next question is on the same page — end just before it
      yEnd = Math.max(0, next.yFraction - 0.02);
    } else {
      // Last question on this page — extend to bottom
      yEnd = 1.0;
    }

    boundaries.push({
      pageNumber: current.pageNumber,
      questionNumber: current.questionNumber,
      xStartFraction: 0,
      xEndFraction: 1,
      yStartFraction: yStart,
      yEndFraction: yEnd,
    });
  }

  return boundaries;
}

/**
 * Convert a data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
