"use client";

import { useState } from "react";

type Tab = "correct" | "wrong" | "unanswered";

interface WrongQuestion {
  questionNumber: number;
  yourAnswer: string;
  correctAnswer: string;
}

interface CorrectQuestion {
  questionNumber: number;
  answer: string;
}

interface ResultsTabsProps {
  correctQuestions: CorrectQuestion[];
  wrongQuestions: WrongQuestion[];
  unansweredQuestions: number[];
  answerKey: Record<string, string>;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
}

export function ResultsTabs({
  correctQuestions,
  wrongQuestions,
  unansweredQuestions,
  answerKey,
  correctCount,
  wrongCount,
  unansweredCount,
}: ResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("correct");

  const cards = [
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
  ];

  return (
    <>
      {/* Clickable Stats Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActiveTab(card.id)}
            className={`rounded-2xl border-2 bg-white p-6 shadow-sm transition-all text-left ${
              activeTab === card.id
                ? "border-current ring-2 ring-current/20"
                : "border-[#e8ddd4] hover:border-[#c9784e]/50 hover:shadow-md"
            }`}
            style={{
              borderColor: activeTab === card.id ? card.textColor : undefined,
              "--tw-ring-color": activeTab === card.id ? `${card.textColor}33` : undefined,
            } as React.CSSProperties}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-sm text-[#9a8b7a]">{card.label}</p>
                <p className="text-2xl font-bold" style={{ color: card.textColor }}>
                  {card.count}
                </p>
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* Tab Content */}
      <section className="rounded-2xl border border-[#e8ddd4] bg-white shadow-sm">
        <div className="p-6">
        {/* Correct Answers Tab */}
        {activeTab === "correct" && (
          <div>
            {correctQuestions.length === 0 ? (
              <div className="rounded-xl bg-[#f5efe8] p-6 text-center">
                <p className="text-[#9a8b7a]">No correct answers</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e8ddd4]">
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
                        <td className="px-4 py-3 font-medium text-[#3d3029]">{row.questionNumber}</td>
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
            )}
          </div>
        )}

        {/* Wrong Answers Tab */}
        {activeTab === "wrong" && (
          <div>
            {wrongQuestions.length === 0 ? (
              <div className="rounded-xl bg-[#eef4eb] p-6 text-center">
                <p className="text-[#7a9a6d]">No wrong answers - great job!</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e8ddd4]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f5efe8]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Question</th>
                      <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Your Answer</th>
                      <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8ddd4]">
                    {wrongQuestions.map((row) => (
                      <tr key={row.questionNumber} className="bg-white">
                        <td className="px-4 py-3 font-medium text-[#3d3029]">{row.questionNumber}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#fceaea] text-sm font-semibold text-[#c45c5c]">
                            {row.yourAnswer}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef4eb] text-sm font-semibold text-[#7a9a6d]">
                            {row.correctAnswer}
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

        {/* Unanswered Tab */}
        {activeTab === "unanswered" && (
          <div>
            {unansweredQuestions.length === 0 ? (
              <div className="rounded-xl bg-[#eef4eb] p-6 text-center">
                <p className="text-[#7a9a6d]">All questions answered!</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#e8ddd4]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f5efe8]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Question</th>
                      <th className="px-4 py-3 text-left font-medium text-[#3d3029]">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e8ddd4]">
                    {unansweredQuestions.map((questionNumber) => (
                      <tr key={questionNumber} className="bg-white">
                        <td className="px-4 py-3 font-medium text-[#3d3029]">{questionNumber}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5efe8] text-sm font-semibold text-[#8b7355]">
                            {answerKey[String(questionNumber)] || "?"}
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
      </div>
      </section>
    </>
  );
}
