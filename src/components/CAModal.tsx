"use client";

import React from "react";
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { SpinningModel } from "@/components/SpinningModel";

interface CAModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isDone: boolean;
  caName?: string;
  onContinue?: () => void;
}

export function CAModal({
  isOpen,
  onClose,
  isLoading,
  isDone,
  caName,
  onContinue,
}: CAModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#4a3b2b] bg-[#12121c] p-6 sm:p-7 shadow-[0_0_60px_rgba(245,158,11,0.25)] text-center text-slate-200">
        {/* Background Amber/Purple Glow Flare */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between relative z-10 mb-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 transition ${
                isDone
                  ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40"
                  : "bg-amber-500/20 text-amber-300 ring-amber-500/40"
              }`}
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>CA Authority Verified!</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin text-amber-400" />
                  <span>Unlocking CA Keys...</span>
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
        <SpinningModel isProcessing={isLoading} isDone={isDone} />

        {/* Status titles */}
        <div className="space-y-1.5 relative z-10 mb-4">
          <h3 className="text-lg font-bold text-white tracking-tight">
            {isDone
              ? "CA Certificate & Key Ready!"
              : "Verifying CA Authority & Keys..."}
          </h3>
          <p className="text-xs text-[#9d9db9] truncate max-w-sm mx-auto">
            {isDone ? (
              <span>
                All certificates will now be signed with{" "}
                <strong className="text-amber-300 font-semibold">{caName || "your Custom CA"}</strong>.
              </span>
            ) : (
              "Decrypting private key, checking certificates, and validating RSA pair..."
            )}
          </p>
        </div>

        {/* CA Details Card upon completion */}
        {isDone && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-left space-y-2 relative z-10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Authority Status:</span>
              </span>
              <span className="font-semibold text-emerald-300">Active &amp; Ready</span>
            </div>

            {caName && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#252538]">
                <span className="text-slate-400">Subject / Issuer:</span>
                <span className="font-mono text-slate-200 truncate max-w-[220px]">
                  {caName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-wrap items-center justify-center gap-2.5">
          {isDone ? (
            <>
              <button
                type="button"
                onClick={onContinue || onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-900/40 transition"
              >
                <span>Ready to Sign Certificates</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e42] bg-[#1a1a26] hover:bg-[#252536] px-5 py-2.5 text-xs font-semibold text-slate-200 transition"
              >
                <span>Close</span>
              </button>
            </>
          ) : (
            <p className="text-xs text-[#8e8ea6]">
              Parsing cryptography securely in memory. Private keys never leave your machine.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
