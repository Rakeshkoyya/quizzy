import { requireUser } from "@/lib/auth";
import { normalizeAnswerKey } from "@/lib/exam";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const createExamSchema = z.object({
  title: z.string().min(1).max(120),
  timeLimitMinutes: z.number().int().min(1).max(300),
  imagePath: z.string().min(1),
  answerKey: z.record(z.string(), z.string()),
});

export async function GET() {
  try {
    const user = await requireUser();
    const exams = await prisma.exam.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { attempts: { orderBy: { submittedAt: "desc" }, take: 1 } },
    });

    return NextResponse.json({ exams });
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
        imagePath: body.imagePath,
        answerKey,
        questionCount: Math.max(...questionNumbers),
        userId: user.id,
      },
    });

    return NextResponse.json({ exam });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create exam";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
