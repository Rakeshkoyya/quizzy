import { requireUser } from "@/lib/auth";
import { normalizeAnswerKey, scoreAttempt } from "@/lib/exam";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

type Params = Promise<{ id: string }>;

const submitAttemptSchema = z.object({
  startedAt: z.string(),
  userAnswers: z.record(z.string(), z.string()).default({}),
});

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const attempts = await prisma.examAttempt.findMany({
      where: { examId: id, userId: user.id },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        startedAt: true,
        submittedAt: true,
        correctCount: true,
        wrongCount: true,
        unansweredCount: true,
      },
    });

    return NextResponse.json({ attempts });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = submitAttemptSchema.parse(await request.json());

    // Allow access to own exams or public exams
    const exam = await prisma.exam.findFirst({
      where: {
        id,
        OR: [{ userId: user.id }, { isPublic: true }],
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const answerKey = normalizeAnswerKey(exam.answerKey as Record<string, string>);
    const normalizedUserAnswers = normalizeAnswerKey(body.userAnswers);
    const result = scoreAttempt(answerKey, normalizedUserAnswers);

    const attempt = await prisma.examAttempt.create({
      data: {
        examId: exam.id,
        userId: user.id,
        startedAt: new Date(body.startedAt),
        userAnswers: normalizedUserAnswers,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        unansweredCount: result.unansweredCount,
        wrongQuestions: result.wrongQuestions,
        unansweredQuestions: result.unansweredQuestions,
      },
    });

    return NextResponse.json({ attemptId: attempt.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit attempt";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
