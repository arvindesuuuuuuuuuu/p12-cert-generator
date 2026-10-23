"use client";

import React from "react";
import {
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  PackageCheck,
  AlertTriangle,
  Download,
} from "lucide-react";
import type { GenerationProgress } from "@/types";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={isDone ? onClose : undefined}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl p-7">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-2xl ring-1 shadow-lg transition-colors",
                isDone
                  ? failCount === 0
                    ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40"
                    : "bg-amber-500/20 text-amber-400 ring-amber-500/40"
                  : "bg-indigo-500/20 text-indigo-400 ring-indigo-500/40",
              ].join(" ")}
            >
              {isRunning ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : isDone && failCount === 0 ? (
                <PackageCheck className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">
                {isRunning
                  ? "Creating Certificates..."
                  : failCount === 0
                  ? "All Certificates Ready!"
                  : "Batch Completed with Issues"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRunning
                  ? `Processing certificate ${progress.current} of ${progress.total}`
                  : `Created ${progress.total} certificate files in your browser`}
              </p>
            </div>
          </div>

          {isDone && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-950 p-0.5 border border-slate-800">
            <div
              className={[
                "h-full rounded-full transition-all duration-300 ease-out",
                isDone
                  ? failCount === 0
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                  : "bg-indigo-500 animate-pulse",
              ].join(" ")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Percentage & Active Name */}
        <div className="mb-6 flex items-center justify-between text-xs">
          <span className="text-slate-400 truncate max-w-[260px]">
            {isRunning ? (
              <>
                Generating: <strong className="text-indigo-300">{progress.currentName || `Row #${progress.current}`}</strong>
              </>
            ) : isDone ? (
              <span className="text-emerald-400 font-medium">
                {successCount} certificate{successCount !== 1 ? "s" : ""} packaged into ZIP
              </span>
            ) : (
              "Starting..."
            )}
          </span>
          <span className="font-mono font-bold text-slate-200">{pct}%</span>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Successful</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-400 font-mono">
              {successCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {failCount > 0 ? (
                <XCircle className="h-4 w-4 text-red-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-slate-500" />
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
          <div className="mb-5 max-h-28 overflow-y-auto rounded-2xl border border-red-500/20 bg-red-950/30 p-3 text-xs">
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
        {isDone ? (
          <div className="flex flex-col sm:flex-row gap-2.5">
            {onDownloadZip && successCount > 0 && (
              <button
                type="button"
                onClick={onDownloadZip}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-3 px-4 text-xs font-bold text-white shadow-lg transition"
              >
                <Download className="h-4 w-4" />
                Download All (.ZIP)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-700 bg-slate-800 hover:bg-slate-700 py-3 px-4 text-xs font-semibold text-slate-200 transition"
            >
              View in Table
            </button>
          </div>
        ) : (
          <p className="text-center text-xs text-slate-400">
            Please keep this tab open while your computer creates the keys.
          </p>
        )}
      </div>
    </div>
  );
}
