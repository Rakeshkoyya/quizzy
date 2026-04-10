"use client";

import { useState, useEffect } from "react";

export type ExplanationMode = "solution" | "explain_question" | "techniques";

export interface QuestionData {
  questionNumber: number;
  correctAnswer: string;
  userAnswer?: string;
  imageUrl?: string;
  questionText?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  type: "wrong" | "unanswered";
}

interface Props {
  question: QuestionData;
  examTitle: string;
  isActive: boolean;
  onSelect: () => void;
  onChatAction: (mode: ExplanationMode) => void;
}

export function QuestionExplanationCard({
  question,
  examTitle,
  isActive,
  onSelect,
  onChatAction,
}: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);

  // Auto-fetch solution summary for wrong answers on first render
  useEffect(() => {
    if (question.type === "wrong" && !explanation) {
      fetchExplanation("solution");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.questionNumber]);

  async function fetchExplanation(mode: ExplanationMode) {
    setLoading(true);
    try {
      const res = await fetch("/api/explain-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionNumber: question.questionNumber,
          questionImageUrl: question.imageUrl,
          questionText: question.questionText,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          userAnswer: question.userAnswer,
          correctAnswer: question.correctAnswer,
          examTitle,
          mode,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch explanation");
      const data = await res.json();
      setExplanation(data.explanation);
      setExpanded(true);
    } catch {
      setExplanation("Failed to generate explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border-2 bg-white p-5 transition-all ${
        isActive
          ? "border-[#c9784e] shadow-md ring-2 ring-[#c9784e]/20"
          : "border-[#e8ddd4] hover:border-[#c9784e]/50"
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5efe8] text-sm font-bold text-[#3d3029]">
            {question.questionNumber}
          </span>
          <div className="flex items-center gap-2">
            {question.type === "wrong" ? (
              <>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#fceaea] text-xs font-bold text-[#c45c5c]">
                  {question.userAnswer}
                </span>
                <svg className="h-4 w-4 text-[#9a8b7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4eb] text-xs font-bold text-[#7a9a6d]">
                  {question.correctAnswer}
                </span>
              </>
            ) : (
              <>
                <span className="rounded-md bg-[#f5efe8] px-2 py-0.5 text-xs font-medium text-[#8b7355]">
                  Unanswered
                </span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#eef4eb] text-xs font-bold text-[#7a9a6d]">
                  {question.correctAnswer}
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            question.type === "wrong"
              ? "bg-[#fceaea] text-[#c45c5c]"
              : "bg-[#f5efe8] text-[#8b7355]"
          }`}
        >
          {question.type === "wrong" ? "Wrong" : "Skipped"}
        </span>
      </div>

      {/* Question Image or Text */}
      {question.imageUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#e8ddd4] max-w-sm">
          <img
            src={question.imageUrl}
            alt={`Question ${question.questionNumber}`}
            className="w-full"
            loading="lazy"
          />
        </div>
      ) : question.questionText ? (
        <div className="mt-3 rounded-xl border border-[#e8ddd4] bg-[#f9f6f2] p-4">
          <p className="text-sm font-medium text-[#3d3029] leading-relaxed">{question.questionText}</p>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {(["A", "B", "C", "D"] as const).map((letter) => {
              const text = question[`option${letter}` as keyof QuestionData] as string | undefined;
              if (!text) return null;
              const isCorrect = question.correctAnswer === letter;
              const isWrong = question.userAnswer === letter && letter !== question.correctAnswer;
              return (
                <span
                  key={letter}
                  className={`rounded-lg px-2 py-1 ${
                    isCorrect ? "bg-[#eef4eb] font-medium text-[#7a9a6d]" : isWrong ? "bg-[#fceaea] font-medium text-[#c45c5c]" : "text-[#3d3029]"
                  }`}
                >
                  {letter}) {text}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Solution Summary */}
      {(explanation || loading) && (
        <div className="mt-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex items-center gap-2 text-sm font-medium text-[#c9784e] hover:text-[#b5673f]"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Solution Summary
          </button>
          {expanded && (
            <div className="mt-2 rounded-xl bg-[#f9f6f2] p-4 text-sm text-[#3d3029]">
              {loading ? (
                <div className="flex items-center gap-2 text-[#9a8b7a]">
                  <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating explanation...
                </div>
              ) : (
                <>
                  <div
                    className={`prose prose-sm max-w-none ${!showFull ? "line-clamp-5" : ""}`}
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(explanation || "") }}
                  />
                  {explanation && explanation.split("\n").length > 5 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFull(!showFull);
                      }}
                      className="mt-2 text-xs font-medium text-[#c9784e] hover:text-[#b5673f]"
                    >
                      {showFull ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton
          label="Explain Question"
          icon="question"
          onClick={(e) => {
            e.stopPropagation();
            onChatAction("explain_question");
          }}
        />
        <ActionButton
          label="Explain Solution"
          icon="lightbulb"
          onClick={(e) => {
            e.stopPropagation();
            if (!explanation) fetchExplanation("solution");
            onChatAction("solution");
          }}
        />
        <ActionButton
          label="Remember Techniques"
          icon="brain"
          onClick={(e) => {
            e.stopPropagation();
            onChatAction("techniques");
          }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "question" | "lightbulb" | "brain";
  onClick: (e: React.MouseEvent) => void;
}) {
  const icons = {
    question: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    lightbulb: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    brain: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8ddd4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3029] transition-all hover:border-[#c9784e] hover:bg-[#f9ebe4] hover:text-[#c9784e]"
    >
      {icons[icon]}
      {label}
    </button>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.*)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc pl-4 space-y-1">${match}</ul>`)
    .replace(/^### (.*)/gm, '<h3 class="font-semibold mt-2">$1</h3>')
    .replace(/^## (.*)/gm, '<h2 class="font-semibold text-base mt-2">$1</h2>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
