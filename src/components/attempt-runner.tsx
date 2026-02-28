"use client";

import type { AnswerOption, Exam } from "@/types/exam";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];

interface AttemptRunnerProps {
  exam: Exam;
}

export function AttemptRunner({ exam }: AttemptRunnerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(exam.timeLimitMinutes * 60);
  const [answers, setAnswers] = useState<Record<string, AnswerOption>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const submittedRef = useRef(false);

  const questionNumbers = useMemo(() => {
    return Object.keys(exam.answerKey)
      .map(Number)
      .sort((a, b) => a - b);
  }, [exam.answerKey]);

  const currentQuestion = questionNumbers[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questionNumbers.length) * 100);

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/exams/${exam.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startedAt: startedAtRef.current,
          userAnswers: answers,
        }),
      });
      const payload = (await response.json()) as { attemptId?: string; error?: string };

      if (!response.ok || !payload.attemptId) {
        throw new Error(payload.error ?? "Failed to submit exam");
      }

      router.push(`/exams/${exam.id}/results/${payload.attemptId}`);
    } catch (submitError) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : "Failed to submit");
    }
  }, [answers, exam.id, router]);

  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (!submittedRef.current) {
        void submitAttempt();
      }
      return;
    }

    const timer = setTimeout(() => setRemainingSeconds((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [remainingSeconds, submitAttempt]);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const isLowTime = remainingSeconds < 60;

  const goToPrevious = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const goToNext = () => setCurrentIndex((prev) => Math.min(questionNumbers.length - 1, prev + 1));

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--background)]">
      {/* Top Header Bar */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{exam.title}</h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Question {currentIndex + 1} of {questionNumbers.length} • {answeredCount} answered
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-mono text-xl font-semibold ${isLowTime ? "bg-[var(--error-light)] text-[var(--error)] animate-pulse" : "bg-[var(--secondary-light)] text-[var(--foreground)]"}`}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Question & Options (Static/Non-scrollable) */}
        <main className="flex flex-1 flex-col overflow-hidden p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
            {/* Progress Bar */}
            <div className="mb-6 flex-shrink-0">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary-light)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <section className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
              <div className="mb-6">
                <span className="inline-flex items-center justify-center rounded-xl bg-[var(--primary-light)] px-4 py-1.5 text-sm font-semibold text-[var(--primary)]">
                  Question {currentQuestion}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-medium text-[var(--foreground)]">Select your answer</h3>
              <p className="mb-6 text-sm text-[var(--muted)]">Choose the correct option from the choices below</p>

              <div className="grid gap-3 sm:grid-cols-2">
                {OPTIONS.map((option) => {
                  const selected = answers[String(currentQuestion)] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswers((prev) => ({ ...prev, [String(currentQuestion)]: option }))}
                      className={`group flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-light)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hover)] hover:bg-[var(--secondary-light)]"
                      }`}
                    >
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold ${
                        selected
                          ? "bg-[#c9784e] text-white"
                          : "bg-[#f5efe8] text-[#3d3029] group-hover:bg-[#e8ddd4]"
                      }`}>
                        {option}
                      </span>
                      <span className={`font-medium ${selected ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
                        Option {option}
                      </span>
                      {selected && (
                        <svg className="ml-auto h-5 w-5 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-6 rounded-xl bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
                  {error}
                </div>
              )}
            </section>

            {/* Navigation Buttons */}
            <div className="mt-6 flex flex-shrink-0 items-center justify-between gap-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0 || submitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={currentIndex === questionNumbers.length - 1 || submitting}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => void submitAttempt()}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-6 py-3 font-semibold text-white shadow-sm hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Exam
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Question Navigator (Scrollable) */}
        <aside className="w-72 flex-shrink-0 border-l border-[var(--border)] bg-[var(--card)]">
          <div className="flex h-full flex-col">
            <div className="flex-shrink-0 border-b border-[var(--border)] px-5 py-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Jump to Question</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {answeredCount} of {questionNumbers.length} completed
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-5 gap-2">
                {questionNumbers.map((questionNumber, index) => {
                  const answered = Boolean(answers[String(questionNumber)]);
                  const isActive = index === currentIndex;

                  return (
                    <button
                      key={questionNumber}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#c9784e] text-white shadow-md ring-2 ring-[#c9784e] ring-offset-2"
                          : answered
                          ? "border-2 border-[#7a9a6d] bg-[#eef4eb] text-[#7a9a6d]"
                          : "border border-[#e8ddd4] bg-white text-[#9a8b7a] hover:border-[#d4c4b5] hover:bg-[#f5efe8]"
                      }`}
                    >
                      {questionNumber}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-4">
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded border-2 border-[#7a9a6d] bg-[#eef4eb]"></span>
                  <span className="text-[var(--muted)]">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded border border-[#e8ddd4] bg-white"></span>
                  <span className="text-[var(--muted)]">Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded bg-[#c9784e]"></span>
                  <span className="text-[var(--muted)]">Current</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
