import { requireUser } from "@/lib/auth";
import { analyzePageContent } from "@/lib/google-vision";
import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";
import type { QuestionBoundary, PageAnalysisResult } from "@/types/exam";

const PARALLEL_BATCH_SIZE = 10;

export async function POST(request: Request) {
  try {
    await requireUser();

    const formData = await request.formData();
    const pdfFile = formData.get("pdf") as File | null;

    if (!pdfFile) {
      return NextResponse.json(
        { error: "Missing PDF file" },
        { status: 400 },
      );
    }

    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // Split PDF into single pages
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();

    const analyses: PageAnalysisResult[] = [];

    // Process pages in parallel batches of 10
    for (let i = 0; i < pageCount; i += PARALLEL_BATCH_SIZE) {
      const batchIndices = Array.from(
        { length: Math.min(PARALLEL_BATCH_SIZE, pageCount - i) },
        (_, idx) => i + idx,
      );

      const batchResults = await Promise.all(
        batchIndices.map(async (pageIndex) => {
          const singlePageDoc = await PDFDocument.create();
          const [page] = await singlePageDoc.copyPages(pdfDoc, [pageIndex]);
          singlePageDoc.addPage(page);
          const singlePageBytes = await singlePageDoc.save();
          const base64 = Buffer.from(singlePageBytes).toString("base64");
          return analyzePageContent(base64, "application/pdf", pageIndex + 1);
        }),
      );

      analyses.push(...batchResults);
    }

    // Aggregate boundaries
    const allBoundaries: QuestionBoundary[] = [];
    const allSolutions: Record<string, string> = {};

    for (const analysis of analyses) {
      allBoundaries.push(...analysis.questions);
      if (analysis.solutions) {
        Object.assign(allSolutions, analysis.solutions);
      }
    }

    if (allBoundaries.length === 0) {
      return NextResponse.json(
        {
          error:
            "No questions detected in the PDF. Make sure questions are numbered (e.g., 1., 2., etc.)",
        },
        { status: 400 },
      );
    }

    allBoundaries.sort(
      (a, b) => a.pageNumber - b.pageNumber || a.questionNumber - b.questionNumber,
    );

    return NextResponse.json({
      boundaries: allBoundaries,
      solutions: Object.keys(allSolutions).length > 0 ? allSolutions : null,
      analyses,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to detect questions";
    console.error("[detect-questions]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
