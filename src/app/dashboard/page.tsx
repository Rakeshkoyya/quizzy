import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { ExamCardActions } from "@/components/exam-card-actions";
import { DashboardTabs } from "@/components/dashboard-tabs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // Get user's own exams
  const myExams = await prisma.exam.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      attempts: {
        where: { userId: user.id },
        orderBy: { submittedAt: "desc" },
      },
      questions: {
        orderBy: { questionNumber: "asc" },
        select: { questionNumber: true, section: true },
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
      },
      user: {
        select: { email: true },
      },
    },
  });

  // Serialize dates for client component
  const serializedMyExams = myExams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    questionCount: exam.questionCount,
    timeLimitMinutes: exam.timeLimitMinutes,
    isPublic: exam.isPublic,
    createdAt: exam.createdAt.toISOString(),
    attempts: exam.attempts.map((att) => ({
      id: att.id,
      startedAt: att.startedAt.toISOString(),
      submittedAt: att.submittedAt.toISOString(),
      correctCount: att.correctCount,
      wrongCount: att.wrongCount,
      unansweredCount: att.unansweredCount,
    })),
    questions: exam.questions,
  }));

  const serializedPublicExams = publicExams.map((exam) => ({
    id: exam.id,
    title: exam.title,
    questionCount: exam.questionCount,
    timeLimitMinutes: exam.timeLimitMinutes,
    createdAt: exam.createdAt.toISOString(),
    attempts: exam.attempts.map((att) => ({
      id: att.id,
      startedAt: att.startedAt.toISOString(),
      submittedAt: att.submittedAt.toISOString(),
      correctCount: att.correctCount,
      wrongCount: att.wrongCount,
      unansweredCount: att.unansweredCount,
    })),
    user: { email: exam.user.email },
  }));

  // Pre-render server-only ExamCardActions for each exam
  const examCardActions: Record<string, React.ReactNode> = {};
  for (const exam of myExams) {
    examCardActions[exam.id] = (
      <ExamCardActions
        examId={exam.id}
        isPublic={exam.isPublic}
        isOwner={true}
        questionCount={exam.questionCount}
        questions={exam.questions}
      />
    );
  }

  return (
    <main className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#3d3029]">Quizzy</h1>
          <p className="mt-1 text-sm text-[#9a8b7a]">Create, practice, and review your exam materials</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/exams/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#b5673f]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Exam
          </Link>
          <LogoutButton />
        </div>
      </header>

      <DashboardTabs
        myExams={serializedMyExams}
        publicExams={serializedPublicExams}
        examCardActions={examCardActions}
      />
    </main>
  );
}
