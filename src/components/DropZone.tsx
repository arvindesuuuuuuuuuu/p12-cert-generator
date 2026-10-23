"use client";

import React, { useCallback, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  CloudUpload,
  Download,
  Sparkles,
} from "lucide-react";

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
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
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

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={[
        "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300",
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
        ) : (
          <FileSpreadsheet className="h-7 w-7" />
        )}
      </div>

      <h3 className="text-base font-bold text-slate-100 sm:text-lg">
        {dragging ? "Drop spreadsheet to import" : "Upload Spreadsheet to Batch Generate"}
      </h3>
      <p className="mt-1 text-xs text-[#8e8ea6] max-w-md">
        Drag &amp; drop an Excel (.xlsx, .xls) or CSV file, or choose from your computer.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/30 transition">
          <Upload className="h-4 w-4" />
          Choose File (.xlsx, .csv)
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onInputChange}
            className="sr-only"
            disabled={disabled}
          />
        </label>

        {onLoadDemo && (
          <button
            type="button"
            onClick={onLoadDemo}
            disabled={disabled}
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
            className="inline-flex items-center gap-1.5 text-xs text-[#8e8ea6] hover:text-slate-200 underline underline-offset-4 py-2 px-3"
          >
            <Download className="h-3.5 w-3.5 text-emerald-400" />
            Download Excel Template
          </button>
        )}
      </div>
    </div>
  );
}
