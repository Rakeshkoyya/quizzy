import { requireUser } from "@/lib/auth";
import { normalizeAnswerKey } from "@/lib/exam";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createExamSchema = z.object({
  title: z.string().min(1).max(120),
  timeLimitMinutes: z.number().int().min(1).max(300),
  answerKey: z.record(z.string(), z.string()),
  questionType: z.enum(["image", "text"]).optional().default("image"),
  correctMarks: z.number().min(0).max(100).optional().default(4),
  wrongMarks: z.number().min(-100).max(0).optional().default(-1),
  unansweredMarks: z.number().min(-100).max(100).optional().default(0),
  solutionsJson: z.record(z.string(), z.string()).optional(),
  questions: z.array(z.object({
    questionNumber: z.number().int().min(1),
    imagePath: z.string().optional(),
    pageNumber: z.number().int().min(1).optional().default(1),
    subject: z.string().optional(),
    section: z.string().optional(),
    cropX: z.number().optional(),
    cropY: z.number().optional(),
    cropW: z.number().optional(),
    cropH: z.number().optional(),
    questionText: z.string().optional(),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
  })).optional(),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1),
    imagePath: z.string().min(1),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
  })).optional(),
  questionPdfPath: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    
    // Get user's own exams
    const myExams = await prisma.exam.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        attempts: { 
          where: { userId: user.id },
          orderBy: { submittedAt: "desc" }, 
          take: 1 
        },
        user: {
          select: { email: true },
        },
      },
    });

    // Get public exams from other users
    const publicExams = await prisma.exam.findMany({
      where: { 
        isPublic: true,
        userId: { not: user.id },
      },
      orderBy: { createdAt: "desc" },
      include: {
        attempts: { 
          where: { userId: user.id },
          orderBy: { submittedAt: "desc" }, 
          take: 1 
        },
        user: {
          select: { email: true },
        },
      },
    });

    return NextResponse.json({ myExams, publicExams });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = createExamSchema.parse(await request.json());
    const answerKey = normalizeAnswerKey(body.answerKey);
    const questionNumbers = Object.keys(answerKey).map(Number);

    if (questionNumbers.length === 0) {
      return NextResponse.json({ error: "Answer key is empty" }, { status: 400 });
    }

    const exam = await prisma.exam.create({
      data: {
        title: body.title,
        timeLimitMinutes: body.timeLimitMinutes,
        answerKey,
        solutionsJson: body.solutionsJson ?? undefined,
        questionCount: Math.max(...questionNumbers),
        questionType: body.questionType,
        correctMarks: body.correctMarks,
        wrongMarks: body.wrongMarks,
        unansweredMarks: body.unansweredMarks,
        userId: user.id,
        questionPdfPath: body.questionPdfPath ?? null,
        ...(body.questions && body.questions.length > 0 && {
          questions: {
            create: body.questions.map((q) => ({
              questionNumber: q.questionNumber,
              imagePath: q.imagePath ?? null,
              pageNumber: q.pageNumber ?? 1,
              subject: q.subject ?? null,
              section: q.section ?? null,
              cropX: q.cropX ?? null,
              cropY: q.cropY ?? null,
              cropW: q.cropW ?? null,
              cropH: q.cropH ?? null,
              questionText: q.questionText ?? null,
              optionA: q.optionA ?? null,
              optionB: q.optionB ?? null,
              optionC: q.optionC ?? null,
              optionD: q.optionD ?? null,
            })),
          },
        }),
        ...(body.pages && body.pages.length > 0 && {
          pages: {
            create: body.pages.map((p) => ({
              pageNumber: p.pageNumber,
              imagePath: p.imagePath,
              width: p.width,
              height: p.height,
            })),
          },
        }),
      },
      include: { questions: true, pages: true },
    });

    return NextResponse.json({ exam });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
