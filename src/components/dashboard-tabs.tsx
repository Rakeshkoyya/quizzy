"use client";

import { useState } from "react";
import Link from "next/link";

type Tab = "exams" | "attempts" | "public";

interface ExamQuestion {
  questionNumber: number;
  section?: string | null;
}

interface Attempt {
  id: string;
  startedAt: string;
  submittedAt: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}

interface MyExam {
  id: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number;
  isPublic: boolean;
  createdAt: string;
  attempts: Attempt[];
  questions: ExamQuestion[];
}

interface PublicExam {
  id: string;
  title: string;
  questionCount: number;
  timeLimitMinutes: number;
  createdAt: string;
  attempts: Attempt[];
  user: { email?: string | null };
}

interface Props {
  myExams: MyExam[];
  publicExams: PublicExam[];
  examCardActions: Record<string, React.ReactNode>;
}

export function DashboardTabs({ myExams, publicExams, examCardActions }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("exams");

  // Collect all attempts across all exams (my + public) for the attempts tab
  const allAttempts = [
    ...myExams.flatMap((exam) =>
      exam.attempts.map((att) => ({ ...att, examId: exam.id, examTitle: exam.title, isOwn: true }))
    ),
    ...publicExams.flatMap((exam) =>
      exam.attempts.map((att) => ({ ...att, examId: exam.id, examTitle: exam.title, isOwn: false }))
    ),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const tabs = [
    { id: "exams" as Tab, label: "My Exams", count: myExams.length },
    { id: "attempts" as Tab, label: "Past Attempts", count: allAttempts.length },
    ...(publicExams.length > 0
      ? [{ id: "public" as Tab, label: "Public Exams", count: publicExams.length }]
      : []),
  ];

  return (
    <>
      {/* Tab Navbar */}
      <nav className="flex gap-1 rounded-xl bg-[#f5efe8] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-[#3d3029] shadow-sm"
                : "text-[#9a8b7a] hover:text-[#3d3029]"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold ${
                activeTab === tab.id
                  ? "bg-[#c9784e] text-white"
                  : "bg-[#e8ddd4] text-[#9a8b7a]"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </nav>

      {/* My Exams Tab */}
      {activeTab === "exams" && (
        <section className="space-y-4">
          {myExams.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#e8ddd4] bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5efe8]">
                <svg className="h-8 w-8 text-[#9a8b7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-[#3d3029]">No exams yet</h3>
              <p className="mt-2 text-[#9a8b7a]">Upload an answer key image to create your first exam</p>
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
                  className="group rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm transition-all hover:border-[#c9784e]/40 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-[#3d3029] group-hover:text-[#c9784e]">
                          {exam.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#9a8b7a]">
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
                            {exam.timeLimitMinutes} min
                          </span>
                          {exam.attempts.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {exam.attempts.length} attempt{exam.attempts.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {latestAttempt && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="h-2 flex-1 max-w-32 overflow-hidden rounded-full bg-[#f5efe8]">
                              <div
                                className="h-full rounded-full bg-[#7a9a6d]"
                                style={{ width: `${correctPercent}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-[#3d3029]">
                              {correctPercent}% correct
                            </span>
                            <span className="text-xs text-[#9a8b7a]">
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
                    <div className="flex items-center justify-between border-t border-[#e8ddd4] pt-4">
                      {examCardActions[exam.id]}
                      <span className="text-xs text-[#9a8b7a]">
                        Created {new Date(exam.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Past Attempts Tab */}
      {activeTab === "attempts" && (
        <section className="space-y-5">
          {allAttempts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#e8ddd4] bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5efe8]">
                <svg className="h-8 w-8 text-[#9a8b7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-[#3d3029]">No attempts yet</h3>
              <p className="mt-2 text-[#9a8b7a]">Take an exam to see your attempt history here</p>
            </div>
          ) : (
            (() => {
              // Group attempts by exam
              const grouped = new Map<string, { examId: string; examTitle: string; attempts: typeof allAttempts }>();
              for (const att of allAttempts) {
                if (!grouped.has(att.examId)) {
                  grouped.set(att.examId, { examId: att.examId, examTitle: att.examTitle, attempts: [] });
                }
                grouped.get(att.examId)!.attempts.push(att);
              }
              return Array.from(grouped.values()).map((group) => (
                <div key={group.examId} className="rounded-2xl border border-[#e8ddd4] bg-white shadow-sm overflow-hidden">
                  {/* Exam Header */}
                  <div className="flex items-center justify-between bg-[#f5efe8] px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#c9784e]">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#3d3029]">{group.examTitle}</h3>
                        <p className="text-xs text-[#9a8b7a]">{group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <Link
                      href={`/exams/${group.examId}/attempt`}
                      className="text-xs font-medium text-[#c9784e] hover:text-[#b5673f]"
                    >
                      Retake →
                    </Link>
                  </div>
                  {/* Attempt List */}
                  <div className="divide-y divide-[#e8ddd4]">
                    {group.attempts.map((att) => {
                      const total = att.correctCount + att.wrongCount + att.unansweredCount;
                      const pct = Math.round((att.correctCount / total) * 100);
                      const marks = att.correctCount * 4 + att.wrongCount * -1;
                      const submittedDate = new Date(att.submittedAt);

                      return (
                        <Link
                          key={att.id}
                          href={`/exams/${att.examId}/results/${att.id}`}
                          className="flex items-center gap-4 px-5 py-3 transition-all hover:bg-[#f9f5f0]"
                        >
                          {/* Score Circle */}
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: pct >= 70 ? "#eef4eb" : pct >= 40 ? "#f9ebe4" : "#fceaea",
                              color: pct >= 70 ? "#7a9a6d" : pct >= 40 ? "#c9784e" : "#c45c5c",
                            }}
                          >
                            {pct}%
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#9a8b7a]">
                              <span>{att.correctCount}/{total} correct</span>
                              <span className="hidden sm:inline">•</span>
                              <span className={marks >= 0 ? "text-[#7a9a6d]" : "text-[#c45c5c]"}>
                                {marks}/{total * 4} marks
                              </span>
                              <span className="hidden sm:inline">•</span>
                              <span>{att.wrongCount} wrong, {att.unansweredCount} skipped</span>
                            </div>
                          </div>

                          {/* Date & Arrow */}
                          <div className="flex shrink-0 items-center gap-2 text-xs text-[#9a8b7a]">
                            <div className="hidden sm:block text-right">
                              <p>{submittedDate.toLocaleDateString()}</p>
                              <p>{submittedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}
        </section>
      )}

      {/* Public Exams Tab */}
      {activeTab === "public" && (
        <section className="space-y-4">
          {publicExams.map((exam) => {
            const latestAttempt = exam.attempts[0];
            const totalQuestions = exam.questionCount;
            const correctPercent = latestAttempt
              ? Math.round((latestAttempt.correctCount / totalQuestions) * 100)
              : null;

            return (
              <div
                key={exam.id}
                className="group rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm transition-all hover:border-[#c9784e]/40 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-[#3d3029] group-hover:text-[#c9784e]">
                        {exam.title}
                      </h3>
                      <span className="rounded-full bg-[#eef4eb] px-2 py-0.5 text-xs font-medium text-[#7a9a6d]">
                        Public
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-[#9a8b7a]">
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
                        {exam.timeLimitMinutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        by {exam.user.email?.split("@")[0] ?? "unknown"}
                      </span>
                    </div>

                    {latestAttempt && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 max-w-32 overflow-hidden rounded-full bg-[#f5efe8]">
                          <div
                            className="h-full rounded-full bg-[#7a9a6d]"
                            style={{ width: `${correctPercent}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-[#3d3029]">
                          {correctPercent}% correct
                        </span>
                        <span className="text-xs text-[#9a8b7a]">
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
    </>
  );
}
