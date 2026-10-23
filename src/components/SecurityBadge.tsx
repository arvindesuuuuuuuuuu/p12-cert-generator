"use client";

import React from "react";
import { ShieldCheck, Lock, CheckCircle2 } from "lucide-react";

export function SecurityBadge() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-300">
                Client-Side In-Memory Processing
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                Zero-Knowledge
              </span>
            </div>
            <p className="text-[11px] text-[#9a9ab6] mt-0.5">
              All RSA keys, certificates, and passwords are generated locally in your browser.{" "}
              <strong className="text-emerald-300 font-semibold">
                Nothing is sent to any server.
              </strong>
            </p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 text-[11px] text-[#8e8ea6] self-end sm:self-auto">
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#0c0c11] px-2.5 py-1 text-slate-300 border border-[#232330]">
            <Lock className="h-3 w-3 text-emerald-400" />
            AES-256 Encrypted
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-300 font-medium">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            Active
          </span>
        </div>
      </div>
    </div>
  );
}
