import { requireUser } from "@/lib/auth";
import { uploadFile } from "@/lib/supabase-storage";
import { NextResponse } from "next/server";
import { readFile, rm } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as {
      tempExamId: string;
      questions: Array<{ questionNumber: number; previewUrl: string; subject?: string; section?: string }>;
      solutionPages?: number[];
      pageImages?: Array<{ pageNumber: number; width: number; height: number }>;
      boundaries?: Array<{
        questionNumber: number;
        pageNumber: number;
        xStartFraction: number;
        xEndFraction: number;
        yStartFraction: number;
        yEndFraction: number;
      }>;
    };

    const { tempExamId, questions, solutionPages, pageImages, boundaries } = body;

    if (!tempExamId || !questions?.length) {
      return NextResponse.json(
        { error: "Missing tempExamId or questions" },
        { status: 400 },
      );
    }

    const tempDir = path.join(process.cwd(), "public", "temp", tempExamId);
    const results: Array<{ questionNumber: number; imagePath: string; subject?: string; section?: string }> = [];

    for (const q of questions) {
      const fileName = `q${q.questionNumber}.webp`;
      const localFile = path.join(tempDir, fileName);

      const buffer = await readFile(localFile);
      const storagePath = `${user.id}/${tempExamId}/q${q.questionNumber}.webp`;
      await uploadFile("question-images", storagePath, buffer, "image/webp");

      results.push({
        questionNumber: q.questionNumber,
        imagePath: storagePath,
        subject: q.subject,
        section: q.section,
      });
    }

    // Upload original page images for future re-cropping
    const pageResults: Array<{ pageNumber: number; imagePath: string; width: number; height: number }> = [];
    if (pageImages && pageImages.length > 0) {
      for (const page of pageImages) {
        const pageFileName = `page-${page.pageNumber}.png`;
        const pageLocalFile = path.join(tempDir, pageFileName);
        try {
          const buffer = await readFile(pageLocalFile);
          const storagePath = `${user.id}/${tempExamId}/pages/page-${page.pageNumber}.png`;
          await uploadFile("question-images", storagePath, buffer, "image/png");
          pageResults.push({
            pageNumber: page.pageNumber,
            imagePath: storagePath,
            width: page.width,
            height: page.height,
          });
        } catch {
          // Page image may not exist
        }
      }
    }

    // Build crop data from boundaries
    const cropData: Array<{
      questionNumber: number;
      cropX: number;
      cropY: number;
      cropW: number;
      cropH: number;
    }> = [];
    if (boundaries) {
      for (const b of boundaries) {
        cropData.push({
          questionNumber: b.questionNumber,
          cropX: b.xStartFraction,
          cropY: b.yStartFraction,
          cropW: b.xEndFraction - b.xStartFraction,
          cropH: b.yEndFraction - b.yStartFraction,
        });
      }
    }

    // Upload solution page images if any
    const solutionPaths: string[] = [];
    if (solutionPages && solutionPages.length > 0) {
      for (const pageNum of solutionPages) {
        const solFileName = `solution-page-${pageNum}.webp`;
        const solLocalFile = path.join(tempDir, solFileName);
        try {
          const buffer = await readFile(solLocalFile);
          const storagePath = `${user.id}/${tempExamId}/solutions/${solFileName}`;
          await uploadFile("question-images", storagePath, buffer, "image/webp");
          solutionPaths.push(storagePath);
        } catch {
          // Solution page image may not exist if not saved locally
        }
      }
    }

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({ questions: results, solutionPaths, pages: pageResults, cropData });
  } catch (error) {
    console.error("[FinalizeUpload] Error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
