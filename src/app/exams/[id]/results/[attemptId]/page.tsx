import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsTabs } from "@/components/results-tabs";

type Params = Promise<{ id: string; attemptId: string }>;

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Params }) {
  const user = await requireUser();
  const { id, attemptId } = await params;

  const attempt = await prisma.examAttempt.findFirst({
    where: {
      id: attemptId,
      examId: id,
      userId: user.id,
    },
    include: { exam: true },
  });

  if (!attempt) {
    notFound();
  }

  const wrongQuestions = attempt.wrongQuestions as Array<{
    questionNumber: number;
    yourAnswer: string;
    correctAnswer: string;
  }>;
  const unansweredQuestions = attempt.unansweredQuestions as number[];
  const userAnswers = attempt.userAnswers as Record<string, string>;
  const answerKey = attempt.exam.answerKey as Record<string, string>;
  const totalQuestions = attempt.correctCount + attempt.wrongCount + attempt.unansweredCount;
  const scorePercent = Math.round((attempt.correctCount / totalQuestions) * 100);

  // Calculate correct questions
  const wrongQuestionNumbers = new Set(wrongQuestions.map((q) => q.questionNumber));
  const unansweredSet = new Set(unansweredQuestions);
  const correctQuestions = Object.keys(answerKey)
    .map(Number)
    .filter((q) => !wrongQuestionNumbers.has(q) && !unansweredSet.has(q))
    .sort((a, b) => a - b)
    .map((questionNumber) => ({
      questionNumber,
      answer: userAnswers[String(questionNumber)] || answerKey[String(questionNumber)],
    }));

  return (
    <main className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#9a8b7a]">Exam Results</p>
          <h1 className="text-2xl font-semibold text-[#3d3029]">{attempt.exam.title}</h1>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#9a8b7a] hover:text-[#3d3029]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to dashboard
        </Link>
      </header>

      {/* Score Summary */}
      <section className="rounded-2xl border border-[#e8ddd4] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-[#f9ebe4]">
          <span className="text-3xl font-bold text-[#c9784e]">{scorePercent}%</span>
        </div>
        <h2 className="text-xl font-semibold text-[#3d3029]">Your Score</h2>
        <p className="mt-2 text-[#9a8b7a]">
          You answered {attempt.correctCount} out of {totalQuestions} questions correctly
        </p>
      </section>

      {/* Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4eb]">
              <svg className="h-5 w-5 text-[#7a9a6d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#9a8b7a]">Correct</p>
              <p className="text-2xl font-bold text-[#7a9a6d]">{attempt.correctCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fceaea]">
              <svg className="h-5 w-5 text-[#c45c5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#9a8b7a]">Wrong</p>
              <p className="text-2xl font-bold text-[#c45c5c]">{attempt.wrongCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5efe8]">
              <svg className="h-5 w-5 text-[#8b7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[#9a8b7a]">Unanswered</p>
              <p className="text-2xl font-bold text-[#8b7355]">{attempt.unansweredCount}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabbed Results */}
      <ResultsTabs
        correctQuestions={correctQuestions}
        wrongQuestions={wrongQuestions}
        unansweredQuestions={unansweredQuestions}
        answerKey={answerKey}
      />

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Link
          href={`/exams/${id}/attempt`}
          className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-6 py-3 font-medium text-white shadow-sm hover:bg-[#b5673f]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retake Exam
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8ddd4] bg-white px-6 py-3 font-medium text-[#3d3029] hover:border-[#c9784e] hover:bg-[#f9ebe4] hover:text-[#c9784e]"
        >
          View All Exams
        </Link>
      </div>
    </main>
  );
}
