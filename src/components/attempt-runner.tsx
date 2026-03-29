"use client";

import type { AnswerOption, Exam } from "@/types/exam";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from "react";

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
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [showNavDrawer, setShowNavDrawer] = useState(false);
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const imageContainerRef = useRef<HTMLDivElement>(null);
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

  // Find question image URL if available
  const currentQuestionData = exam.questions?.find(
    (q) => q.questionNumber === currentQuestion
  );
  const questionImageUrl = currentQuestionData?.imageUrl;

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
  const unansweredCount = questionNumbers.length - answeredCount;
  const reviewCount_ = markedForReview.size;
  const confirmMessage =
    unansweredCount > 0 || reviewCount_ > 0
      ? "You still have " + [
          unansweredCount > 0 ? `${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"}` : "",
          reviewCount_ > 0 ? `${reviewCount_} marked for review` : "",
        ].filter(Boolean).join(" and ") + "."
      : "You have answered all questions.";

  const selectOption = (questionNumber: number, option: AnswerOption) => {
    const questionKey = String(questionNumber);
    setAnswers((prev) => {
      if (prev[questionKey] === option) {
        const nextAnswers = { ...prev };
        delete nextAnswers[questionKey];
        return nextAnswers;
      }

      return { ...prev, [questionKey]: option };
    });
  };

  const handleManualSubmit = () => {
    setShowSubmitConfirm(true);
  };

  const toggleReview = (questionNumber: number) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionNumber)) {
        next.delete(questionNumber);
      } else {
        next.add(questionNumber);
      }
      return next;
    });
  };

  const isCurrentMarked = markedForReview.has(currentQuestion);
  const reviewCount = markedForReview.size;

  // Compute zoom level that fits the entire image inside the container
  const computeFitZoom = useCallback(() => {
    const container = imageContainerRef.current;
    if (!container || !naturalSize) return 1;
    // Subtract padding (p-4 = 16px each side)
    const cw = container.clientWidth - 32;
    const ch = container.clientHeight - 32;
    if (cw <= 0 || ch <= 0) return 1;
    const scaleW = cw / naturalSize.w;
    const scaleH = ch / naturalSize.h;
    return Math.min(scaleW, scaleH); // scale up or down to fit entirely
  }, [naturalSize]);

  // Reset zoom when switching questions
  useEffect(() => {
    setZoomLevel(null);
    setNaturalSize(null);
    if (imageContainerRef.current) {
      imageContainerRef.current.scrollTop = 0;
      imageContainerRef.current.scrollLeft = 0;
    }
  }, [currentIndex]);

  // Auto-fit when natural size becomes known or container resizes
  useEffect(() => {
    if (naturalSize && zoomLevel === null) {
      // Small delay to let container layout settle
      requestAnimationFrame(() => setZoomLevel(computeFitZoom()));
    }
  }, [naturalSize, zoomLevel, computeFitZoom]);

  const effectiveZoom = zoomLevel ?? computeFitZoom();

  const zoomIn = () => setZoomLevel(Math.min((effectiveZoom) + 0.05, 5));
  const zoomOut = () => setZoomLevel(Math.max((effectiveZoom) - 0.05, 0.05));
  const zoomFit = () => setZoomLevel(computeFitZoom());

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleImageWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoomLevel(Math.min(effectiveZoom + 0.05, 5));
      } else {
        setZoomLevel(Math.max(effectiveZoom - 0.05, 0.05));
      }
    }
  };

  const handleConfirmSubmit = () => {
    setShowSubmitConfirm(false);
    void submitAttempt();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[var(--background)]">
      {/* ── Top Header Bar ─────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-[var(--foreground)] lg:text-lg xl:text-xl">{exam.title}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Question {currentIndex + 1} of {questionNumbers.length} • {answeredCount} answered
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Navigator toggle — hidden on xl where sidebar is always visible */}
            <button
              type="button"
              onClick={() => setShowNavDrawer(true)}
              className="relative xl:hidden flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)]"
              title="Jump to question"
            >
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8M4 18h8" />
              </svg>
              <span className="hidden sm:inline">Questions</span>
              {answeredCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#7a9a6d] px-0.5 text-[9px] font-bold text-white">
                  {answeredCount}
                </span>
              )}
            </button>

            {/* Timer */}
            <div
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-sm font-semibold lg:text-base xl:px-4 xl:text-lg ${
                isLowTime
                  ? "bg-[var(--error-light)] text-[var(--error)] animate-pulse"
                  : "bg-[var(--secondary-light)] text-[var(--foreground)]"
              }`}
            >
              <svg className="h-3.5 w-3.5 lg:h-4 lg:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--secondary-light)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* ── Panel 1: Question Image Viewer ─────────────────── */}
          {/* Tablet: flex-1 fills remaining space. Laptop+: flex-1 fills horizontal space */}
          <div className="flex min-h-0 flex-1 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r">
            {/* Image panel header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 lg:px-4 lg:py-2.5">
              <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary-light)] px-3 py-1 text-sm font-semibold text-[var(--primary)]">
                Q{currentQuestion}
              </span>
              {/* Zoom Controls */}
              {questionImageUrl && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={effectiveZoom <= 0.05}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:opacity-30"
                    title="Zoom out"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="min-w-[2.5rem] text-center text-xs font-medium text-[var(--muted)]">
                    {Math.round(effectiveZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={effectiveZoom >= 5}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:opacity-30"
                    title="Zoom in"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <div className="mx-0.5 h-4 w-px bg-[var(--border)]" />
                  <button
                    type="button"
                    onClick={zoomFit}
                    className="flex h-7 items-center justify-center rounded-md px-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)]"
                    title="Fit to screen"
                  >
                    Fit
                  </button>
                </div>
              )}
            </div>
            {/* Image Area */}
            <div
              ref={imageContainerRef}
              className="flex-1 overflow-auto bg-[#f8f6f3]"
              onWheel={handleImageWheel}
            >
              {questionImageUrl ? (
                <div className="flex min-h-full min-w-full items-center justify-center p-4">
                  <img
                    src={questionImageUrl}
                    alt={`Question ${currentQuestion}`}
                    className="block max-w-none transition-[width,height] duration-150"
                    style={{
                      width: naturalSize ? `${naturalSize.w * effectiveZoom}px` : "auto",
                      height: "auto",
                    }}
                    draggable={false}
                    onLoad={handleImageLoad}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                  No image available for this question
                </div>
              )}
            </div>
          </div>

          {/* ── Panel 2: Answer Options + Navigation ──────────── */}
          {/* Tablet: auto-height at bottom. Laptop+: fixed-width column */}
          <div className="flex flex-shrink-0 flex-col lg:flex-1 lg:w-72 lg:flex-none xl:w-80 lg:overflow-hidden">
            {/* Options Header — laptop+ only */}
            <div className="hidden flex-shrink-0 border-b border-[var(--border)] bg-[var(--card)] px-5 py-3 lg:block">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Select your answer</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Choose the correct option below</p>
            </div>

            {/* Vertical Options List — laptop+ only */}
            <div className="hidden flex-1 overflow-y-auto p-4 lg:block">
              <div className="grid gap-2.5">
                {OPTIONS.map((option) => {
                  const selected = answers[String(currentQuestion)] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectOption(currentQuestion, option)}
                      className={`group flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                        selected
                          ? "border-[var(--primary)] bg-[var(--primary-light)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-hover)] hover:bg-[var(--secondary-light)]"
                      }`}
                    >
                      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base font-semibold ${
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

              {/* Error — laptop+ */}
              {error && (
                <div className="mt-3 rounded-xl bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
                  {error}
                </div>
              )}
            </div>

            {/* Horizontal Option Buttons — tablet only (< lg) */}
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 lg:hidden">
              <div className="grid grid-cols-4 gap-2">
                {OPTIONS.map((option) => {
                  const selected = answers[String(currentQuestion)] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectOption(currentQuestion, option)}
                      className={`flex items-center justify-center rounded-xl border-2 py-2 transition-all ${
                        selected
                          ? "border-[#c9784e] bg-[var(--primary-light)]"
                          : "border-[var(--border)] bg-[var(--card)] hover:border-[#d4c4b5] hover:bg-[var(--secondary-light)]"
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold ${
                        selected ? "bg-[#c9784e] text-white" : "bg-[#f5efe8] text-[#3d3029]"
                      }`}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Error — tablet */}
              {error && (
                <div className="mt-2 rounded-xl bg-[var(--error-light)] px-3 py-2 text-sm text-[var(--error)]">
                  {error}
                </div>
              )}
            </div>

            {/* Mark for Review + Navigation */}
            <div className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2 lg:px-4 lg:py-3">
              <button
                type="button"
                onClick={goToPrevious}
                disabled={currentIndex === 0 || submitting}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-50 lg:gap-1.5 lg:px-3 lg:py-2.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
              </button>

              {/* Mark for Review — center */}
              <button
                type="button"
                onClick={() => toggleReview(currentQuestion)}
                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-medium transition-all lg:py-2.5 lg:text-sm ${
                  isCurrentMarked
                    ? "border-[#d4a017] bg-[#fdf6e3] text-[#b8860b]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[#d4a017] hover:bg-[#fdf6e3] hover:text-[#b8860b]"
                }`}
              >
                <svg className="h-3.5 w-3.5 lg:h-4 lg:w-4" fill={isCurrentMarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {isCurrentMarked ? "Marked" : "Review"}
              </button>

              <button
                type="button"
                onClick={goToNext}
                disabled={currentIndex === questionNumbers.length - 1 || submitting}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-50 lg:gap-1.5 lg:px-3 lg:py-2.5"
              >
                <span className="hidden sm:inline">Next</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Submit button — visible on tablet & laptop, hidden on xl where sidebar has it */}
            <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-3 pb-2 pt-2 xl:hidden">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9784e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Exam
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* ── Right Sidebar — permanent on xl+ ──────────────── */}
        <aside className="hidden w-64 flex-shrink-0 border-l border-[var(--border)] bg-[var(--card)] xl:flex xl:w-72">
          <div className="flex h-full w-full flex-col">
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
                  const isReview = markedForReview.has(questionNumber);

                  return (
                    <button
                      key={questionNumber}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={`relative flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[#c9784e] text-white shadow-md ring-2 ring-[#c9784e] ring-offset-2"
                          : answered
                          ? "border-2 border-[#7a9a6d] bg-[#eef4eb] text-[#7a9a6d]"
                          : "border border-[#e8ddd4] bg-white text-[#9a8b7a] hover:border-[#d4c4b5] hover:bg-[#f5efe8]"
                      }`}
                    >
                      {questionNumber}
                      {isReview && (
                        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#d4a017]">
                          <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-3">
              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border-2 border-[#7a9a6d] bg-[#eef4eb]"></span>
                  <span className="text-[var(--muted)]">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border border-[#e8ddd4] bg-white"></span>
                  <span className="text-[var(--muted)]">Unanswered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded bg-[#c9784e]"></span>
                  <span className="text-[var(--muted)]">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative h-3.5 w-3.5 rounded border border-[#e8ddd4] bg-white"><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#d4a017]"></span></span>
                  <span className="text-[var(--muted)]">Marked for Review</span>
                </div>
              </div>
            </div>
            {/* Submit Button */}
            <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-4">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9784e] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Exam
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Navigator Drawer — slides in from right on tablet & laptop (< xl) ── */}
      <div
        className={`xl:hidden fixed inset-0 z-40 transition-all duration-300 ${
          showNavDrawer ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
            showNavDrawer ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setShowNavDrawer(false)}
        />
        {/* Drawer panel */}
        <div
          className={`absolute bottom-0 right-0 top-0 flex w-72 flex-col bg-[var(--card)] shadow-2xl transition-transform duration-300 sm:w-80 ${
            showNavDrawer ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {/* Drawer header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Jump to Question</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {answeredCount} of {questionNumbers.length} completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNavDrawer(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Question grid */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-5 gap-2">
              {questionNumbers.map((questionNumber, index) => {
                const answered = Boolean(answers[String(questionNumber)]);
                const isActive = index === currentIndex;
                const isReview = markedForReview.has(questionNumber);
                return (
                  <button
                    key={questionNumber}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(index);
                      setShowNavDrawer(false);
                    }}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-[#c9784e] text-white shadow-md ring-2 ring-[#c9784e] ring-offset-2"
                        : answered
                        ? "border-2 border-[#7a9a6d] bg-[#eef4eb] text-[#7a9a6d]"
                        : "border border-[#e8ddd4] bg-white text-[#9a8b7a] hover:border-[#d4c4b5] hover:bg-[#f5efe8]"
                    }`}
                  >
                    {questionNumber}
                    {isReview && (
                      <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-[#d4a017]">
                        <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-3">
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded border-2 border-[#7a9a6d] bg-[#eef4eb]"></span>
                <span className="text-[var(--muted)]">Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded border border-[#e8ddd4] bg-white"></span>
                <span className="text-[var(--muted)]">Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded bg-[#c9784e]"></span>
                <span className="text-[var(--muted)]">Current</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative h-3.5 w-3.5 rounded border border-[#e8ddd4] bg-white"><span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#d4a017]"></span></span>
                <span className="text-[var(--muted)]">Marked for Review</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setShowNavDrawer(false);
                handleManualSubmit();
              }}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9784e] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Submit Exam
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Submit Confirmation Modal ───────────────────────────── */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Confirm submission</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{confirmMessage}</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Submit your exam now?</p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={submitting}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={submitting}
                className="rounded-xl bg-[#c9784e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
