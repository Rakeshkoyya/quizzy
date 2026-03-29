"use client";

import { useState, useCallback } from "react";

export interface SectionDefinition {
  id: string;
  name: string;
  fromQuestion: number;
  toQuestion: number;
}

interface SectionEditorProps {
  /** Total number of questions available */
  totalQuestions: number;
  /** Initial sections (for editing existing) */
  initialSections?: SectionDefinition[];
  /** Called when sections change */
  onChange: (sections: SectionDefinition[]) => void;
  /** If true, renders as a compact inline editor instead of a card */
  compact?: boolean;
}

function generateId(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SectionEditor({
  totalQuestions,
  initialSections,
  onChange,
  compact = false,
}: SectionEditorProps) {
  const [sections, setSections] = useState<SectionDefinition[]>(
    initialSections ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    (next: SectionDefinition[]) => {
      setSections(next);
      onChange(next);
    },
    [onChange],
  );

  function addSection() {
    // Find the next unassigned question range
    const assigned = new Set<number>();
    for (const s of sections) {
      for (let i = s.fromQuestion; i <= s.toQuestion; i++) assigned.add(i);
    }
    let from = 1;
    for (let i = 1; i <= totalQuestions; i++) {
      if (!assigned.has(i)) {
        from = i;
        break;
      }
    }
    const to = Math.min(from, totalQuestions);

    const newSection: SectionDefinition = {
      id: generateId(),
      name: "",
      fromQuestion: from,
      toQuestion: to,
    };
    update([...sections, newSection]);
    setError(null);
  }

  function removeSection(id: string) {
    update(sections.filter((s) => s.id !== id));
    setError(null);
  }

  function updateSection(id: string, field: keyof SectionDefinition, value: string | number) {
    const next = sections.map((s) => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      // Auto-correct: ensure from <= to
      if (field === "fromQuestion" && typeof value === "number" && value > s.toQuestion) {
        updated.toQuestion = value;
      }
      if (field === "toQuestion" && typeof value === "number" && value < s.fromQuestion) {
        updated.fromQuestion = value;
      }
      return updated;
    });

    // Validate no overlapping ranges
    const overlaps = validateNoOverlaps(next);
    setError(overlaps);
    update(next);
  }

  function validateNoOverlaps(secs: SectionDefinition[]): string | null {
    for (let i = 0; i < secs.length; i++) {
      for (let j = i + 1; j < secs.length; j++) {
        const a = secs[i];
        const b = secs[j];
        if (a.fromQuestion <= b.toQuestion && b.fromQuestion <= a.toQuestion) {
          return `"${a.name || `Section ${i + 1}`}" and "${b.name || `Section ${j + 1}`}" have overlapping question ranges`;
        }
      }
    }
    return null;
  }

  // Build list of question numbers for dropdowns
  const questionNumbers = Array.from({ length: totalQuestions }, (_, i) => i + 1);

  const wrapperClass = compact
    ? ""
    : "rounded-xl border border-[var(--border)] bg-[var(--secondary-light)] p-4";

  return (
    <div className={wrapperClass}>
      {!compact && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Sections</h3>
            <p className="text-xs text-[var(--muted)]">
              Optionally group questions into sections (e.g., Physics Q1–Q45, Chemistry Q46–Q90)
            </p>
          </div>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#c9784e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#b5673f]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>
      )}

      {compact && (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--foreground)]">Sections</span>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#c9784e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#b5673f]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>
      )}

      {sections.length === 0 && (
        <p className="text-center text-xs text-[var(--muted)] py-3">
          No sections defined. Questions will not be grouped.
        </p>
      )}

      <div className="space-y-2">
        {sections.map((section, idx) => (
          <div
            key={section.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2"
          >
            {/* Section name */}
            <input
              type="text"
              value={section.name}
              onChange={(e) => updateSection(section.id, "name", e.target.value)}
              placeholder={`Section ${idx + 1} name`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-light)]"
            />

            {/* From question */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">From Q</span>
              <select
                value={section.fromQuestion}
                onChange={(e) =>
                  updateSection(section.id, "fromQuestion", parseInt(e.target.value, 10))
                }
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-light)]"
              >
                {questionNumbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* To question */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--muted)]">To Q</span>
              <select
                value={section.toQuestion}
                onChange={(e) =>
                  updateSection(section.id, "toQuestion", parseInt(e.target.value, 10))
                }
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-light)]"
              >
                {questionNumbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Question count badge */}
            <span className="rounded-full bg-[var(--primary-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--primary)]">
              {Math.max(0, section.toQuestion - section.fromQuestion + 1)} Qs
            </span>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeSection(section.id)}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--error-light)] hover:text-[var(--error)]"
              title="Remove section"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-xs text-[var(--error)]">{error}</p>
      )}
    </div>
  );
}
