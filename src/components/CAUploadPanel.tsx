"use client";

import React, { useState, useCallback } from "react";
import {
  ShieldAlert,
  Upload,
  Key,
  FileKey2,
  Eye,
  EyeOff,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { CACredentials } from "@/types";
import { parseCAP12, parseCAFiles } from "@/lib/caParser";

interface CAUploadPanelProps {
  onCredentials: (creds: CACredentials | null) => void;
  credentials: CACredentials | null;
}

export function CAUploadPanel({
  onCredentials,
  credentials,
}: CAUploadPanelProps) {
  const [mode, setMode] = useState<"p12" | "pem">("p12");
  const [p12File, setP12File] = useState<File | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let creds: CACredentials;
      if (mode === "p12") {
        if (!p12File) throw new Error("Please select your CA .p12 or .pfx file.");
        creds = await parseCAP12(p12File, password);
      } else {
        if (!certFile || !keyFile)
          throw new Error("Please choose both the CA certificate (.crt) and the private key (.key).");
        creds = await parseCAFiles(certFile, keyFile);
      }
      onCredentials(creds);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, p12File, certFile, keyFile, password, onCredentials]);

  const handleClear = () => {
    onCredentials(null);
    setP12File(null);
    setCertFile(null);
    setKeyFile(null);
    setPassword("");
    setError(null);
  };

  return (
    <div className="rounded-3xl border border-amber-500/30 bg-amber-950/15 p-6 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-200">
              Custom CA (Root or Intermediate)
            </h3>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Upload your organizational CA to sign all batch or single certificates.
            </p>
          </div>
        </div>

        {credentials && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition"
          >
            <X className="h-3.5 w-3.5" />
            Remove CA
          </button>
        )}
      </div>

      {credentials ? (
        /* Active CA Box */
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1">
            <CheckCircle2 className="h-4 w-4" />
            CA Certificate &amp; Key Loaded!
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            All generated certificates will now be signed using this CA. You can switch back to Self-Signed anytime.
          </p>
        </div>
      ) : (
        <>
          {/* File format tabs */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setMode("p12")}
              className={[
                "flex items-center justify-center gap-2 rounded-xl py-2 font-medium transition",
                mode === "p12"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              <FileKey2 className="h-3.5 w-3.5" />
              CA .p12 / .pfx
            </button>
            <button
              type="button"
              onClick={() => setMode("pem")}
              className={[
                "flex items-center justify-center gap-2 rounded-xl py-2 font-medium transition",
                mode === "pem"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              <Key className="h-3.5 w-3.5" />
              .crt + .key files
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            {mode === "p12" ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select CA .p12 or .pfx File
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-300 hover:border-amber-500/50 transition">
                    <span className="truncate max-w-[220px]">
                      {p12File ? p12File.name : "Choose .p12 file..."}
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setP12File(f);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CA Password (if required)
                  </label>
                  <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password..."
                      className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="ml-2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CA Certificate File (.crt, .pem)
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-300 hover:border-amber-500/50 transition">
                    <span className="truncate max-w-[220px]">
                      {certFile ? certFile.name : "Choose .crt file..."}
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".crt,.pem,.cer"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setCertFile(f);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    CA Private Key File (.key, .pem)
                  </label>
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-slate-300 hover:border-amber-500/50 transition">
                    <span className="truncate max-w-[220px]">
                      {keyFile ? keyFile.name : "Choose .key file..."}
                    </span>
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".key,.pem"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) setKeyFile(f);
                        e.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-950/40 border border-red-500/40 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleLoad}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 py-2.5 text-xs font-bold text-amber-200 transition disabled:opacity-50"
          >
            {loading ? (
              "Loading CA..."
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Unlock &amp; Use This CA
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
