"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { QuestionBoundary, PageImage } from "@/types/exam";

interface CropEditorProps {
  pageImage: PageImage;
  boundary: QuestionBoundary;
  onSave: (updatedBoundary: QuestionBoundary) => void;
  onCancel: () => void;
}

const MIN_SIZE = 0.02;
const HANDLE_SIZE = 12;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function getCursor(mode: string): string {
  switch (mode) {
    case "move": return "move";
    case "nw": case "se": return "nwse-resize";
    case "ne": case "sw": return "nesw-resize";
    case "n": case "s": return "ns-resize";
    case "e": case "w": return "ew-resize";
    default: return "default";
  }
}

export default function CropEditor({ pageImage, boundary, onSave, onCancel }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  const [dragging, setDragging] = useState(false);
  const [dragCursor, setDragCursor] = useState("default");

  const [crop, setCrop] = useState({
    x: boundary.xStartFraction,
    y: boundary.yStartFraction,
    w: Math.max(MIN_SIZE, boundary.xEndFraction - boundary.xStartFraction),
    h: Math.max(MIN_SIZE, boundary.yEndFraction - boundary.yStartFraction),
  });

  const initialCropRef = useRef({ ...crop });

  const dragRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    startCrop: { x: number; y: number; w: number; h: number };
    imgW: number;
    imgH: number;
  } | null>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape key to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Scroll to crop area on first valid container measurement
  useEffect(() => {
    if (scrolledRef.current || containerSize.w <= 10) return;
    scrolledRef.current = true;
    const el = containerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      const bScale = Math.min(el.clientWidth / pageImage.width, el.clientHeight / pageImage.height, 1);
      const dW = pageImage.width * bScale;
      const dH = pageImage.height * bScale;
      const cx = boundary.xStartFraction;
      const cy = boundary.yStartFraction;
      const cw = boundary.xEndFraction - boundary.xStartFraction;
      const ch = boundary.yEndFraction - boundary.yStartFraction;
      el.scrollTo({
        left: Math.max(0, (cx + cw / 2) * dW - el.clientWidth / 2),
        top: Math.max(0, (cy + ch / 2) * dH - el.clientHeight / 2),
      });
    });
  }, [containerSize, boundary, pageImage.width, pageImage.height]);

  // Image display dimensions
  const baseScale = Math.min(
    containerSize.w / pageImage.width,
    containerSize.h / pageImage.height,
    1,
  );
  const displayW = pageImage.width * baseScale * zoom;
  const displayH = pageImage.height * baseScale * zoom;

  // Start drag — captures current crop and display dimensions
  const startDrag = useCallback(
    (mode: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
        imgW: displayW,
        imgH: displayH,
      };
      setDragging(true);
      setDragCursor(getCursor(mode));
    },
    [crop, displayW, displayH],
  );

  // Global mousemove / mouseup — reads from dragRef so no stale closures
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / d.imgW;
      const dy = (e.clientY - d.startY) / d.imgH;
      const s = d.startCrop;
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;

      if (d.mode === "move") {
        nx = clamp(s.x + dx, 0, 1 - s.w);
        ny = clamp(s.y + dy, 0, 1 - s.h);
      } else {
        if (d.mode.includes("w")) {
          const newX = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
          nw = s.w - (newX - s.x);
          nx = newX;
        }
        if (d.mode.includes("e")) {
          nw = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
        }
        if (d.mode.includes("n")) {
          const newY = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
          nh = s.h - (newY - s.y);
          ny = newY;
        }
        if (d.mode.includes("s")) {
          nh = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
        }
      }

      setCrop({ x: nx, y: ny, w: nw, h: nh });
    };

    const handleUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const handleSave = () => {
    onSave({
      ...boundary,
      xStartFraction: crop.x,
      xEndFraction: crop.x + crop.w,
      yStartFraction: crop.y,
      yEndFraction: crop.y + crop.h,
    });
  };

  const handleReset = () => setCrop({ ...initialCropRef.current });

  // Pixel coordinates for the crop overlay
  const cpx = {
    left: crop.x * displayW,
    top: crop.y * displayH,
    width: crop.w * displayW,
    height: crop.h * displayH,
  };

  const hs = HANDLE_SIZE;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust crop for question ${boundary.questionNumber}`}
    >
      {/* Drag cursor overlay — prevents cursor flicker during drag */}
      {dragging && (
        <div className="fixed inset-0 z-[60]" style={{ cursor: dragCursor }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--card)] border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Adjust Crop — Question {boundary.questionNumber}
          </h2>
          <span className="text-sm text-[var(--muted)]">Page {boundary.pageNumber}</span>
          <span className="text-xs text-[var(--muted)]">
            {Math.round(crop.w * pageImage.width)} &times; {Math.round(crop.h * pageImage.height)} px
          </span>
        </div>
        <button
          onClick={onCancel}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--secondary-light)] hover:text-[var(--foreground)]"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image area */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center p-4">
          <div
            className="relative flex-shrink-0 select-none"
            style={{ width: displayW, height: displayH }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageImage.dataUrl}
              alt={`Page ${boundary.pageNumber}`}
              className="block"
              style={{ width: displayW, height: displayH }}
              draggable={false}
            />

            {/* Crop overlay — box-shadow creates the dim-outside effect */}
            <div
              className="absolute border-2 border-[#c9784e]"
              style={{
                left: cpx.left,
                top: cpx.top,
                width: cpx.width,
                height: cpx.height,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                cursor: "move",
              }}
              onMouseDown={(e) => startDrag("move", e)}
            >
              {/* NW */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{ width: hs, height: hs, cursor: "nwse-resize", top: -hs / 2, left: -hs / 2 }}
                onMouseDown={(e) => startDrag("nw", e)}
              />
              {/* NE */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{ width: hs, height: hs, cursor: "nesw-resize", top: -hs / 2, right: -hs / 2 }}
                onMouseDown={(e) => startDrag("ne", e)}
              />
              {/* SW */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{ width: hs, height: hs, cursor: "nesw-resize", bottom: -hs / 2, left: -hs / 2 }}
                onMouseDown={(e) => startDrag("sw", e)}
              />
              {/* SE */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{ width: hs, height: hs, cursor: "nwse-resize", bottom: -hs / 2, right: -hs / 2 }}
                onMouseDown={(e) => startDrag("se", e)}
              />
              {/* N */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{
                  width: hs, height: hs, cursor: "ns-resize",
                  top: -hs / 2, left: "50%", transform: "translateX(-50%)",
                }}
                onMouseDown={(e) => startDrag("n", e)}
              />
              {/* S */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{
                  width: hs, height: hs, cursor: "ns-resize",
                  bottom: -hs / 2, left: "50%", transform: "translateX(-50%)",
                }}
                onMouseDown={(e) => startDrag("s", e)}
              />
              {/* W */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{
                  width: hs, height: hs, cursor: "ew-resize",
                  top: "50%", left: -hs / 2, transform: "translateY(-50%)",
                }}
                onMouseDown={(e) => startDrag("w", e)}
              />
              {/* E */}
              <div
                className="absolute bg-white border-2 border-[#c9784e] rounded-sm"
                style={{
                  width: hs, height: hs, cursor: "ew-resize",
                  top: "50%", right: -hs / 2, transform: "translateY(-50%)",
                }}
                onMouseDown={(e) => startDrag("e", e)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 bg-[var(--card)] border-t border-[var(--border)] shrink-0">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="crop-zoom">
            Zoom: {Math.round(zoom * 100)}%
          </label>
          <input
            id="crop-zoom"
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-40 accent-[#c9784e]"
          />
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
          >
            Reset
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary-light)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[#c9784e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b56a3f] transition-colors"
          >
            Save Crop
          </button>
        </div>
      </div>
    </div>
  );
}
