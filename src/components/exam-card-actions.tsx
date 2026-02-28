"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ExamCardActionsProps {
  examId: string;
  isPublic: boolean;
  isOwner: boolean;
}

export function ExamCardActions({ examId, isPublic, isOwner }: ExamCardActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentIsPublic, setCurrentIsPublic] = useState(isPublic);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <div className="flex items-center gap-2">
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
  );
}
