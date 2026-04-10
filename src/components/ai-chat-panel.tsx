"use client";

import { useState, useRef, useEffect } from "react";
import type { ExplanationMode, QuestionData } from "./question-explanation-card";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  activeQuestion: QuestionData | null;
  examTitle: string;
  pendingAction: ExplanationMode | null;
  onActionHandled: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_PROMPTS: Record<ExplanationMode, string> = {
  explain_question: "Please explain this question in detail. What is it asking? What concepts are being tested?",
  solution: "Please explain the correct solution step by step. Why is the correct answer right, and why is my answer wrong?",
  techniques: "What are some memory techniques, tricks, or shortcuts to remember this concept and solve similar questions quickly?",
};

export function AIChatPanel({
  activeQuestion,
  examTitle,
  pendingAction,
  onActionHandled,
  isOpen,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [currentQuestionNum, setCurrentQuestionNum] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Reset chat when active question changes
  useEffect(() => {
    if (activeQuestion && activeQuestion.questionNumber !== currentQuestionNum) {
      setMessages([]);
      setCurrentQuestionNum(activeQuestion.questionNumber);
    }
  }, [activeQuestion, currentQuestionNum]);

  // Handle pending action from parent
  useEffect(() => {
    if (pendingAction && activeQuestion) {
      const prompt = ACTION_PROMPTS[pendingAction];
      sendMessage(prompt);
      onActionHandled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAction]);

  async function sendMessage(content: string) {
    if (!content.trim() || !activeQuestion || streaming) return;

    const userMessage: ChatMessage = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          questionContext: {
            questionNumber: activeQuestion.questionNumber,
            questionImageUrl: activeQuestion.imageUrl,
            questionText: activeQuestion.questionText,
            optionA: activeQuestion.optionA,
            optionB: activeQuestion.optionB,
            optionC: activeQuestion.optionC,
            optionD: activeQuestion.optionD,
            userAnswer: activeQuestion.userAnswer,
            correctAnswer: activeQuestion.correctAnswer,
            examTitle,
          },
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-[#e8ddd4] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e8ddd4] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f9ebe4]">
            <svg className="h-4 w-4 text-[#c9784e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#3d3029]">AI Tutor</h3>
            {activeQuestion && (
              <p className="text-xs text-[#9a8b7a]">Question #{activeQuestion.questionNumber}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[#9a8b7a] hover:bg-[#f5efe8] hover:text-[#3d3029] lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!activeQuestion ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f5efe8]">
                <svg className="h-6 w-6 text-[#9a8b7a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-[#9a8b7a]">Select a question to start discussing</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f9ebe4]">
                <svg className="h-6 w-6 text-[#c9784e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[#3d3029]">Q#{activeQuestion.questionNumber}</p>
              <p className="mt-1 text-xs text-[#9a8b7a]">
                Use the buttons below or ask anything about this question
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(["explain_question", "solution", "techniques"] as ExplanationMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => sendMessage(ACTION_PROMPTS[mode])}
                    className="rounded-lg border border-[#e8ddd4] bg-white px-3 py-1.5 text-xs font-medium text-[#3d3029] hover:border-[#c9784e] hover:bg-[#f9ebe4] hover:text-[#c9784e]"
                  >
                    {mode === "explain_question" ? "Explain Question" : mode === "solution" ? "Explain Solution" : "Remember Techniques"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-[#c9784e] text-white"
                      : "bg-[#f5efe8] text-[#3d3029]"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-sm max-w-none [&_strong]:font-semibold [&_li]:ml-4 [&_ul]:list-disc [&_ol]:list-decimal [&_ol]:ml-4"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.role === "assistant" && streaming && i === messages.length - 1 && (
                    <span className="inline-block h-4 w-1 animate-pulse bg-[#c9784e] ml-0.5" />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {activeQuestion && (
        <div className="border-t border-[#e8ddd4] p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this question..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[#e8ddd4] bg-[#f9f6f2] px-4 py-2.5 text-sm text-[#3d3029] placeholder-[#9a8b7a] focus:border-[#c9784e] focus:outline-none focus:ring-1 focus:ring-[#c9784e]"
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || streaming}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9784e] text-white transition-colors hover:bg-[#b5673f] disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
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
    .replace(/`([^`]+)`/g, '<code class="rounded bg-[#e8ddd4] px-1 py-0.5 text-xs">$1</code>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
