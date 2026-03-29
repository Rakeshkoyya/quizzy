import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

interface QuestionBoundary {
  pageNumber: number;
  questionNumber: number;
  xStartFraction: number;
  xEndFraction: number;
  yStartFraction: number;
  yEndFraction: number;
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const formData = await request.formData();

    const boundariesJson = formData.get("boundaries") as string | null;
    const examId = formData.get("examId") as string | null;

    if (!boundariesJson || !examId) {
      return NextResponse.json({ error: "Missing boundaries or examId" }, { status: 400 });
    }

    const boundaries: QuestionBoundary[] = JSON.parse(boundariesJson);

    if (boundaries.length === 0) {
      return NextResponse.json({ error: "No question boundaries provided" }, { status: 400 });
    }

    // Create temp directory under public/
    const tempDir = path.join(process.cwd(), "public", "temp", examId);
    await mkdir(tempDir, { recursive: true });

    // Collect all page images from form data
    const pageImages = new Map<number, Buffer>();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("page-") && value instanceof Blob) {
        const pageNum = parseInt(key.replace("page-", ""), 10);
        const arrayBuffer = await value.arrayBuffer();
        pageImages.set(pageNum, Buffer.from(arrayBuffer));
      }
    }

    const results: Array<{ questionNumber: number; localPath: string; previewUrl: string }> = [];

    for (const boundary of boundaries) {
      const pageBuffer = pageImages.get(boundary.pageNumber);
      if (!pageBuffer) continue;

      // Save the full page image for future re-cropping (only once per page)
      const pageFileName = `page-${boundary.pageNumber}.png`;
      const pageFilePath = path.join(tempDir, pageFileName);
      try {
        await access(pageFilePath);
      } catch {
        await writeFile(pageFilePath, pageBuffer);
      }

      const metadata = await sharp(pageBuffer).metadata();
      if (!metadata.width || !metadata.height) continue;

      // Calculate crop bounds from exact boundary coordinates
      const left = Math.max(0, Math.round(boundary.xStartFraction * metadata.width));
      const top = Math.max(0, Math.round(boundary.yStartFraction * metadata.height));
      const right = Math.min(metadata.width, Math.round(boundary.xEndFraction * metadata.width));
      const bottom = Math.min(metadata.height, Math.round(boundary.yEndFraction * metadata.height));

      const cropWidth = Math.max(1, right - left);
      const cropHeight = Math.max(1, bottom - top);

      const croppedBuffer = await sharp(pageBuffer)
        .extract({
          left,
          top,
          width: cropWidth,
          height: cropHeight,
        })
        .webp({ quality: 85 })
        .toBuffer();

      // Save locally for preview
      const fileName = `q${boundary.questionNumber}.webp`;
      const filePath = path.join(tempDir, fileName);
      await writeFile(filePath, croppedBuffer);

      results.push({
        questionNumber: boundary.questionNumber,
        localPath: filePath,
        previewUrl: `/temp/${examId}/${fileName}`,
      });
    }

    return NextResponse.json({ questions: results });
  } catch (error) {
    console.error("[ProcessQuestions] Error:", error);
    const message = error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
