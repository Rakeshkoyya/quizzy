"use client";

import type { AnswerOption, QuestionBoundary, PageImage, PageAnalysisResult } from "@/types/exam";
import { renderPdfPages, dataUrlToBlob } from "@/lib/pdf-processor";
import { parseQuestionsText, parseAnswerKeyText, type ParsedTextQuestion } from "@/lib/exam";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useCallback } from "react";
import CropEditor from "@/components/crop-editor";
import SectionEditor, { type SectionDefinition } from "@/components/section-editor";

type ParsedAnswerKey = Record<string, AnswerOption>;
type ImportMode = "pdf" | "text";

interface ProcessedQuestion {
  questionNumber: number;
  previewUrl: string;
  subject?: string;
  section?: string;
}

const PARALLEL_BATCH_SIZE = 10;

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [correctMarks, setCorrectMarks] = useState(4);
  const [wrongMarks, setWrongMarks] = useState(-1);
  const [unansweredMarks, setUnansweredMarks] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Crop editing state
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [croppingQuestions, setCroppingQuestions] = useState<Set<number>>(new Set());

  // Questions PDF state
  const [questionPages, setQuestionPages] = useState<PageImage[]>([]);
  const [boundaries, setBoundaries] = useState<QuestionBoundary[]>([]);
  const [processingQuestions, setProcessingQuestions] = useState(false);
  const [questionProgress, setQuestionProgress] = useState("");
  const [processedQuestions, setProcessedQuestions] = useState<ProcessedQuestion[]>([]);
  const [tempExamId, setTempExamId] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  // Page analysis state
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [totalPageCount, setTotalPageCount] = useState(0);
  const [pageAnalyses, setPageAnalyses] = useState<PageAnalysisResult[]>([]);

  // Solutions state
  const [solutionsDetected, setSolutionsDetected] = useState(false);
  const [extractedSolutions, setExtractedSolutions] = useState<Record<string, string>>({});
  const [solutionPageNumbers, setSolutionPageNumbers] = useState<number[]>([]);

  // Answer key state
  const [answerKeyText, setAnswerKeyText] = useState("{}");
  const [parsingAnswer, setParsingAnswer] = useState(false);
  const [answerFileName, setAnswerFileName] = useState<string | null>(null);

  const parsedAnswerCount = useMemo(() => {
    try {
      const parsed = JSON.parse(answerKeyText) as Record<string, string>;
      return Object.keys(parsed).length;
    } catch {
      return 0;
    }
  }, [answerKeyText]);

  // Manual sections state
  const [manualSections, setManualSections] = useState<SectionDefinition[]>([]);

  // Import mode state
  const [importMode, setImportMode] = useState<ImportMode>("pdf");

  // Text import state
  const [questionsTextInput, setQuestionsTextInput] = useState("");
  const [answerKeyTextInput, setAnswerKeyTextInput] = useState("");
  const [parsedTextQuestions, setParsedTextQuestions] = useState<ParsedTextQuestion[]>([]);

  const textQuestionsReady = parsedTextQuestions.length > 0;

  const textAnswerKey = useMemo(() => {
    return parseAnswerKeyText(answerKeyTextInput);
  }, [answerKeyTextInput]);

  const textAnswerCount = Object.keys(textAnswerKey).length;

  const questionsReady = importMode === "pdf" ? processedQuestions.length > 0 : textQuestionsReady;
  const effectiveAnswerCount = importMode === "pdf" ? parsedAnswerCount : textAnswerCount;
  const canCreate = title && questionsReady && effectiveAnswerCount > 0;

  // ── Analyze a single page via API ──
  const analyzePage = useCallback(async (page: PageImage): Promise<PageAnalysisResult> => {
    const formData = new FormData();
    const blob = dataUrlToBlob(page.dataUrl);
    formData.append("page", blob, `page-${page.pageNumber}.png`);
    formData.append("pageNumber", String(page.pageNumber));

    const response = await fetch("/api/analyze-page", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as {
      analysis?: PageAnalysisResult;
      error?: string;
    };

    if (!response.ok || !payload.analysis) {
      throw new Error(payload.error ?? `Failed to analyze page ${page.pageNumber}`);
    }

    return payload.analysis;
  }, []);

  // ── Process pages in parallel batches of PARALLEL_BATCH_SIZE ──
  const analyzeAllPages = useCallback(async (pages: PageImage[]): Promise<PageAnalysisResult[]> => {
    const results: PageAnalysisResult[] = [];
    let completed = 0;

    for (let i = 0; i < pages.length; i += PARALLEL_BATCH_SIZE) {
      const batch = pages.slice(i, i + PARALLEL_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (page) => {
          const result = await analyzePage(page);
          completed++;
          setAnalyzedCount(completed);
          setQuestionProgress(
            `Analyzing pages... ${completed}/${pages.length} (batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(pages.length / PARALLEL_BATCH_SIZE)})`,
          );
          return result;
        }),
      );
      results.push(...batchResults);
    }

    return results;
  }, [analyzePage]);

  // ── Step 1: Process Questions PDF ──
  async function handleQuestionsPdf(file: File) {
    setError(null);
    setProcessingQuestions(true);
    setProcessedQuestions([]);
    setQuestionPages([]);
    setBoundaries([]);
    setTempExamId(null);
    setPageAnalyses([]);
    setSolutionsDetected(false);
    setExtractedSolutions({});
    setSolutionPageNumbers([]);
    setAnswerKeyText("{}");
    setAnswerFileName(null);
    setAnalyzedCount(0);
    setTotalPageCount(0);

    try {
      // Step 1: Render all pages from PDF
      setQuestionProgress("Rendering PDF pages...");
      const allPages = await renderPdfPages(file, (current, total) => {
        setQuestionProgress(`Rendering page ${current} of ${total}...`);
      });
      setQuestionPages(allPages);
      setTotalPageCount(allPages.length);

      // Step 2: Analyze all pages in parallel batches of 10
      setQuestionProgress(`Analyzing ${allPages.length} pages with AI (${PARALLEL_BATCH_SIZE} at a time)...`);
      const analyses = await analyzeAllPages(allPages);
      setPageAnalyses(analyses);

      // Step 3: Aggregate results
      const allBoundaries: QuestionBoundary[] = [];
      const allSolutions: Record<string, string> = {};
      const solPages: number[] = [];

      for (const analysis of analyses) {
        // Collect questions
        if (analysis.questions.length > 0) {
          allBoundaries.push(...analysis.questions);
        }

        // Collect solutions
        if (analysis.solutions && Object.keys(analysis.solutions).length > 0) {
          Object.assign(allSolutions, analysis.solutions);
          solPages.push(analysis.pageNumber);
        }
      }

      if (allBoundaries.length === 0) {
        throw new Error(
          "No questions detected in the PDF. Make sure questions are numbered (e.g., 1., 2., etc.)",
        );
      }

      // De-duplicate boundaries by question number (keep first occurrence)
      const seenQNums = new Set<number>();
      const uniqueBoundaries = allBoundaries.filter((b) => {
        if (seenQNums.has(b.questionNumber)) return false;
        seenQNums.add(b.questionNumber);
        return true;
      });
      uniqueBoundaries.sort((a, b) => a.questionNumber - b.questionNumber);

      setBoundaries(uniqueBoundaries);
      setSolutionPageNumbers(solPages);

      // Handle solutions
      const hasSolutions = Object.keys(allSolutions).length > 0;
      setSolutionsDetected(hasSolutions);
      setExtractedSolutions(allSolutions);
      if (hasSolutions) {
        setAnswerKeyText(JSON.stringify(allSolutions, null, 2));
        setAnswerFileName("Extracted from PDF (solutions detected)");
      }

      const introPages = analyses.filter((a) => a.pageType === "introduction").length;
      const questionPageCount = analyses.filter((a) => a.pageType === "questions").length;
      const solutionPageCount = analyses.filter((a) => a.pageType === "questions_with_solutions").length;

      setQuestionProgress(
        `Found ${uniqueBoundaries.length} questions across ${allPages.length} pages ` +
        `(${introPages} intro, ${questionPageCount} question, ${solutionPageCount} with solutions). Cropping...`,
      );

      // Step 4: Crop questions for preview
      const neededPageNums = [...new Set(uniqueBoundaries.map((b) => b.pageNumber))];
      const newTempId = `temp-${Date.now()}`;
      setTempExamId(newTempId);
      const allProcessed: ProcessedQuestion[] = [];

      for (const pageNum of neededPageNums) {
        const page = allPages.find((p) => p.pageNumber === pageNum);
        if (!page) continue;

        const pageBoundaries = uniqueBoundaries.filter((b) => b.pageNumber === pageNum);
        const formData = new FormData();
        formData.append("examId", newTempId);
        formData.append("boundaries", JSON.stringify(pageBoundaries));

        const blob = dataUrlToBlob(page.dataUrl);
        formData.append(`page-${pageNum}`, blob, `page-${pageNum}.png`);

        const response = await fetch("/api/process-questions", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as {
          questions?: Array<{ questionNumber: number; previewUrl: string }>;
          error?: string;
        };

        if (!response.ok || !payload.questions) {
          throw new Error(payload.error ?? `Failed to process page ${pageNum}`);
        }

        // Attach subject/section info from boundaries
        for (const q of payload.questions) {
          const boundary = uniqueBoundaries.find((b) => b.questionNumber === q.questionNumber);
          allProcessed.push({
            ...q,
            subject: boundary?.subject,
            section: boundary?.section,
          });
        }

        setQuestionProgress(
          `Cropped ${allProcessed.length} of ${uniqueBoundaries.length} questions...`,
        );
      }

      setProcessedQuestions(allProcessed);
      setQuestionProgress(
        `${allProcessed.length} questions processed` +
        (hasSolutions ? ` — solutions auto-extracted (${Object.keys(allSolutions).length} answers)` : " — review below"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process PDF");
      setQuestionProgress("");
    } finally {
      setProcessingQuestions(false);
    }
  }

  // ── Save adjusted crop for a single question ──
  async function handleCropSave(updatedBoundary: QuestionBoundary) {
    const qNum = updatedBoundary.questionNumber;
    setEditingQuestion(null);
    setCroppingQuestions((prev) => new Set(prev).add(qNum));
    setError(null);

    try {
      // Update boundaries state
      setBoundaries((prev) =>
        prev.map((b) => (b.questionNumber === qNum ? updatedBoundary : b)),
      );

      // Re-crop this single question
      const page = questionPages.find((p) => p.pageNumber === updatedBoundary.pageNumber);
      if (!page || !tempExamId) throw new Error("Missing page data");

      const formData = new FormData();
      formData.append("examId", tempExamId);
      formData.append("boundaries", JSON.stringify([updatedBoundary]));

      const blob = dataUrlToBlob(page.dataUrl);
      formData.append(
        `page-${updatedBoundary.pageNumber}`,
        blob,
        `page-${updatedBoundary.pageNumber}.png`,
      );

      const response = await fetch("/api/process-questions", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        questions?: Array<{ questionNumber: number; previewUrl: string }>;
        error?: string;
      };

      if (!response.ok || !payload.questions) {
        throw new Error(payload.error ?? "Failed to re-crop question");
      }

      const newPreview = payload.questions.find((q) => q.questionNumber === qNum);
      if (newPreview) {
        setProcessedQuestions((prev) =>
          prev.map((q) =>
            q.questionNumber === qNum ? { ...q, previewUrl: newPreview.previewUrl } : q,
          ),
        );
        setPreviewRevision((r) => r + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-crop question");
    } finally {
      setCroppingQuestions((prev) => {
        const next = new Set(prev);
        next.delete(qNum);
        return next;
      });
    }
  }

  // ── Step 2: Parse Answer Key Image ──
  async function handleAnswerKeyUpload(file: File) {
    setError(null);
    setParsingAnswer(true);
    setAnswerFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-answer-key", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        answerKey?: ParsedAnswerKey;
        error?: string;
      };

      if (!response.ok || !payload.answerKey) {
        throw new Error(payload.error ?? "Failed to parse answer key");
      }

      setAnswerKeyText(JSON.stringify(payload.answerKey, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse answer key");
      setAnswerFileName(null);
    } finally {
      setParsingAnswer(false);
    }
  }

  // ── Text Import: Parse questions text ──
  function handleParseQuestionsText(text: string) {
    setQuestionsTextInput(text);
    const parsed = parseQuestionsText(text);
    setParsedTextQuestions(parsed);
  }

  // ── Text Import: Upload questions text file ──
  function handleQuestionsTextFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleParseQuestionsText(text);
    };
    reader.readAsText(file);
  }

  // ── Text Import: Upload answer key text file ──
  function handleAnswerKeyTextFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setAnswerKeyTextInput(text);
    };
    reader.readAsText(file);
  }

  // ── Step 3: Create Exam (finalize upload + create) ──
  async function createExam(startAfterCreate = false) {
    setSaving(true);
    setError(null);

    try {
      if (importMode === "text") {
        // ── Text-based exam creation (no image upload needed) ──
        const answerKeyObj: ParsedAnswerKey = {};
        for (const [k, v] of Object.entries(textAnswerKey)) {
          answerKeyObj[String(k)] = v;
        }

        const examResponse = await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            timeLimitMinutes,
            answerKey: answerKeyObj,
            questionType: "text",
            correctMarks,
            wrongMarks,
            unansweredMarks,
            questions: parsedTextQuestions.map((q) => ({
              questionNumber: q.questionNumber,
              questionText: q.questionText,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
            })),
          }),
        });

        const examPayload = (await examResponse.json()) as { exam?: { id: string }; error?: string };
        if (!examResponse.ok || !examPayload.exam) {
          throw new Error(examPayload.error ?? "Failed to create exam");
        }

        if (startAfterCreate) {
          router.push(`/exams/${examPayload.exam.id}/attempt`);
        } else {
          router.push("/dashboard");
        }
      } else {
        // ── Image-based exam creation (existing PDF flow) ──
        const answerKey = JSON.parse(answerKeyText) as ParsedAnswerKey;

        // First upload temp files to Supabase to get real storage paths
        const uploadResponse = await fetch("/api/finalize-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempExamId,
            questions: processedQuestions,
            solutionPages: solutionPageNumbers,
            pageImages: questionPages.map((p) => ({
              pageNumber: p.pageNumber,
              width: p.width,
              height: p.height,
            })),
            boundaries: boundaries.map((b) => ({
              questionNumber: b.questionNumber,
              pageNumber: b.pageNumber,
              xStartFraction: b.xStartFraction,
              xEndFraction: b.xEndFraction,
              yStartFraction: b.yStartFraction,
              yEndFraction: b.yEndFraction,
            })),
          }),
        });

        const uploadPayload = (await uploadResponse.json()) as {
          questions?: Array<{ questionNumber: number; imagePath: string; subject?: string; section?: string }>;
          pages?: Array<{ pageNumber: number; imagePath: string; width: number; height: number }>;
          cropData?: Array<{ questionNumber: number; cropX: number; cropY: number; cropW: number; cropH: number }>;
          error?: string;
        };

        if (!uploadResponse.ok || !uploadPayload.questions) {
          throw new Error(uploadPayload.error ?? "Failed to upload images");
        }

        // Now create the exam with real image paths
        // Apply manual sections to questions
        const getSectionForQuestion = (qNum: number): string | undefined => {
          for (const sec of manualSections) {
            if (sec.name && qNum >= sec.fromQuestion && qNum <= sec.toQuestion) {
              return sec.name;
            }
          }
          return undefined;
        };

        const examResponse = await fetch("/api/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            timeLimitMinutes,
            answerKey,
            questionType: "image",
            correctMarks,
            wrongMarks,
            unansweredMarks,
            solutionsJson: solutionsDetected ? extractedSolutions : undefined,
            questions: uploadPayload.questions.map((q) => {
              const crop = uploadPayload.cropData?.find((c) => c.questionNumber === q.questionNumber);
              return {
                questionNumber: q.questionNumber,
                imagePath: q.imagePath,
                pageNumber: boundaries.find((b) => b.questionNumber === q.questionNumber)?.pageNumber ?? 1,
                section: getSectionForQuestion(q.questionNumber),
                cropX: crop?.cropX,
                cropY: crop?.cropY,
                cropW: crop?.cropW,
                cropH: crop?.cropH,
              };
            }),
            pages: uploadPayload.pages,
          }),
        });

        const examPayload = (await examResponse.json()) as { exam?: { id: string }; error?: string };
        if (!examResponse.ok || !examPayload.exam) {
          throw new Error(examPayload.error ?? "Failed to create exam");
        }

        if (startAfterCreate) {
          router.push(`/exams/${examPayload.exam.id}/attempt`);
        } else {
          router.push("/dashboard");
        }
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create exam");
      setSaving(false);
    }
  }

  // Computed values for crop editor modal
  const editingBoundary = editingQuestion !== null
    ? boundaries.find((b) => b.questionNumber === editingQuestion) ?? null
    : null;
  const editingPageImage = editingBoundary
    ? questionPages.find((p) => p.pageNumber === editingBoundary.pageNumber) ?? null
    : null;

  return (
    <main className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Create New Exam</h1>
          <p className="mt-1 text-[var(--muted)]">Upload questions as PDF or paste text to get started</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to dashboard
        </Link>
      </header>

      {/* Import Mode Toggle */}
      <div className="flex gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5">
        <button
          type="button"
          onClick={() => setImportMode("pdf")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            importMode === "pdf"
              ? "bg-[#c9784e] text-white shadow-sm"
              : "text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PDF Upload
          </span>
        </button>
        <button
          type="button"
          onClick={() => setImportMode("text")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
            importMode === "text"
              ? "bg-[#c9784e] text-white shadow-sm"
              : "text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Text Import
          </span>
        </button>
      </div>

      {/* ── PDF MODE ── */}
      {importMode === "pdf" && (
        <>
      {/* Step 1: Upload Questions PDF */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${questionsReady ? "bg-[var(--success)] text-white" : "bg-[#c9784e] text-white"}`}>
            1
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Upload Questions PDF</h2>
          {questionsReady && (
            <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-sm font-medium text-[var(--success)]">
              {processedQuestions.length} questions detected
            </span>
          )}
        </div>

        {/* Upload area */}
        <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary-light)] p-8 text-center">
          {processingQuestions ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="h-8 w-8 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-[var(--muted)]">{questionProgress}</p>
              {/* Page analysis progress bar */}
              {totalPageCount > 0 && analyzedCount < totalPageCount && (
                <div className="w-full max-w-md">
                  <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                    <span>Pages analyzed</span>
                    <span>{analyzedCount} / {totalPageCount}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full bg-[#c9784e] transition-all duration-300"
                      style={{ width: `${(analyzedCount / totalPageCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : questionsReady ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
                <svg className="h-6 w-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-[var(--foreground)]">{questionProgress}</p>
              <label className="cursor-pointer text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Upload different PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleQuestionsPdf(file);
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-light)]">
                <svg className="h-6 w-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="font-medium text-[var(--primary)]">Click to upload</span>
                <span className="text-[var(--muted)]"> your questions PDF</span>
              </div>
              <p className="text-sm text-[var(--muted)]">
                PDF with numbered questions (e.g., 1., 2., 3.) — supports text and diagrams
              </p>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleQuestionsPdf(file);
                }}
              />
            </label>
          )}
        </div>

        {/* Question Preview */}
        {questionsReady && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-[var(--muted)]">
              Preview ({processedQuestions.length} questions):
            </p>

            {/* Manual Section Editor */}
            <div className="mb-3">
              <SectionEditor
                totalQuestions={processedQuestions.length}
                initialSections={manualSections}
                onChange={setManualSections}
              />
            </div>

            {/* Solutions detected banner */}
            {solutionsDetected && (
              <div className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--success-light)] px-4 py-2">
                <svg className="h-5 w-5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium text-[var(--success)]">
                  Solutions detected in PDF — {Object.keys(extractedSolutions).length} answers auto-extracted. Answer key upload skipped.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {processedQuestions.map((q) => {
                const isCropping = croppingQuestions.has(q.questionNumber);
                return (
                  <div
                    key={q.questionNumber}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <p className="text-xs font-semibold text-[var(--primary)]">Q{q.questionNumber}</p>
                      {manualSections.find((s) => q.questionNumber >= s.fromQuestion && q.questionNumber <= s.toQuestion && s.name) && (
                        <span className="rounded bg-[var(--secondary-light)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                          {manualSections.find((s) => q.questionNumber >= s.fromQuestion && q.questionNumber <= s.toQuestion)?.name}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingQuestion(q.questionNumber)}
                        disabled={isCropping}
                        className="ml-auto rounded px-2 py-0.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                      >
                        {isCropping ? "Saving..." : "Adjust"}
                      </button>
                    </div>
                    {isCropping ? (
                      <div className="flex h-32 items-center justify-center rounded bg-white">
                        <svg className="h-6 w-6 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`${q.previewUrl}?v=${previewRevision}`}
                        alt={`Question ${q.questionNumber}`}
                        className="w-full rounded bg-white"
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Upload Answer Key */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
            parsedAnswerCount > 0
              ? "bg-[var(--success)] text-white"
              : solutionsDetected
                ? "bg-[var(--success)] text-white"
                : questionsReady
                  ? "bg-[#c9784e] text-white"
                  : "bg-[#f5efe8] text-[#9a8b7a]"
          }`}>
            2
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {solutionsDetected ? "Answer Key (Auto-Extracted)" : "Upload Answer Key Image"}
          </h2>
          {parsedAnswerCount > 0 && (
            <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-sm font-medium text-[var(--success)]">
              {parsedAnswerCount} answers {solutionsDetected ? "from PDF" : "detected"}
            </span>
          )}
        </div>

        {/* If solutions detected, show extracted info instead of upload */}
        {solutionsDetected ? (
          <div className="rounded-xl border border-[var(--success)] bg-[var(--success-light)] p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-medium text-[var(--foreground)]">
                Solutions detected in {solutionPageNumbers.length} page(s) of the PDF
              </p>
              <p className="text-sm text-[var(--muted)]">
                {Object.keys(extractedSolutions).length} answers were automatically extracted. You can review and edit them below.
              </p>
              <button
                type="button"
                className="text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
                onClick={() => {
                  setSolutionsDetected(false);
                  setAnswerKeyText("{}");
                  setAnswerFileName(null);
                  setExtractedSolutions({});
                }}
              >
                Override — upload different answer key instead
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary-light)] p-8 text-center">
            {parsingAnswer ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="h-8 w-8 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-[var(--muted)]">Parsing answer key with AI...</p>
            </div>
          ) : answerFileName ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
                <svg className="h-6 w-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-[var(--foreground)]">{answerFileName}</p>
              <label className="cursor-pointer text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Upload different image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleAnswerKeyUpload(file);
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-light)]">
                <svg className="h-6 w-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="font-medium text-[var(--primary)]">Click to upload</span>
                <span className="text-[var(--muted)]"> your answer key image</span>
              </div>
              <p className="text-sm text-[var(--muted)]">PNG, JPG up to 10MB</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAnswerKeyUpload(file);
                }}
              />
            </label>
          )}
          </div>
        )}

        {/* Answer Key Review */}
        {parsedAnswerCount > 0 && (
          <div className="mt-4">
            <textarea
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              placeholder='{"1": "A", "2": "B", "3": "C", ...}'
            />
            <p className="mt-2 text-sm text-[var(--muted)]">
              Edit the JSON if needed. Format: question number → correct answer (A/B/C/D)
            </p>
          </div>
        )}
      </section>
        </>
      )}

      {/* ── TEXT MODE ── */}
      {importMode === "text" && (
        <>
          {/* Step 1: Questions Text Input */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${textQuestionsReady ? "bg-[var(--success)] text-white" : "bg-[#c9784e] text-white"}`}>
                1
              </div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Questions (Text)</h2>
              {textQuestionsReady && (
                <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-sm font-medium text-[var(--success)]">
                  {parsedTextQuestions.length} questions parsed
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* Upload text file */}
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--secondary-light)]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload .txt file
                  <input
                    type="file"
                    accept=".txt,.text,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleQuestionsTextFile(file);
                    }}
                  />
                </label>
                <span className="text-sm text-[var(--muted)]">or paste below</span>
              </div>

              <textarea
                value={questionsTextInput}
                onChange={(e) => handleParseQuestionsText(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
                placeholder={`Paste your questions here. Format:\n\nQ1. Which period does the chapter focus on?\nA) Ancient Period\nB) Medieval Period\nC) Modern Period\nD) Prehistoric Period\n\nQ2. The Medieval Period spans:\nA) 100 CE to 700 CE\nB) 500 CE to 1200 CE\nC) 700 CE to 1800 CE\nD) 1800 CE to 1947 CE`}
              />
            </div>

            {/* Parsed Questions Preview */}
            {textQuestionsReady && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">
                  Preview ({parsedTextQuestions.length} questions):
                </p>
                <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  {parsedTextQuestions.map((q) => (
                    <div key={q.questionNumber} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
                      <p className="mb-2 text-sm font-semibold text-[var(--primary)]">
                        Q{q.questionNumber}. {q.questionText}
                      </p>
                      <div className="grid grid-cols-1 gap-1 text-sm text-[var(--foreground)] sm:grid-cols-2">
                        <p><span className="font-medium text-[var(--muted)]">A)</span> {q.optionA}</p>
                        <p><span className="font-medium text-[var(--muted)]">B)</span> {q.optionB}</p>
                        <p><span className="font-medium text-[var(--muted)]">C)</span> {q.optionC}</p>
                        <p><span className="font-medium text-[var(--muted)]">D)</span> {q.optionD}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Answer Key Text Input */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                textAnswerCount > 0
                  ? "bg-[var(--success)] text-white"
                  : textQuestionsReady
                    ? "bg-[#c9784e] text-white"
                    : "bg-[#f5efe8] text-[#9a8b7a]"
              }`}>
                2
              </div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Answer Key (Text)</h2>
              {textAnswerCount > 0 && (
                <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-sm font-medium text-[var(--success)]">
                  {textAnswerCount} answers parsed
                </span>
              )}
            </div>

            <div className="space-y-3">
              {/* Upload text file */}
              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--secondary-light)]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload .txt file
                  <input
                    type="file"
                    accept=".txt,.text,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAnswerKeyTextFile(file);
                    }}
                  />
                </label>
                <span className="text-sm text-[var(--muted)]">or paste below</span>
              </div>

              <textarea
                value={answerKeyTextInput}
                onChange={(e) => setAnswerKeyTextInput(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
                placeholder={`Paste your answer key here. Format:\n\n1. B\n2. C\n3. C\n4. D\n5. C`}
              />
            </div>

            {/* Parsed answers preview */}
            {textAnswerCount > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[var(--muted)]">Parsed answers:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(textAnswerKey)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([num, ans]) => (
                      <span
                        key={num}
                        className="inline-flex items-center gap-1 rounded-lg bg-[var(--secondary-light)] px-2.5 py-1 text-sm"
                      >
                        <span className="font-medium text-[var(--foreground)]">Q{num}</span>
                        <span className="font-semibold text-[var(--primary)]">{ans}</span>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Step 3: Exam Details */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${title ? "bg-[var(--success)] text-white" : effectiveAnswerCount > 0 ? "bg-[#c9784e] text-white" : "bg-[#f5efe8] text-[#9a8b7a]"}`}>
            3
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Exam Details</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Exam Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              placeholder="e.g., Biology Chapter 5 Quiz"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Time Limit (minutes)</label>
            <input
              type="number"
              min={1}
              max={300}
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
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
                value={correctMarks}
                onChange={(e) => setCorrectMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Wrong Answer Marks</label>
              <input
                type="number"
                step="0.25"
                max={0}
                value={wrongMarks}
                onChange={(e) => setWrongMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Unanswered Marks</label>
              <input
                type="number"
                step="0.25"
                value={unansweredMarks}
                onChange={(e) => setUnansweredMarks(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Default: +{correctMarks} correct, {wrongMarks} wrong, {unansweredMarks} unanswered
          </p>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-[var(--error-light)] px-4 py-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Create Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void createExam(false)}
          disabled={!canCreate || saving}
          className="flex-1 rounded-xl border border-[#e8ddd4] bg-white px-6 py-4 text-lg font-semibold text-[#3d3029] shadow-sm hover:border-[#c9784e] hover:bg-[#f9ebe4] hover:text-[#c9784e] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Create Exam
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => void createExam(true)}
          disabled={!canCreate || saving}
          className="flex-1 rounded-xl bg-[#c9784e] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Create & Start Exam
            </span>
          )}
        </button>
      </div>

      {/* Crop Editor Modal */}
      {editingBoundary && editingPageImage && (
        <CropEditor
          pageImage={editingPageImage}
          boundary={editingBoundary}
          onSave={(updated) => void handleCropSave(updated)}
          onCancel={() => setEditingQuestion(null)}
        />
      )}
    </main>
  );
}
