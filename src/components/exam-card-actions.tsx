"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import SectionEditor, { type SectionDefinition } from "@/components/section-editor";

interface ExamQuestion {
  questionNumber: number;
  section?: string | null;
}

interface ExamCardActionsProps {
  examId: string;
  isPublic: boolean;
  isOwner: boolean;
  questionCount: number;
  questions?: ExamQuestion[];
}

export function ExamCardActions({ examId, isPublic, isOwner, questionCount, questions }: ExamCardActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentIsPublic, setCurrentIsPublic] = useState(isPublic);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSectionEditor, setShowSectionEditor] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [editSections, setEditSections] = useState<SectionDefinition[]>([]);

  // Build initial sections from existing question data
  const buildInitialSections = useCallback((): SectionDefinition[] => {
    if (!questions || questions.length === 0) return [];
    const sectionMap = new Map<string, { min: number; max: number }>();
    for (const q of questions) {
      if (!q.section) continue;
      const existing = sectionMap.get(q.section);
      if (existing) {
        existing.min = Math.min(existing.min, q.questionNumber);
        existing.max = Math.max(existing.max, q.questionNumber);
      } else {
        sectionMap.set(q.section, { min: q.questionNumber, max: q.questionNumber });
      }
    }
    const result: SectionDefinition[] = [];
    for (const [name, range] of sectionMap) {
      result.push({
        id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        fromQuestion: range.min,
        toQuestion: range.max,
      });
    }
    return result;
  }, [questions]);

  useEffect(() => {
    if (showSectionEditor) {
      setEditSections(buildInitialSections());
      setSectionError(null);
    }
  }, [showSectionEditor, buildInitialSections]);

  async function togglePublic() {
    setLoading(true);
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !currentIsPublic }),
      });

      if (response.ok) {
        setCurrentIsPublic(!currentIsPublic);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveSections() {
    setSavingSections(true);
    setSectionError(null);
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: editSections
            .filter((s) => s.name.trim())
            .map((s) => ({
              name: s.name.trim(),
              fromQuestion: s.fromQuestion,
              toQuestion: s.toQuestion,
            })),
        }),
      });

      if (response.ok) {
        setShowSectionEditor(false);
        router.refresh();
      } else {
        const data = (await response.json()) as { error?: string };
        setSectionError(data.error ?? "Failed to save sections");
      }
    } catch {
      setSectionError("Failed to save sections");
    } finally {
      setSavingSections(false);
    }
  }

  async function deleteExam() {
    setLoading(true);
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  }

  if (!isOwner) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Edit Exam Button */}
        <Link
          href={`/exams/${examId}/edit`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary-light)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[#c9784e] hover:text-white transition-colors"
          title="Edit exam"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Edit
        </Link>

        {/* Edit Sections Button */}
        <button
          type="button"
          onClick={() => setShowSectionEditor(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary-light)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
          title="Edit sections"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Sections
        </button>

        {/* Public/Private Toggle */}
        <button
          type="button"
          onClick={() => void togglePublic()}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            currentIsPublic
              ? "bg-[var(--success-light)] text-[var(--success)] hover:bg-green-200"
              : "bg-[var(--secondary-light)] text-[var(--muted)] hover:bg-[var(--border)]"
          } disabled:opacity-50`}
          title={currentIsPublic ? "Make private" : "Make public"}
        >
          {currentIsPublic ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Public
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Private
            </>
          )}
        </button>

        {/* Delete Button */}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void deleteExam()}
              disabled={loading}
              className="rounded-lg bg-[var(--error)] px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? "Deleting..." : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
              className="rounded-lg bg-[var(--secondary-light)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--border)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--secondary-light)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-[var(--error-light)] hover:text-[var(--error)] transition-colors"
            title="Delete exam"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>

      {/* Section Editor Modal */}
      {showSectionEditor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSectionEditor(false);
          }}
        >
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Edit Sections</h2>
              <button
                type="button"
                onClick={() => setShowSectionEditor(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <SectionEditor
              totalQuestions={questionCount}
              initialSections={editSections}
              onChange={setEditSections}
              compact
            />

            {sectionError && (
              <p className="mt-3 text-sm text-[var(--error)]">{sectionError}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSectionEditor(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--secondary-light)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveSections()}
                disabled={savingSections}
                className="rounded-lg bg-[#c9784e] px-4 py-2 text-sm font-medium text-white hover:bg-[#b5673f] disabled:opacity-50"
              >
                {savingSections ? "Saving..." : "Save Sections"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
