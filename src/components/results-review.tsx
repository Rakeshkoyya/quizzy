"use client";

import { useState } from "react";
import { QuestionExplanationCard, type QuestionData, type ExplanationMode } from "./question-explanation-card";
import { AIChatPanel } from "./ai-chat-panel";

type Tab = "wrong" | "unanswered" | "correct";

interface WrongQuestion {
  questionNumber: number;
  yourAnswer: string;
  correctAnswer: string;
}

interface CorrectQuestion {
  questionNumber: number;
  answer: string;
}

interface Props {
  correctQuestions: CorrectQuestion[];
  wrongQuestions: WrongQuestion[];
  unansweredQuestions: number[];
  answerKey: Record<string, string>;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  questionImageMap: Record<number, string>;
  questionTextMap: Record<number, { text: string; optionA?: string; optionB?: string; optionC?: string; optionD?: string }>;
  questionSectionMap: Record<number, string>;
  examTitle: string;
  scorePercent: number;
  marksObtained: number;
  maxMarks: number;
  totalQuestions: number;
}

export function ResultsReview({
  correctQuestions,
  wrongQuestions,
  unansweredQuestions,
  answerKey,
  correctCount,
  wrongCount,
  unansweredCount,
  questionImageMap,
  questionTextMap,
  questionSectionMap,
  examTitle,
  scorePercent,
  marksObtained,
  maxMarks,
  totalQuestions,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("wrong");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeQuestionNum, setActiveQuestionNum] = useState<number | null>(null);
  const [pendingChatAction, setPendingChatAction] = useState<ExplanationMode | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Build question data maps
  const wrongQData: QuestionData[] = wrongQuestions.map((q) => ({
    questionNumber: q.questionNumber,
    correctAnswer: q.correctAnswer,
    userAnswer: q.yourAnswer,
    imageUrl: questionImageMap[q.questionNumber],
    questionText: questionTextMap[q.questionNumber]?.text,
    optionA: questionTextMap[q.questionNumber]?.optionA,
    optionB: questionTextMap[q.questionNumber]?.optionB,
    optionC: questionTextMap[q.questionNumber]?.optionC,
    optionD: questionTextMap[q.questionNumber]?.optionD,
    type: "wrong" as const,
  }));

  const unansweredQData: QuestionData[] = unansweredQuestions.map((qn) => ({
    questionNumber: qn,
    correctAnswer: answerKey[String(qn)] || "?",
    imageUrl: questionImageMap[qn],
    questionText: questionTextMap[qn]?.text,
    optionA: questionTextMap[qn]?.optionA,
    optionB: questionTextMap[qn]?.optionB,
    optionC: questionTextMap[qn]?.optionC,
    optionD: questionTextMap[qn]?.optionD,
    type: "unanswered" as const,
  }));

  const activeQuestion =
    [...wrongQData, ...unansweredQData].find((q) => q.questionNumber === activeQuestionNum) || null;

  // Compute subject/section-wise analysis
  const hasSections = Object.keys(questionSectionMap).length > 0;
  const sectionAnalysis = (() => {
    if (!hasSections) return [];
    const wrongSet = new Set(wrongQuestions.map((q) => q.questionNumber));
    const unansweredSet = new Set(unansweredQuestions);
    const sections = new Map<string, { total: number; correct: number; wrong: number; unanswered: number }>();

    // Iterate all questions via answer key
    for (const qNum of Object.keys(answerKey).map(Number)) {
      const section = questionSectionMap[qNum];
      if (!section) continue;
      if (!sections.has(section)) {
        sections.set(section, { total: 0, correct: 0, wrong: 0, unanswered: 0 });
      }
      const s = sections.get(section)!;
      s.total++;
      if (wrongSet.has(qNum)) s.wrong++;
      else if (unansweredSet.has(qNum)) s.unanswered++;
      else s.correct++;
    }

    return Array.from(sections.entries())
      .map(([name, stats]) => ({
        name,
        ...stats,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        marks: stats.correct * 4 + stats.wrong * -1,
        maxMarks: stats.total * 4,
      }))
      .sort((a, b) => a.accuracy - b.accuracy); // weakest first
  })();

  function handleChatAction(questionNumber: number, mode: ExplanationMode) {
    setActiveQuestionNum(questionNumber);
    setPendingChatAction(mode);
    setChatOpen(true);
  }

  const statCards = [
    {
      id: "wrong" as Tab,
      label: "Wrong",
      count: wrongCount,
      iconBg: "#fceaea",
      iconColor: "#c45c5c",
      textColor: "#c45c5c",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    {
      id: "unanswered" as Tab,
      label: "Unanswered",
      count: unansweredCount,
      iconBg: "#f5efe8",
      iconColor: "#8b7355",
      textColor: "#8b7355",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "correct" as Tab,
      label: "Correct",
      count: correctCount,
      iconBg: "#eef4eb",
      iconColor: "#7a9a6d",
      textColor: "#7a9a6d",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Score Summary */}
      <section className="rounded-2xl border border-[#e8ddd4] bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f9ebe4]">
            <span className="text-2xl font-bold text-[#c9784e]">{scorePercent}%</span>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold text-[#3d3029]">Your Score</h2>
            <p className="text-sm text-[#9a8b7a]">
              {correctCount} out of {totalQuestions} questions correct
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#f5efe8] px-3 py-1.5">
              <span className={`text-lg font-bold ${marksObtained >= 0 ? "text-[#7a9a6d]" : "text-[#c45c5c]"}`}>
                {marksObtained}
              </span>
              <span className="text-sm text-[#9a8b7a]">/</span>
              <span className="text-lg font-bold text-[#3d3029]">{maxMarks}</span>
              <span className="text-xs text-[#9a8b7a]">marks</span>
            </div>
          </div>
        </div>
      </section>

      {/* Subject-wise Analysis */}
      {hasSections && (
        <section className="rounded-2xl border border-[#e8ddd4] bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#f9f5f0] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5efe8]">
                <svg className="h-5 w-5 text-[#c9784e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#3d3029]">Subject Analysis</h3>
                <p className="text-xs text-[#9a8b7a]">
                  {sectionAnalysis.length} subject{sectionAnalysis.length !== 1 ? "s" : ""} • Weakest first
                </p>
              </div>
            </div>
            <svg
              className={`h-5 w-5 text-[#9a8b7a] transition-transform ${showAnalysis ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showAnalysis && (
            <div className="border-t border-[#e8ddd4] px-6 py-5 space-y-4">
              {sectionAnalysis.map((sec) => {
                const barColor =
                  sec.accuracy >= 70 ? "#7a9a6d" : sec.accuracy >= 40 ? "#c9784e" : "#c45c5c";
                const bgColor =
                  sec.accuracy >= 70 ? "#eef4eb" : sec.accuracy >= 40 ? "#f9ebe4" : "#fceaea";
                const label =
                  sec.accuracy >= 70 ? "Strong" : sec.accuracy >= 40 ? "Needs Work" : "Weak";

                return (
                  <div key={sec.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#3d3029]">{sec.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: bgColor, color: barColor }}
                        >
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#9a8b7a]">
                        <span>{sec.correct}/{sec.total} correct</span>
                        <span className={sec.marks >= 0 ? "text-[#7a9a6d] font-medium" : "text-[#c45c5c] font-medium"}>
                          {sec.marks}/{sec.maxMarks}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#f5efe8]">
                      {sec.correct > 0 && (
                        <div
                          className="h-full rounded-l-full"
                          style={{ width: `${(sec.correct / sec.total) * 100}%`, backgroundColor: "#7a9a6d" }}
                        />
                      )}
                      {sec.wrong > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${(sec.wrong / sec.total) * 100}%`, backgroundColor: "#c45c5c" }}
                        />
                      )}
                      {sec.unanswered > 0 && (
                        <div
                          className="h-full"
                          style={{ width: `${(sec.unanswered / sec.total) * 100}%`, backgroundColor: "#d4c5b5" }}
                        />
                      )}
                    </div>
                    {/* Legend row */}
                    <div className="flex gap-4 text-[10px] text-[#9a8b7a]">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#7a9a6d]" />
                        {sec.correct} correct
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#c45c5c]" />
                        {sec.wrong} wrong
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-[#d4c5b5]" />
                        {sec.unanswered} skipped
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Summary comparison table */}
              {sectionAnalysis.length > 1 && (
                <div className="mt-4 rounded-xl border border-[#e8ddd4] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#f5efe8]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-[#3d3029]">Subject</th>
                        <th className="px-3 py-2 text-center font-medium text-[#3d3029]">Accuracy</th>
                        <th className="px-3 py-2 text-center font-medium text-[#7a9a6d]">✓</th>
                        <th className="px-3 py-2 text-center font-medium text-[#c45c5c]">✗</th>
                        <th className="px-3 py-2 text-center font-medium text-[#9a8b7a]">–</th>
                        <th className="px-3 py-2 text-right font-medium text-[#3d3029]">Marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8ddd4]">
                      {sectionAnalysis.map((sec) => (
                        <tr key={sec.name} className="bg-white">
                          <td className="px-3 py-2 font-medium text-[#3d3029]">{sec.name}</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className="inline-flex min-w-[3rem] justify-center rounded-full px-2 py-0.5 font-semibold"
                              style={{
                                backgroundColor: sec.accuracy >= 70 ? "#eef4eb" : sec.accuracy >= 40 ? "#f9ebe4" : "#fceaea",
                                color: sec.accuracy >= 70 ? "#7a9a6d" : sec.accuracy >= 40 ? "#c9784e" : "#c45c5c",
                              }}
                            >
                              {sec.accuracy}%
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-[#7a9a6d]">{sec.correct}</td>
                          <td className="px-3 py-2 text-center text-[#c45c5c]">{sec.wrong}</td>
                          <td className="px-3 py-2 text-center text-[#9a8b7a]">{sec.unanswered}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={sec.marks >= 0 ? "text-[#7a9a6d] font-medium" : "text-[#c45c5c] font-medium"}>
                              {sec.marks}/{sec.maxMarks}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Stat Cards */}
      <section className="grid gap-3 grid-cols-3">
        {statCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveTab(card.id)}
            className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-all text-left ${
              activeTab === card.id
                ? "border-current ring-2 ring-current/20"
                : "border-[#e8ddd4] hover:border-[#c9784e]/50"
            }`}
            style={{
              borderColor: activeTab === card.id ? card.textColor : undefined,
              "--tw-ring-color": activeTab === card.id ? `${card.textColor}33` : undefined,
            } as React.CSSProperties}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-xs text-[#9a8b7a]">{card.label}</p>
                <p className="text-xl font-bold" style={{ color: card.textColor }}>
                  {card.count}
                </p>
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* Main Content: Questions + Chat Panel */}
      <div className="flex gap-6">
        {/* Left: Question List */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Wrong Tab */}
          {activeTab === "wrong" && (
            <>
              {wrongQData.length === 0 ? (
                <div className="rounded-2xl border border-[#e8ddd4] bg-[#eef4eb] p-8 text-center">
                  <p className="text-[#7a9a6d] font-medium">No wrong answers - great job!</p>
                </div>
              ) : (
                wrongQData.map((q) => (
                  <QuestionExplanationCard
                    key={q.questionNumber}
                    question={q}
                    examTitle={examTitle}
                    isActive={activeQuestionNum === q.questionNumber}
                    onSelect={() => {
                      setActiveQuestionNum(q.questionNumber);
                      setChatOpen(true);
                    }}
                    onChatAction={(mode) => handleChatAction(q.questionNumber, mode)}
                  />
                ))
              )}
            </>
          )}

          {/* Unanswered Tab */}
          {activeTab === "unanswered" && (
            <>
              {unansweredQData.length === 0 ? (
                <div className="rounded-2xl border border-[#e8ddd4] bg-[#eef4eb] p-8 text-center">
                  <p className="text-[#7a9a6d] font-medium">All questions answered!</p>
                </div>
              ) : (
                unansweredQData.map((q) => (
                  <QuestionExplanationCard
                    key={q.questionNumber}
                    question={q}
                    examTitle={examTitle}
                    isActive={activeQuestionNum === q.questionNumber}
                    onSelect={() => {
                      setActiveQuestionNum(q.questionNumber);
                      setChatOpen(true);
                    }}
                    onChatAction={(mode) => handleChatAction(q.questionNumber, mode)}
                  />
                ))
              )}
            </>
          )}

          {/* Correct Tab */}
          {activeTab === "correct" && (
            <>
              {correctQuestions.length === 0 ? (
                <div className="rounded-2xl border border-[#e8ddd4] bg-[#f5efe8] p-8 text-center">
                  <p className="text-[#9a8b7a]">No correct answers</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#e8ddd4] bg-white shadow-sm">
                  <div className="overflow-hidden rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-[#f5efe8]">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Question</th>
                          <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Your Answer</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e8ddd4]">
                        {correctQuestions.map((row) => (
                          <tr key={row.questionNumber} className="bg-white">
                            <td className="px-4 py-3 font-medium text-[#3d3029]">
                              {row.questionNumber}
                              {questionImageMap[row.questionNumber] && (
                                <img
                                  src={questionImageMap[row.questionNumber]}
                                  alt={`Q${row.questionNumber}`}
                                  className="mt-2 max-w-xs rounded border border-[#e8ddd4]"
                                  loading="lazy"
                                />
                              )}
                              {!questionImageMap[row.questionNumber] && questionTextMap[row.questionNumber] && (
                                <p className="mt-1 text-xs text-[#9a8b7a] font-normal">
                                  {questionTextMap[row.questionNumber].text}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef4eb] text-sm font-semibold text-[#7a9a6d]">
                                {row.answer}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Chat Panel (Desktop) */}
        <div className="hidden lg:block w-[400px] shrink-0">
          <div className="sticky top-4 h-[calc(100vh-120px)]">
            <AIChatPanel
              activeQuestion={activeQuestion}
              examTitle={examTitle}
              pendingAction={pendingChatAction}
              onActionHandled={() => setPendingChatAction(null)}
              isOpen={true}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Chat Drawer */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setChatOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl">
            <div className="h-full">
              <AIChatPanel
                activeQuestion={activeQuestion}
                examTitle={examTitle}
                pendingAction={pendingChatAction}
                onActionHandled={() => setPendingChatAction(null)}
                isOpen={true}
                onClose={() => setChatOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Chat FAB */}
      {!chatOpen && activeQuestionNum && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#c9784e] text-white shadow-lg hover:bg-[#b5673f] lg:hidden"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </button>
      )}
    </div>
  );
}
