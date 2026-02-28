import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const exams = await prisma.exam.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      attempts: {
        where: { userId: user.id },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Your Exams</h1>
          <p className="mt-1 text-[var(--muted)]">Create and practice with your exam materials</p>
        </div>
        <LogoutButton />
      </header>

      {/* Create Button */}
      <Link
        href="/exams/new"
        className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-5 py-3 font-medium text-white shadow-sm hover:bg-[#b5673f]"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create New Exam
      </Link>

      {/* Exam List */}
      <section className="space-y-4">
        {exams.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--secondary-light)]">
              <svg className="h-8 w-8 text-[var(--secondary)]\" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)]">No exams yet</h3>
            <p className="mt-2 text-[var(--muted)]">Upload an answer key image to create your first exam</p>
          </div>
        ) : (
          exams.map((exam) => {
            const latestAttempt = exam.attempts[0];
            const totalQuestions = exam.questionCount;
            const correctPercent = latestAttempt
              ? Math.round((latestAttempt.correctCount / totalQuestions) * 100)
              : null;

            return (
              <div
                key={exam.id}
                className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all hover:border-[var(--border-hover)] hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {exam.title}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam.questionCount} questions
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {exam.timeLimitMinutes} minutes
                      </span>
                    </div>

                    {latestAttempt && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 max-w-32 overflow-hidden rounded-full bg-[var(--secondary-light)]">
                          <div
                            className="h-full rounded-full bg-[var(--success)]"
                            style={{ width: `${correctPercent}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-[var(--foreground)]">
                          {correctPercent}% correct
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          ({latestAttempt.correctCount}/{totalQuestions})
                        </span>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/exams/${exam.id}/attempt`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e8ddd4] bg-white px-5 py-2.5 font-medium text-[#3d3029] hover:border-[#c9784e] hover:bg-[#f9ebe4] hover:text-[#c9784e]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Exam
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
