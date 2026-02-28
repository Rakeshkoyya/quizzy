"use client";

import { createClient } from "@/lib/supabase/client";
import type { AnswerOption } from "@/types/exam";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type ParsedAnswerKey = Record<string, AnswerOption>;

export default function NewExamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [imagePath, setImagePath] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerKeyText, setAnswerKeyText] = useState("{}");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const parsedAnswerCount = useMemo(() => {
    try {
      const parsed = JSON.parse(answerKeyText) as Record<string, string>;
      return Object.keys(parsed).length;
    } catch {
      return 0;
    }
  }, [answerKeyText]);

  async function handleUploadAndParse(file: File) {
    const supabase = createClient();
    setError(null);
    setParsing(true);
    setUploadedFileName(file.name);
    console.log("[Upload] Starting upload for file:", file.name);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      console.log("[Upload] Auth check:", { user: user?.id, authError });

      if (!user) {
        throw new Error("Please login first");
      }

      const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      console.log("[Upload] Uploading to path:", path);
      
      const upload = await supabase.storage.from("answer-keys").upload(path, file, {
        contentType: file.type || "image/png",
        upsert: false,
      });

      console.log("[Upload] Upload result:", { data: upload.data, error: upload.error });

      if (upload.error) {
        throw new Error(upload.error.message);
      }

      setImagePath(path);

      const signedUrlResponse = await supabase.storage.from("answer-keys").createSignedUrl(path, 10 * 60);
      console.log("[Upload] Signed URL result:", { data: signedUrlResponse.data, error: signedUrlResponse.error });
      
      if (signedUrlResponse.error || !signedUrlResponse.data?.signedUrl) {
        throw new Error(signedUrlResponse.error?.message ?? "Failed to create signed URL");
      }

      console.log("[Upload] Calling parse API...");
      const parseResponse = await fetch("/api/parse-answer-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: signedUrlResponse.data.signedUrl }),
      });

      const parsePayload = (await parseResponse.json()) as {
        answerKey?: ParsedAnswerKey;
        error?: string;
      };

      console.log("[Upload] Parse response:", { status: parseResponse.status, payload: parsePayload });

      if (!parseResponse.ok || !parsePayload.answerKey) {
        throw new Error(parsePayload.error ?? "Failed to parse answer key");
      }

      setAnswerKeyText(JSON.stringify(parsePayload.answerKey, null, 2));
      console.log("[Upload] Success! Answer key parsed.");
    } catch (uploadError) {
      console.error("[Upload] Error:", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Upload/parse failed");
      setUploadedFileName(null);
    } finally {
      setParsing(false);
    }
  }

  async function createExam(startAfterCreate: boolean = false) {
    setSaving(true);
    setError(null);

    try {
      const answerKey = JSON.parse(answerKeyText) as ParsedAnswerKey;

      const response = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, timeLimitMinutes, imagePath, answerKey }),
      });

      const payload = (await response.json()) as { exam?: { id: string }; error?: string };

      if (!response.ok || !payload.exam) {
        throw new Error(payload.error ?? "Failed to create exam");
      }

      if (startAfterCreate) {
        router.push(`/exams/${payload.exam.id}/attempt`);
      } else {
        router.push("/dashboard");
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create exam");
      setSaving(false);
    }
  }

  return (
    <main className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Create New Exam</h1>
          <p className="mt-1 text-[var(--muted)]">Upload an answer key image to get started</p>
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

      {/* Step 1: Upload */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c9784e] text-sm font-semibold text-white">
            1
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Upload Answer Key Image</h2>
        </div>

        <div className="rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--secondary-light)] p-8 text-center">
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="h-8 w-8 animate-spin text-[var(--primary)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-[var(--muted)]">Processing image...</p>
            </div>
          ) : uploadedFileName ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-light)]">
                <svg className="h-6 w-6 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-medium text-[var(--foreground)]">{uploadedFileName}</p>
              <label className="cursor-pointer text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]">
                Upload different image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUploadAndParse(file);
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
                <span className="text-[var(--muted)]"> or drag and drop</span>
              </div>
              <p className="text-sm text-[var(--muted)]">PNG, JPG up to 10MB</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUploadAndParse(file);
                }}
              />
            </label>
          )}
        </div>
      </section>

      {/* Step 2: Review Answers */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${parsedAnswerCount > 0 ? "bg-[#c9784e] text-white" : "bg-[#f5efe8] text-[#9a8b7a]"}`}>
            2
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Review Parsed Answers</h2>
          {parsedAnswerCount > 0 && (
            <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-sm font-medium text-[var(--success)]">
              {parsedAnswerCount} questions detected
            </span>
          )}
        </div>

        <textarea
          value={answerKeyText}
          onChange={(event) => setAnswerKeyText(event.target.value)}
          rows={12}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 font-mono text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
          placeholder='{"1": "A", "2": "B", "3": "C", ...}'
        />
        <p className="mt-2 text-sm text-[var(--muted)]">
          Edit the JSON if needed. Format: question number to correct answer (A/B/C/D)
        </p>
      </section>

      {/* Step 3: Exam Details */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${title ? "bg-[#c9784e] text-white" : "bg-[#f5efe8] text-[#9a8b7a]"}`}>
            3
          </div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Exam Details</h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Exam Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
              onChange={(event) => setTimeLimitMinutes(Number(event.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
            />
          </div>
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
          disabled={parsing || saving || !title || !imagePath || parsedAnswerCount === 0}
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
          disabled={parsing || saving || !title || !imagePath || parsedAnswerCount === 0}
          className="flex-1 rounded-xl bg-[#c9784e] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#b5673f] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
        >
          {parsing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : saving ? (
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
    </main>
  );
}
