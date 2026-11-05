"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Sparkles,
  Lock,
  FileCheck2,
} from "lucide-react";
import { SpinningModel } from "@/components/SpinningModel";

interface SingleCertModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  isDone: boolean;
  commonName: string;
  filename: string;
  password?: string;
  onDownloadAgain?: () => void;
}

export function SingleCertModal({
  isOpen,
  onClose,
  isGenerating,
  isDone,
  commonName,
  filename,
  password,
  onDownloadAgain,
}: SingleCertModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#3b2b5a] bg-[#12121c] p-6 sm:p-7 shadow-[0_0_60px_rgba(147,51,234,0.35)] text-center text-slate-200">
        {/* Background Purple Glow Flare */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-purple-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
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
                  <span>Certificate Generated!</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span>Generating Certificate...</span>
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
        <SpinningModel isProcessing={isGenerating} isDone={isDone} />

        {/* Status titles */}
        <div className="space-y-1.5 relative z-10 mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {isDone
              ? "Certificate Ready & Downloaded!"
              : "Creating PKCS#12 (.p12) Certificate..."}
          </h3>
          <p className="text-xs text-[#9d9db9] truncate max-w-sm mx-auto">
            {isDone ? (
              <span>
                Saved as <strong className="text-emerald-400 font-mono">{filename}</strong>
              </span>
            ) : commonName ? (
              <span>
                Generating 2048-bit RSA keys for:{" "}
                <strong className="text-purple-300">{commonName}</strong>
              </span>
            ) : (
              "Building X.509 certificate and encrypting PKCS#12 bundle..."
            )}
          </p>
        </div>

        {/* Certificate Details Card upon completion */}
        {isDone && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-left space-y-2.5 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Filename:</span>
              </span>
              <span className="font-mono font-bold text-slate-100">{filename}</span>
            </div>

            {password && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#252538]">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  <span>Password:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {password}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-100 transition ml-1"
                    title="Copy password to clipboard"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
          {isDone ? (
            <>
              {onDownloadAgain && (
                <button
                  type="button"
                  onClick={onDownloadAgain}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/40 transition"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Again</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e42] bg-[#1a1a26] hover:bg-[#252536] px-5 py-2.5 text-xs font-semibold text-slate-200 transition"
              >
                <span>Done</span>
              </button>
            </>
          ) : (
            <p className="text-xs text-[#8e8ea6]">
              All cryptography runs securely offline in your browser.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
