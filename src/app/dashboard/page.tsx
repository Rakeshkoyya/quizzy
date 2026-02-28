import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { ExamCardActions } from "@/components/exam-card-actions";

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
        take: 1,
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
        take: 1,
      },
      user: {
        select: { email: true },
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

      {/* My Exams */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">My Exams</h2>
        {myExams.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--secondary-light)]">
              <svg className="h-8 w-8 text-[var(--secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--foreground)]">No exams yet</h3>
            <p className="mt-2 text-[var(--muted)]">Upload an answer key image to create your first exam</p>
          </div>
        ) : (
          myExams.map((exam) => {
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
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                        {exam.title}
                      </h3>
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

                  {/* Actions Row */}
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
                    <ExamCardActions examId={exam.id} isPublic={exam.isPublic} isOwner={true} />
                    <span className="text-xs text-[var(--muted)]">
                      Created {exam.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* Public Exams */}
      {publicExams.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Public Exams</h2>
            <span className="rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
              {publicExams.length} available
            </span>
          </div>
          {publicExams.map((exam) => {
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                        {exam.title}
                      </h3>
                      <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                        Public
                      </span>
                    </div>
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
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        by {exam.user.email.split("@")[0]}
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
          })}
        </section>
      )}
    </main>
  );
}
