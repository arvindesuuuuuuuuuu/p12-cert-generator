"use client";

import React from "react";
import {
  X,
  PackageOpen,
  Sparkles,
  CheckCircle2,
  StopCircle,
  Eye,
} from "lucide-react";
import { SpinningModel } from "@/components/SpinningModel";

interface EsignProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  isProcessing: boolean;
  isDone: boolean;
  current: number;
  total: number;
  currentName: string;
  readyCount: number;
  onDownloadZip: () => void;
  onCancel?: () => void;
}

export function EsignProcessModal({
  isOpen,
  onClose,
  isProcessing,
  isDone,
  current,
  total,
  currentName,
  readyCount,
  onDownloadZip,
  onCancel,
}: EsignProcessModalProps) {
  if (!isOpen) return null;

  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#3b2b5a] bg-[#12121c] p-6 sm:p-8 shadow-[0_0_60px_rgba(147,51,234,0.35)] text-center text-slate-200">
        {/* Background Purple Glow Flare */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Close Button */}
        <div className="flex items-center justify-between relative z-10 mb-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 transition ${
                isDone
                  ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                  : "bg-purple-500/20 text-purple-300 ring-purple-500/40"
              }`}
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Processing Complete!</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span>Processing Signatories...</span>
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#8e8ea6] hover:bg-[#20202e] hover:text-white transition"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Centerpiece: Model Literally Spinning Animation ───────────────────────── */}
        <SpinningModel isProcessing={isProcessing} isDone={isDone} />

        {/* ── Status Text & Progress ─────────────────────────────────────── */}
        <div className="space-y-3 relative z-10">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {isDone
                ? "All Signatures Extracted!"
                : "Cleaning & Isolating Signatures..."}
            </h3>
            <p className="text-xs text-[#9d9db9] mt-0.5 truncate max-w-sm mx-auto">
              {isDone ? (
                <span>
                  Successfully processed{" "}
                  <strong className="text-emerald-400 font-mono">
                    {readyCount}
                  </strong>{" "}
                  transparent PNG signature files.
                </span>
              ) : currentName ? (
                <span>
                  Isolating ink for:{" "}
                  <strong className="text-purple-300">{currentName}</strong>
                </span>
              ) : (
                "Removing background paper, app watermarks, and cropping whitespace..."
              )}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs px-1 font-mono">
              <span className="text-[#8e8ea6]">
                Progress: <strong className="text-white">{current}</strong> /{" "}
                {total}
              </span>
              <span className="font-bold text-purple-300">{pct}%</span>
            </div>

            <div className="h-3 w-full rounded-full bg-[#171725] border border-[#2b2b40] p-0.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 relative ${
                  isDone
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-400"
                }`}
                style={{ width: `${pct}%` }}
              >
                {/* Shiny Sheen Pulse */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/25 animate-pulse rounded-full" />
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
            {isDone ? (
              <>
                <button
                  type="button"
                  onClick={onDownloadZip}
                  disabled={readyCount === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/40 transition"
                >
                  <PackageOpen className="h-4 w-4" />
                  <span>Download All ({readyCount}) .ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e42] bg-[#1a1a26] hover:bg-[#252536] px-5 py-2.5 text-xs font-semibold text-slate-200 transition"
                >
                  <Eye className="h-4 w-4 text-purple-400" />
                  <span>View in Table</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e42] bg-[#1a1a26] hover:bg-[#252536] px-4 py-2 text-xs font-semibold text-slate-300 transition"
                >
                  <Eye className="h-3.5 w-3.5 text-purple-400" />
                  <span>Run in Background</span>
                </button>

                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-950/20 hover:bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-300 transition"
                  >
                    <StopCircle className="h-3.5 w-3.5 text-red-400" />
                    <span>Stop</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
