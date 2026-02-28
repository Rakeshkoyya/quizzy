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

  // Calculate marks: +4 for correct, -1 for wrong, 0 for unanswered
  const marksObtained = (attempt.correctCount * 4) + (attempt.wrongCount * -1);
  const maxMarks = totalQuestions * 4;

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
        
        {/* Marks Display */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#f5efe8] px-4 py-2">
          <span className={`text-2xl font-bold ${marksObtained >= 0 ? "text-[#7a9a6d]" : "text-[#c45c5c]"}`}>
            {marksObtained}
          </span>
          <span className="text-lg text-[#9a8b7a]">/</span>
          <span className="text-2xl font-bold text-[#3d3029]">{maxMarks}</span>
          <span className="text-sm text-[#9a8b7a]">marks obtained</span>
        </div>
        <p className="mt-2 text-xs text-[#9a8b7a]">
          (+4 per correct, -1 per wrong)
        </p>
      </section>

      {/* Clickable Stats Cards & Results */}
      <ResultsTabs
        correctQuestions={correctQuestions}
        wrongQuestions={wrongQuestions}
        unansweredQuestions={unansweredQuestions}
        answerKey={answerKey}
        correctCount={attempt.correctCount}
        wrongCount={attempt.wrongCount}
        unansweredCount={attempt.unansweredCount}
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
