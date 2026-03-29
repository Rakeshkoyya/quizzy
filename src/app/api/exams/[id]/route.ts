import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl, uploadFile } from "@/lib/supabase-storage";
import { NextResponse } from "next/server";
import { z } from "zod";
import sharp from "sharp";

type Params = Promise<{ id: string }>;

const updateExamSchema = z.object({
  isPublic: z.boolean().optional(),
  sections: z.array(z.object({
    name: z.string().min(1),
    fromQuestion: z.number().int().min(1),
    toQuestion: z.number().int().min(1),
  })).optional(),
  recrop: z.array(z.object({
    questionNumber: z.number().int().min(1),
    cropX: z.number().min(0).max(1),
    cropY: z.number().min(0).max(1),
    cropW: z.number().min(0.01).max(1),
    cropH: z.number().min(0.01).max(1),
  })).optional(),
});

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Allow access to own exams or public exams
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { isPublic: true }],
      },
      include: {
        user: {
          select: { email: true, id: true },
        },
        questions: {
          orderBy: { questionNumber: "asc" },
        },
        pages: {
          orderBy: { pageNumber: "asc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    return NextResponse.json({ exam });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = updateExamSchema.parse(await request.json());

    // Only owner can update the exam
    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found or not authorized" }, { status: 404 });
    }

    const updatedExam = await prisma.exam.update({
      where: { id },
      data: {
        ...(body.isPublic !== undefined && { isPublic: body.isPublic }),
      },
    });

    // Update question sections if provided
    if (body.sections) {
      // Build a map of questionNumber -> section name
      const sectionMap = new Map<number, string>();
      for (const sec of body.sections) {
        for (let q = sec.fromQuestion; q <= sec.toQuestion; q++) {
          sectionMap.set(q, sec.name);
        }
      }

      // Get all questions for this exam
      const questions = await prisma.question.findMany({
        where: { examId: id },
      });

      // Update each question's section
      await Promise.all(
        questions.map((q) =>
          prisma.question.update({
            where: { id: q.id },
            data: { section: sectionMap.get(q.questionNumber) ?? null },
          }),
        ),
      );
    }

    // Re-crop questions if provided
    if (body.recrop && body.recrop.length > 0) {
      // Get exam pages for source images
      const pages = await prisma.examPage.findMany({
        where: { examId: id },
      });

      const questions = await prisma.question.findMany({
        where: { examId: id },
      });

      for (const crop of body.recrop) {
        const question = questions.find((q) => q.questionNumber === crop.questionNumber);
        if (!question) continue;

        const page = pages.find((p) => p.pageNumber === question.pageNumber);
        if (!page) continue;

        // Download the original page image from Supabase
        const pageUrl = await getSignedUrl("question-images", page.imagePath, 60);
        const pageResponse = await fetch(pageUrl);
        if (!pageResponse.ok) continue;

        const pageBuffer = Buffer.from(await pageResponse.arrayBuffer());
        const metadata = await sharp(pageBuffer).metadata();
        if (!metadata.width || !metadata.height) continue;

        // Calculate crop bounds
        const left = Math.max(0, Math.round(crop.cropX * metadata.width));
        const top = Math.max(0, Math.round(crop.cropY * metadata.height));
        const right = Math.min(metadata.width, Math.round((crop.cropX + crop.cropW) * metadata.width));
        const bottom = Math.min(metadata.height, Math.round((crop.cropY + crop.cropH) * metadata.height));

        const cropWidth = Math.max(1, right - left);
        const cropHeight = Math.max(1, bottom - top);

        const croppedBuffer = await sharp(pageBuffer)
          .extract({ left, top, width: cropWidth, height: cropHeight })
          .webp({ quality: 85 })
          .toBuffer();

        // Upload the new cropped image (overwrite existing)
        await uploadFile("question-images", question.imagePath, croppedBuffer, "image/webp");

        // Update crop coordinates in DB
        await prisma.question.update({
          where: { id: question.id },
          data: {
            cropX: crop.cropX,
            cropY: crop.cropY,
            cropW: crop.cropW,
            cropH: crop.cropH,
          },
        });
      }
    }

    const result = await prisma.exam.findFirst({
      where: { id },
      include: { questions: { orderBy: { questionNumber: "asc" } }, pages: { orderBy: { pageNumber: "asc" } } },
    });

    return NextResponse.json({ exam: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // Only owner can delete the exam
    const exam = await prisma.exam.findFirst({
      where: { id, userId: user.id },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found or not authorized" }, { status: 404 });
    }

    await prisma.exam.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
