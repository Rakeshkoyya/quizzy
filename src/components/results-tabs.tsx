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
}

export function ResultsTabs({
  correctQuestions,
  wrongQuestions,
  unansweredQuestions,
  answerKey,
}: ResultsTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("correct");

  const tabs: { id: Tab; label: string; count: number; color: string; bgColor: string }[] = [
    {
      id: "correct",
      label: "Correct",
      count: correctQuestions.length,
      color: "#7a9a6d",
      bgColor: "#eef4eb",
    },
    {
      id: "wrong",
      label: "Wrong",
      count: wrongQuestions.length,
      color: "#c45c5c",
      bgColor: "#fceaea",
    },
    {
      id: "unanswered",
      label: "Unanswered",
      count: unansweredQuestions.length,
      color: "#8b7355",
      bgColor: "#f5efe8",
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e8ddd4] bg-white shadow-sm">
      {/* Tab Headers */}
      <div className="flex border-b border-[#e8ddd4]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "border-b-2 text-[#3d3029]"
                : "text-[#9a8b7a] hover:bg-[#f5efe8] hover:text-[#3d3029]"
            }`}
            style={{
              borderBottomColor: activeTab === tab.id ? tab.color : "transparent",
            }}
          >
            <span>{tab.label}</span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: tab.bgColor,
                color: tab.color,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
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
  );
}
