"use client";

import React, { useCallback, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CloudUpload,
  Download,
  Sparkles,
  Link2,
  Loader2,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";
import { fetchGoogleSheetAsFile } from "@/lib/googleSheets";

interface DropZoneProps {
  onFile: (file: File) => void;
  onLoadDemo?: () => void;
  onDownloadTemplate?: () => void;
  disabled?: boolean;
}

export function DropZone({
  onFile,
  onLoadDemo,
  onDownloadTemplate,
  disabled = false,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [gsheetUrl, setGsheetUrl] = useState("");
  const [loadingGsheet, setLoadingGsheet] = useState(false);
  const [gsheetError, setGsheetError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
        alert("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFile(file);
        return;
      }

      // Check if text or link was dragged
      const text =
        e.dataTransfer.getData("text/uri-list") ||
        e.dataTransfer.getData("text/plain");
      if (text && text.includes("spreadsheets")) {
        setGsheetUrl(text.trim());
        setLoadingGsheet(true);
        setGsheetError(null);
        try {
          const fetchedFile = await fetchGoogleSheetAsFile(text.trim());
          handleFile(fetchedFile);
        } catch (err) {
          setGsheetError(
            err instanceof Error ? err.message : "Failed to load Google Sheet"
          );
        } finally {
          setLoadingGsheet(false);
        }
      }
    },
    [disabled, handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const handleGSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gsheetUrl.trim() || loadingGsheet || disabled) return;

    setLoadingGsheet(true);
    setGsheetError(null);

    try {
      const fetchedFile = await fetchGoogleSheetAsFile(gsheetUrl);
      setGsheetUrl("");
      handleFile(fetchedFile);
    } catch (err) {
      setGsheetError(
        err instanceof Error ? err.message : "Failed to load Google Sheet"
      );
    } finally {
      setLoadingGsheet(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center transition-all duration-300",
        dragging
          ? "border-purple-400 bg-purple-500/10 shadow-2xl shadow-purple-950/40"
          : "border-[#2b2b3b] bg-[#14141b] hover:border-purple-500/50 hover:bg-[#181822]",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <div
        className={[
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 transition-all duration-300",
          dragging
            ? "scale-110 bg-purple-500/30 ring-purple-400 text-purple-300"
            : "bg-[#1c1c27] ring-[#2f2f42] text-purple-400",
        ].join(" ")}
      >
        {dragging ? (
          <CloudUpload className="h-7 w-7 animate-bounce" />
        ) : loadingGsheet ? (
          <Loader2 className="h-7 w-7 animate-spin text-purple-400" />
        ) : (
          <FileSpreadsheet className="h-7 w-7" />
        )}
      </div>

      <h3 className="text-base font-bold text-slate-100 sm:text-lg">
        {loadingGsheet
          ? "Importing Google Spreadsheet..."
          : dragging
          ? "Drop spreadsheet to import"
          : "Upload Spreadsheet to Batch Generate"}
      </h3>
      <p className="mt-1 text-xs text-[#8e8ea6] max-w-md">
        Drag &amp; drop an Excel (.xlsx, .xls) or CSV file, paste a Google Sheet link, or choose from your computer.
      </p>

      {/* Primary Local File Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/30 transition">
          <Upload className="h-4 w-4" />
          Choose File (.xlsx, .csv)
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onInputChange}
            className="sr-only"
            disabled={disabled || loadingGsheet}
          />
        </label>

        {onLoadDemo && (
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={disabled || loadingGsheet}
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 underline underline-offset-4 py-2 px-3"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Try with 3 Demo Rows
          </button>
        )}

        {onDownloadTemplate && (
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={disabled || loadingGsheet}
            className="inline-flex items-center gap-1.5 text-xs text-[#8e8ea6] hover:text-slate-200 underline underline-offset-4 py-2 px-3"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Download Excel Template
          </button>
        )}
      </div>

      {/* ── Google Sheets Import Box ──────────────────────────────────── */}
      <div className="mt-7 w-full max-w-xl border-t border-[#232332] pt-6">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9898b3] flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-emerald-400" />
            Or Import via Google Sheets Link
          </span>
          <span className="text-[10px] text-[#71718c]">Public or &quot;Anyone with link&quot;</span>
        </div>

        <form onSubmit={handleGSheetSubmit} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full flex-1">
            <input
              type="text"
              value={gsheetUrl}
              onChange={(e) => {
                setGsheetUrl(e.target.value);
                if (gsheetError) setGsheetError(null);
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              disabled={loadingGsheet || disabled}
              className="w-full rounded-xl border border-[#2b2b3d] bg-[#0d0d13] pl-3.5 pr-8 py-2.5 text-xs text-slate-100 placeholder-[#5f5f78] outline-none transition focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            />
            {gsheetUrl && !loadingGsheet && (
              <button
                type="button"
                onClick={() => {
                  setGsheetUrl("");
                  setGsheetError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!gsheetUrl.trim() || loadingGsheet || disabled}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loadingGsheet ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <span>Load Sheet</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {gsheetError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs text-left flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 whitespace-pre-line leading-relaxed">{gsheetError}</div>
          </div>
        )}
      </div>
    </div>
  );
}
