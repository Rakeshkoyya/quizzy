import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsReview } from "@/components/results-review";

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
    include: {
      exam: {
        include: {
          questions: {
            orderBy: { questionNumber: "asc" },
          },
        },
      },
    },
  });

  if (!attempt) {
    notFound();
  }

  // Generate signed URLs for question images
  const questionImageMap: Record<number, string> = {};
  if (attempt.exam.questions) {
    await Promise.all(
      attempt.exam.questions
        .filter((q) => q.imagePath)
        .map(async (q) => {
          const url = await getSignedUrl("question-images", q.imagePath!, 7200);
          questionImageMap[q.questionNumber] = url;
        })
    );
  }

  // Build question → section mapping
  const questionSectionMap: Record<number, string> = {};
  const questionTextMap: Record<number, { text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string }> = {};
  if (attempt.exam.questions) {
    for (const q of attempt.exam.questions) {
      if (q.section) {
        questionSectionMap[q.questionNumber] = q.section;
      }
      if (q.questionText) {
        questionTextMap[q.questionNumber] = {
          text: q.questionText,
          optionA: q.optionA ?? undefined,
          optionB: q.optionB ?? undefined,
          optionC: q.optionC ?? undefined,
          optionD: q.optionD ?? undefined,
        };
      }
    }
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

  // Use exam's scoring system
  const correctMarks = (attempt.exam as Record<string, unknown>).correctMarks as number ?? 4;
  const wrongPenalty = (attempt.exam as Record<string, unknown>).wrongMarks as number ?? -1;
  const unansweredPenalty = (attempt.exam as Record<string, unknown>).unansweredMarks as number ?? 0;
  const marksObtained = (attempt.correctCount * correctMarks) + (attempt.wrongCount * wrongPenalty) + (attempt.unansweredCount * unansweredPenalty);
  const maxMarks = totalQuestions * correctMarks;

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
    <main className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#9a8b7a]">Exam Results</p>
          <h1 className="text-2xl font-semibold text-[#3d3029]">{attempt.exam.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/exams/${id}/attempt`}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#b5673f]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retake
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#9a8b7a] hover:text-[#3d3029]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Results Review */}
      <ResultsReview
        correctQuestions={correctQuestions}
        wrongQuestions={wrongQuestions}
        unansweredQuestions={unansweredQuestions}
        answerKey={answerKey}
        correctCount={attempt.correctCount}
        wrongCount={attempt.wrongCount}
        unansweredCount={attempt.unansweredCount}
        questionImageMap={questionImageMap}
        questionTextMap={questionTextMap}
        questionSectionMap={questionSectionMap}
        examTitle={attempt.exam.title}
        scorePercent={scorePercent}
        marksObtained={marksObtained}
        maxMarks={maxMarks}
        totalQuestions={totalQuestions}
      />
    </main>
  );
}
