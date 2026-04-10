"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CropEditor from "@/components/crop-editor";
import SectionEditor, { type SectionDefinition } from "@/components/section-editor";
import type { Question, ExamPage, QuestionBoundary, PageImage } from "@/types/exam";

interface ExamData {
  id: string;
  title: string;
  timeLimitMinutes: number;
  questionCount: number;
  correctMarks: number;
  wrongMarks: number;
  unansweredMarks: number;
  userId: string;
  user: { id: string; email: string };
  questions: Question[];
  pages: ExamPage[];
}

export default function EditExamPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [exam, setExam] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Crop editing state
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [croppingQuestions, setCroppingQuestions] = useState<Set<number>>(new Set());
  const [questionImageUrls, setQuestionImageUrls] = useState<Record<number, string>>({});

  // Page images for crop editor (loaded on demand)
  const [pageImages, setPageImages] = useState<Record<number, PageImage>>({});
  const [loadingPage, setLoadingPage] = useState<number | null>(null);

  // Section editing state
  const [sections, setSections] = useState<SectionDefinition[]>([]);

  // Exam details editing state
  const [editTitle, setEditTitle] = useState("");
  const [editTimeLimitMinutes, setEditTimeLimitMinutes] = useState(60);
  const [editCorrectMarks, setEditCorrectMarks] = useState(4);
  const [editWrongMarks, setEditWrongMarks] = useState(-1);
  const [editUnansweredMarks, setEditUnansweredMarks] = useState(0);

  // Local crop overrides (before saving)
  const [cropOverrides, setCropOverrides] = useState<
    Record<number, { cropX: number; cropY: number; cropW: number; cropH: number }>
  >({});

  // Fetch exam data
  useEffect(() => {
    async function fetchExam() {
      try {
        const response = await fetch(`/api/exams/${params.id}`);
        if (!response.ok) {
          throw new Error("Exam not found or not authorized");
        }
        const data = (await response.json()) as { exam: ExamData };
        setExam(data.exam);

        // Initialize editable fields
        setEditTitle(data.exam.title);
        setEditTimeLimitMinutes(data.exam.timeLimitMinutes);
        setEditCorrectMarks(data.exam.correctMarks ?? 4);
        setEditWrongMarks(data.exam.wrongMarks ?? -1);
        setEditUnansweredMarks(data.exam.unansweredMarks ?? 0);

        // Build initial sections from question data
        const sectionMap = new Map<string, { min: number; max: number }>();
        for (const q of data.exam.questions) {
          if (!q.section) continue;
          const existing = sectionMap.get(q.section);
          if (existing) {
            existing.min = Math.min(existing.min, q.questionNumber);
            existing.max = Math.max(existing.max, q.questionNumber);
          } else {
            sectionMap.set(q.section, { min: q.questionNumber, max: q.questionNumber });
          }
        }
        const initialSections: SectionDefinition[] = [];
        for (const [name, range] of sectionMap) {
          initialSections.push({
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            fromQuestion: range.min,
            toQuestion: range.max,
          });
        }
        setSections(initialSections);

        // Fetch signed URLs for question images
        const urlResponse = await fetch(`/api/exams/${params.id}/image-urls`);
        if (urlResponse.ok) {
          const urlData = (await urlResponse.json()) as { questionUrls: Record<number, string> };
          setQuestionImageUrls(urlData.questionUrls);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exam");
      } finally {
        setLoading(false);
      }
    }

    void fetchExam();
  }, [params.id]);

  // Load a page image from Supabase for the crop editor
  const loadPageImage = useCallback(
    async (pageNumber: number): Promise<PageImage | null> => {
      if (pageImages[pageNumber]) return pageImages[pageNumber];
      if (!exam) return null;

      const page = exam.pages.find((p) => p.pageNumber === pageNumber);
      if (!page) return null;

      setLoadingPage(pageNumber);
      try {
        const response = await fetch(`/api/exams/${exam.id}/page-image/${pageNumber}`);
        if (!response.ok) throw new Error("Failed to load page image");

        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const pageImage: PageImage = {
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          dataUrl,
        };

        setPageImages((prev) => ({ ...prev, [pageNumber]: pageImage }));
        return pageImage;
      } catch {
        setError("Failed to load page image for cropping");
        return null;
      } finally {
        setLoadingPage(null);
      }
    },
    [exam, pageImages],
  );

  // Open crop editor for a question
  const handleEditCrop = useCallback(
    async (questionNumber: number) => {
      if (!exam) return;
      const question = exam.questions.find((q) => q.questionNumber === questionNumber);
      if (!question) return;

      const pageImage = await loadPageImage(question.pageNumber);
      if (pageImage) {
        setEditingQuestion(questionNumber);
      }
    },
    [exam, loadPageImage],
  );

  // Handle crop save from the CropEditor
  const handleCropSave = useCallback(
    (updatedBoundary: QuestionBoundary) => {
      const qNum = updatedBoundary.questionNumber;
      setEditingQuestion(null);

      setCropOverrides((prev) => ({
        ...prev,
        [qNum]: {
          cropX: updatedBoundary.xStartFraction,
          cropY: updatedBoundary.yStartFraction,
          cropW: updatedBoundary.xEndFraction - updatedBoundary.xStartFraction,
          cropH: updatedBoundary.yEndFraction - updatedBoundary.yStartFraction,
        },
      }));
    },
    [],
  );

  // Save all changes
  const handleSave = async () => {
    if (!exam) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const recropEntries = Object.entries(cropOverrides).map(([qNum, crop]) => ({
        questionNumber: parseInt(qNum, 10),
        ...crop,
      }));

      const response = await fetch(`/api/exams/${exam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          timeLimitMinutes: editTimeLimitMinutes,
          correctMarks: editCorrectMarks,
          wrongMarks: editWrongMarks,
          unansweredMarks: editUnansweredMarks,
          sections: sections
            .filter((s) => s.name.trim())
            .map((s) => ({
              name: s.name.trim(),
              fromQuestion: s.fromQuestion,
              toQuestion: s.toQuestion,
            })),
          ...(recropEntries.length > 0 && { recrop: recropEntries }),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save changes");
      }

      // Refresh exam data
      const refreshResponse = await fetch(`/api/exams/${exam.id}`);
      if (refreshResponse.ok) {
        const refreshData = (await refreshResponse.json()) as { exam: ExamData };
        setExam(refreshData.exam);
        setEditTitle(refreshData.exam.title);
        setEditTimeLimitMinutes(refreshData.exam.timeLimitMinutes);
        setEditCorrectMarks(refreshData.exam.correctMarks ?? 4);
        setEditWrongMarks(refreshData.exam.wrongMarks ?? -1);
        setEditUnansweredMarks(refreshData.exam.unansweredMarks ?? 0);
      }

      // Refresh image URLs if we re-cropped
      if (recropEntries.length > 0) {
        const urlResponse = await fetch(`/api/exams/${exam.id}/image-urls`);
        if (urlResponse.ok) {
          const urlData = (await urlResponse.json()) as { questionUrls: Record<number, string> };
          setQuestionImageUrls(urlData.questionUrls);
        }
      }

      setCropOverrides({});
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Build boundary for crop editor from question data + any local overrides
  const getEditBoundary = (question: Question): QuestionBoundary => {
    const override = cropOverrides[question.questionNumber];
    if (override) {
      return {
        pageNumber: question.pageNumber,
        questionNumber: question.questionNumber,
        xStartFraction: override.cropX,
        xEndFraction: override.cropX + override.cropW,
        yStartFraction: override.cropY,
        yEndFraction: override.cropY + override.cropH,
      };
    }
    // Use stored crop if available, else default to full page
    if (question.cropX != null && question.cropY != null && question.cropW != null && question.cropH != null) {
      return {
        pageNumber: question.pageNumber,
        questionNumber: question.questionNumber,
        xStartFraction: question.cropX,
        xEndFraction: question.cropX + question.cropW,
        yStartFraction: question.cropY,
        yEndFraction: question.cropY + question.cropH,
      };
    }
    return {
      pageNumber: question.pageNumber,
      questionNumber: question.questionNumber,
      xStartFraction: 0,
      xEndFraction: 1,
      yStartFraction: 0,
      yEndFraction: 1,
    };
  };

  // Current editing state for crop editor
  const editingQ = editingQuestion !== null
    ? exam?.questions.find((q) => q.questionNumber === editingQuestion) ?? null
    : null;
  const editingBoundary = editingQ ? getEditBoundary(editingQ) : null;
  const editingPageImage = editingQ ? pageImages[editingQ.pageNumber] ?? null : null;

  const hasChanges = Object.keys(cropOverrides).length > 0
    || (exam && editTitle !== exam.title)
    || (exam && editTimeLimitMinutes !== exam.timeLimitMinutes)
    || (exam && editCorrectMarks !== (exam.correctMarks ?? 4))
    || (exam && editWrongMarks !== (exam.wrongMarks ?? -1))
    || (exam && editUnansweredMarks !== (exam.unansweredMarks ?? 0));
  const hasPages = exam && exam.pages.length > 0;

  if (loading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading exam...
        </div>
      </main>
    );
  }

  if (error && !exam) {
    return (
      <main className="space-y-4">
        <div className="rounded-xl border border-[var(--error-light)] bg-[var(--error-light)] p-4 text-[var(--error)]">
          {error}
        </div>
        <Link href="/dashboard" className="text-sm text-[var(--primary)] hover:underline">
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  if (!exam) return null;

  return (
    <main className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Edit Exam</h1>
          <p className="mt-1 text-[var(--muted)]">{editTitle || exam.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ← Back
          </Link>
          <button
            onClick={() => void handleSave()}
            disabled={saving || (!hasChanges && sections.length === 0)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#c9784e] px-5 py-2.5 font-medium text-white shadow-sm hover:bg-[#b5673f] disabled:opacity-50"
          >
            {saving ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </header>

      {/* Success / Error messages */}
      {saveSuccess && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          Changes saved successfully!
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[var(--error-light)] bg-[var(--error-light)] p-4 text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Exam Details */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Exam Details</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Exam Title</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              placeholder="e.g., Biology Chapter 5 Quiz"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Time Limit (minutes)</label>
            <input
              type="number"
              min={1}
              max={300}
              value={editTimeLimitMinutes}
              onChange={(e) => setEditTimeLimitMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
            />
          </div>
        </div>

        {/* Scoring System */}
        <div className="mt-5">
          <h3 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Scoring System</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Correct Answer Marks</label>
              <input
                type="number"
                step="0.25"
                min={0}
                value={editCorrectMarks}
                onChange={(e) => setEditCorrectMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Wrong Answer Marks</label>
              <input
                type="number"
                step="0.25"
                max={0}
                value={editWrongMarks}
                onChange={(e) => setEditWrongMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Unanswered Marks</label>
              <input
                type="number"
                step="0.25"
                value={editUnansweredMarks}
                onChange={(e) => setEditUnansweredMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Current: +{editCorrectMarks} correct, {editWrongMarks} wrong, {editUnansweredMarks} unanswered
          </p>
        </div>
      </section>

      {/* Sections Editor */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">Sections</h2>
        <SectionEditor
          totalQuestions={exam.questionCount}
          initialSections={sections}
          onChange={setSections}
          compact
        />
      </section>

      {/* Questions Grid - Crop Editing */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Questions ({exam.questions.length})
          </h2>
          {!hasPages && (
            <p className="text-sm text-[var(--muted)]">
              No page images stored — cropping not available for this exam
            </p>
          )}
          {hasChanges && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              {Object.keys(cropOverrides).length} crop change{Object.keys(cropOverrides).length > 1 ? "s" : ""} unsaved
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {exam.questions.map((question) => {
            const isCropping = croppingQuestions.has(question.questionNumber);
            const hasCropOverride = cropOverrides[question.questionNumber] !== undefined;
            const imageUrl = questionImageUrls[question.questionNumber];

            return (
              <div
                key={question.id}
                className={`group relative rounded-xl border bg-white p-2 shadow-sm transition-all ${
                  hasCropOverride
                    ? "border-amber-300 ring-2 ring-amber-100"
                    : "border-[var(--border)] hover:border-[var(--border-hover)] hover:shadow-md"
                }`}
              >
                {/* Question number badge */}
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    Q{question.questionNumber}
                  </span>
                  {question.section && (
                    <span className="truncate text-[10px] text-[var(--muted)]">
                      {question.section}
                    </span>
                  )}
                </div>

                {/* Question image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--secondary-light)]">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={`Question ${question.questionNumber}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                      No preview
                    </div>
                  )}

                  {isCropping && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                      <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Edit crop button */}
                {hasPages && (
                  <button
                    onClick={() => void handleEditCrop(question.questionNumber)}
                    disabled={isCropping || loadingPage !== null}
                    className="mt-1.5 w-full rounded-lg bg-[var(--secondary-light)] px-2 py-1 text-[11px] font-medium text-[var(--muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors disabled:opacity-50"
                  >
                    {loadingPage === question.pageNumber ? "Loading..." : hasCropOverride ? "Re-crop ✓" : "Edit Crop"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Crop Editor Modal */}
      {editingQuestion !== null && editingBoundary && editingPageImage && (
        <CropEditor
          pageImage={editingPageImage}
          boundary={editingBoundary}
          onSave={handleCropSave}
          onCancel={() => setEditingQuestion(null)}
        />
      )}
    </main>
  );
}
