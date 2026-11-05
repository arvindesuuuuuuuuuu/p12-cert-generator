"use client";

import React from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  PackageCheck,
  AlertTriangle,
  Download,
  Eye,
  Sparkles,
} from "lucide-react";
import type { GenerationProgress } from "@/types";
import { SpinningModel } from "@/components/SpinningModel";

interface ProgressModalProps {
  progress: GenerationProgress;
  onClose: () => void;
  onDownloadZip?: () => void;
}

export function ProgressModal({
  progress,
  onClose,
  onDownloadZip,
}: ProgressModalProps) {
  const pct =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const successCount = progress.results.filter((r) => r.success).length;
  const failCount = progress.results.filter((r) => !r.success).length;
  const isDone = progress.status === "done";
  const isRunning = progress.status === "running";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Dialog */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#3b2b5a] bg-[#12121c] p-6 sm:p-7 shadow-[0_0_60px_rgba(147,51,234,0.35)] text-slate-200 text-center">
        {/* Background Purple Glow Flare */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="mb-2 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 transition ${
                isDone
                  ? failCount === 0
                    ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                    : "bg-amber-500/20 text-amber-300 ring-amber-500/40"
                  : "bg-purple-500/20 text-purple-300 ring-purple-500/40"
              }`}
            >
              {isRunning ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span>Generating Batch Certificates...</span>
                </>
              ) : isDone && failCount === 0 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Batch Completed Successfully!</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Completed with Issues</span>
                </>
              )}
            </span>
          </div>

          {isDone && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-[#8e8ea6] hover:bg-[#20202e] hover:text-white transition"
              title="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ── Centerpiece: Model Literally Spinning Animation ───────────────────────── */}
        <SpinningModel isProcessing={isRunning} isDone={isDone} />

        {/* Status titles */}
        <div className="space-y-1 relative z-10 mb-3">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {isRunning
              ? "Generating .P12 Certificates..."
              : failCount === 0
              ? "All Certificates Ready!"
              : "Batch Generation Completed"}
          </h3>
          <p className="text-xs text-[#9d9db9] truncate max-w-sm mx-auto">
            {isRunning ? (
              <span>
                Creating keys for:{" "}
                <strong className="text-purple-300">
                  {progress.currentName || `Row #${progress.current}`}
                </strong>
              </span>
            ) : isDone ? (
              <span>
                Successfully generated{" "}
                <strong className="text-emerald-400 font-mono">
                  {successCount}
                </strong>{" "}
                certificates.
              </span>
            ) : (
              "Initializing cryptographic engine in your browser..."
            )}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 max-w-md mx-auto mb-4 relative z-10">
          <div className="flex items-center justify-between text-xs px-1 font-mono">
            <span className="text-[#8e8ea6]">
              Progress: <strong className="text-white">{progress.current}</strong> /{" "}
              {progress.total}
            </span>
            <span className="font-bold text-purple-300">{pct}%</span>
          </div>

          <div className="h-3 w-full rounded-full bg-[#171725] border border-[#2b2b40] p-0.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 relative ${
                isDone
                  ? failCount === 0
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : "bg-gradient-to-r from-amber-500 to-orange-400"
                  : "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-400"
              }`}
              style={{ width: `${pct}%` }}
            >
              {isRunning && (
                <div className="absolute inset-0 bg-white/25 animate-pulse rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 mb-4 relative z-10 text-left">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Successful</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-400 font-mono">
              {successCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#2e2e42] bg-[#171724] p-3.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {failCount > 0 ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : (
                <PackageCheck className="h-4 w-4 text-slate-500" />
              )}
              <span>Failed</span>
            </div>
            <p
              className={[
                "mt-1 text-2xl font-bold font-mono",
                failCount > 0 ? "text-red-400" : "text-slate-400",
              ].join(" ")}
            >
              {failCount}
            </p>
          </div>
        </div>

        {/* Failure Log */}
        {failCount > 0 && (
          <div className="mb-4 max-h-24 overflow-y-auto rounded-2xl border border-red-500/20 bg-red-950/30 p-3 text-xs text-left relative z-10">
            {progress.results
              .filter((r) => !r.success)
              .map((r) => (
                <div key={r.index} className="text-red-400 py-0.5">
                  <strong>{r.filename}</strong>: {r.error}
                </div>
              ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
          {isDone ? (
            <>
              {onDownloadZip && successCount > 0 && (
                <button
                  type="button"
                  onClick={onDownloadZip}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/40 transition"
                >
                  <Download className="h-4 w-4" />
                  <span>Download All ({successCount}) .ZIP</span>
                </button>
              )}
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
            <p className="text-center text-xs text-[#8e8ea6]">
              Generating private keys securely in your browser...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
