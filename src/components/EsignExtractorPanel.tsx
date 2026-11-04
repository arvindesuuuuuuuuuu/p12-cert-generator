"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  FileImage,
  Download,
  PackageOpen,
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sliders,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  ImagePlus,
  Camera,
  FileSpreadsheet,
  Trash2,
  CloudUpload,
  Upload,
} from "lucide-react";
import { saveAs } from "file-saver";
import type { CertRow, EsignItem } from "@/types";
import {
  extractGoogleDriveId,
  getProxyImageUrl,
  loadImage,
  removeSignatureBackground,
  downloadAllSignaturesAsZip,
} from "@/lib/esignExtractor";
import { formatFilenameFromName } from "@/lib/nameFormatter";
import { parseExcelFile } from "@/lib/excelParser";

function convertRowsToItems(rows: CertRow[]): EsignItem[] {
  return rows.map((r, idx): EsignItem => {
    const rawLink = r.esignLink?.trim() || "";
    const driveId = rawLink ? extractGoogleDriveId(rawLink) || undefined : undefined;
    const cleanName = formatFilenameFromName(r.commonName, "firstlast");
    return {
      index: idx,
      fullName: r.commonName,
      filename: `${cleanName}.png`,
      esignLink: rawLink,
      driveId,
      embeddedImage: r.embeddedImage,
      originalUrl: r.embeddedImage?.dataUrl,
      status: "idle",
    };
  });
}

export function EsignExtractorPanel() {
  // Local independent state for E-Sign Extractor (completely separate from Batch certs)
  const [excelFileName, setExcelFileName] = useState<string>("");
  const [items, setItems] = useState<EsignItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isLoadingExcel, setIsLoadingExcel] = useState<boolean>(false);

  // Settings for adaptive background removal & ink styling
  const [sensitivity, setSensitivity] = useState<number>(24);
  const [inkStyle, setInkStyle] = useState<"pure-black" | "navy" | "original">("pure-black");
  const [removeWatermarks, setRemoveWatermarks] = useState<boolean>(true);
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
  });

  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Load Excel/CSV strictly inside E-Sign Extractor without touching or sharing with other tabs
  const handleLoadExcel = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      alert("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.");
      return;
    }
    setIsLoadingExcel(true);
    try {
      const parsed = await parseExcelFile(file);
      const converted = convertRowsToItems(parsed);
      setExcelFileName(file.name);
      setItems(converted);
      setCurrentPage(1);
    } catch (err) {
      alert("Error reading spreadsheet: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoadingExcel(false);
    }
  };

  const handleDropExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLoadExcel(file);
    e.target.value = "";
  };

  const handleClearAll = () => {
    setItems([]);
    setExcelFileName("");
    setCurrentPage(1);
    setSearchQuery("");
  };

  // Process a single item using the adaptive algorithm
  const processItem = useCallback(
    async (item: EsignItem): Promise<EsignItem> => {
      try {
        let srcUrl = "";

        if (item.embeddedImage) {
          srcUrl = item.embeddedImage.dataUrl;
        } else if (item.localFile) {
          srcUrl = item.originalUrl || URL.createObjectURL(item.localFile);
        } else {
          const driveId = item.driveId || extractGoogleDriveId(item.esignLink || "");
          if (driveId) {
            srcUrl = `/api/proxy-image?id=${encodeURIComponent(driveId)}`;
          } else if (item.esignLink?.trim()) {
            srcUrl = getProxyImageUrl(item.esignLink);
          } else {
            return {
              ...item,
              status: "idle",
              error: "Please upload a photo or provide a link",
            };
          }
        }

        const img = await loadImage(srcUrl);
        const processed = await removeSignatureBackground(img, {
          sensitivity,
          inkStyle,
          removeWatermarks,
          autoCrop,
          padding: 16,
        });

        return {
          ...item,
          status: "ready",
          originalUrl: srcUrl,
          previewUrl: processed.dataUrl,
          processedBlob: processed.blob,
          error: undefined,
        };
      } catch (err) {
        return {
          ...item,
          status: "failed",
          error: err instanceof Error ? err.message : "Failed to extract signature image",
        };
      }
    },
    [sensitivity, inkStyle, removeWatermarks, autoCrop]
  );

  // Attach a photo to a specific row
  const handleAttachPhoto = async (index: number, file: File) => {
    const objectUrl = URL.createObjectURL(file);

    setItems((prev) =>
      prev.map((it) =>
        it.index === index
          ? {
              ...it,
              localFile: file,
              originalUrl: objectUrl,
              status: "loading",
              error: undefined,
            }
          : it
      )
    );

    try {
      const img = await loadImage(objectUrl);
      const processed = await removeSignatureBackground(img, {
        sensitivity,
        inkStyle,
        removeWatermarks,
        autoCrop,
        padding: 16,
      });

      setItems((prev) =>
        prev.map((it) =>
          it.index === index
            ? {
                ...it,
                localFile: file,
                originalUrl: objectUrl,
                previewUrl: processed.dataUrl,
                processedBlob: processed.blob,
                status: "ready",
                error: undefined,
              }
            : it
        )
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.index === index
            ? {
                ...it,
                status: "failed",
                error: err instanceof Error ? err.message : "Failed to process photo",
              }
            : it
        )
      );
    }
  };

  // Bulk Photo Upload: automatically matches photos to rows by name, or assigns sequentially
  const handleBulkPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Helper to strip non-alphanumeric characters for fuzzy matching
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    // If no rows exist yet, create rows directly from uploaded photo files
    if (items.length === 0) {
      const created: EsignItem[] = files.map((file, idx) => {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const cleanName = formatFilenameFromName(baseName, "firstlast");
        return {
          index: idx,
          fullName: baseName,
          filename: `${cleanName}.png`,
          localFile: file,
          status: "idle",
        };
      });
      setItems(created);
      for (let i = 0; i < created.length; i++) {
        await handleAttachPhoto(i, files[i]);
      }
      return;
    }

    // Match files to existing rows
    const assigned = new Map<number, File>();
    const unassignedFiles: File[] = [];

    for (const file of files) {
      const fileNorm = norm(file.name.replace(/\.[^/.]+$/, ""));
      const match = items.find((it) => {
        const nameNorm = norm(it.fullName);
        const fileBaseNorm = norm(it.filename.replace(/\.png$/i, ""));
        return (
          nameNorm.includes(fileNorm) ||
          fileNorm.includes(nameNorm) ||
          fileBaseNorm.includes(fileNorm) ||
          fileNorm.includes(fileBaseNorm)
        );
      });

      if (match && !assigned.has(match.index)) {
        assigned.set(match.index, file);
      } else {
        unassignedFiles.push(file);
      }
    }

    // Assign any remaining unmatched files sequentially to rows lacking photos/previews
    let unassignedIdx = 0;
    for (const it of items) {
      if (
        !assigned.has(it.index) &&
        !it.previewUrl &&
        !it.localFile &&
        unassignedIdx < unassignedFiles.length
      ) {
        assigned.set(it.index, unassignedFiles[unassignedIdx++]);
      }
    }

    // Process all attached photos in sequence
    for (const [rowIdx, file] of assigned.entries()) {
      await handleAttachPhoto(rowIdx, file);
    }

    // Reset input so user can upload more if desired
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = "";
    }
  };

  // Process a single row on demand
  const handleProcessSingle = async (idx: number) => {
    setItems((prev) =>
      prev.map((it) => (it.index === idx ? { ...it, status: "loading" } : it))
    );

    const target = items.find((it) => it.index === idx);
    if (!target) return;

    const updated = await processItem(target);
    setItems((prev) => prev.map((it) => (it.index === idx ? updated : it)));
  };

  // Process all items in batch
  const handleProcessAll = async () => {
    const processable = items.filter(
      (it) => it.embeddedImage || it.localFile || it.esignLink?.trim() || it.driveId
    );
    if (processable.length === 0 || isProcessingAll) {
      alert("No signature photos or Google Drive links found to process. Please attach a photo or upload an Excel with links.");
      return;
    }

    setIsProcessingAll(true);
    setProcessingProgress({ current: 0, total: items.length });

    const updatedItems = [...items];
    for (let i = 0; i < updatedItems.length; i++) {
      const it = updatedItems[i];
      if (!it.embeddedImage && !it.localFile && !it.esignLink?.trim() && !it.driveId) {
        continue;
      }

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "loading" } : item
        )
      );

      const processed = await processItem(it);
      updatedItems[i] = processed;

      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? processed : item))
      );

      setProcessingProgress({ current: i + 1, total: updatedItems.length });
      await new Promise((r) => setTimeout(r, 20));
    }

    setIsProcessingAll(false);
  };

  // Download a single transparent PNG signature
  const handleDownloadSingle = (item: EsignItem) => {
    if (!item.processedBlob) return;
    saveAs(item.processedBlob, item.filename);
  };

  // Download all ready signatures in a .ZIP
  const handleDownloadAllZip = async () => {
    const readyItems = items.filter((it) => it.status === "ready" && it.processedBlob);
    if (readyItems.length === 0) {
      alert("No processed signatures ready for download yet. Please upload/extract signatures first.");
      return;
    }

    setIsZipping(true);
    try {
      await downloadAllSignaturesAsZip(
        readyItems.map((it) => ({
          filename: it.filename,
          blob: it.processedBlob!,
        })),
        "transparent_signatures.zip"
      );
    } catch (err) {
      alert("Error packaging ZIP: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsZipping(false);
    }
  };

  // Update filename inline
  const handleFilenameChange = (idx: number, newName: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.index === idx
          ? {
              ...it,
              filename: newName.endsWith(".png") ? newName : `${newName}.png`,
            }
          : it
      )
    );
  };

  // Update Google Drive link inline
  const handleLinkChange = (idx: number, newLink: string) => {
    const driveId = extractGoogleDriveId(newLink) || undefined;
    setItems((prev) =>
      prev.map((it) =>
        it.index === idx
          ? {
              ...it,
              esignLink: newLink,
              driveId,
              status: "idle",
            }
          : it
      )
    );
  };

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.fullName.toLowerCase().includes(q) ||
        it.filename.toLowerCase().includes(q) ||
        (it.esignLink && it.esignLink.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredItems.length);
  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, startIndex, endIndex]);

  const readyCount = items.filter((it) => it.status === "ready").length;
  const embeddedCount = items.filter((it) => !!it.embeddedImage).length;
  const photoCount = items.filter(
    (it) => it.embeddedImage || it.localFile || it.esignLink?.trim()
  ).length;

  return (
    <div className="space-y-6 w-full">
      {/* ── Control Header Bar ─────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[#14141b] border border-[#232330] shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileImage className="h-4 w-4 text-purple-400" />
              <span>E-Signature Extractor &amp; Background Cleaner</span>
            </h3>
            {excelFileName && (
              <span className="rounded-md bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-xs font-mono text-purple-300 font-semibold">
                {excelFileName}
              </span>
            )}
            {items.length > 0 && (
              <span className="rounded-md bg-[#1e1e2b] px-2 py-0.5 text-xs font-mono text-slate-300">
                {items.length} Rows · {embeddedCount > 0 ? `${embeddedCount} Photos in Excel` : `${photoCount} Photos Ready`}
              </span>
            )}
          </div>
          <p className="text-xs text-[#8e8ea6] mt-0.5">
            Extracts images embedded directly in Excel, Google Drive links, or uploaded photos, removes backgrounds, and outputs pure transparent PNG signatures.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
              showSettings
                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                : "bg-[#1e1e2b] border-[#2e2e40] text-slate-300 hover:text-white"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Settings</span>
          </button>

          {/* Bulk Photo Upload */}
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/40 py-2.5 px-3.5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition cursor-pointer">
            <ImagePlus className="h-4 w-4 text-purple-400" />
            <span>Upload Photos in Bulk</span>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkPhotoUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={handleProcessAll}
            disabled={photoCount === 0 || isProcessingAll}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1e1e2b] hover:bg-[#282838] border border-[#2e2e40] py-2.5 px-4 text-xs font-semibold text-slate-200 transition disabled:opacity-40"
          >
            {isProcessingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span>
                  Processing ({processingProgress.current}/{processingProgress.total})...
                </span>
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 text-purple-400" />
                <span>Process All Signatures</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadAllZip}
            disabled={readyCount === 0 || isZipping}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] py-2.5 px-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-950/50 transition disabled:opacity-40"
          >
            {isZipping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Packaging .ZIP...</span>
              </>
            ) : (
              <>
                <PackageOpen className="h-4 w-4" />
                <span>Download All ({readyCount}) .ZIP</span>
              </>
            )}
          </button>

          <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e40] bg-[#1e1e2b] hover:bg-[#282838] py-2.5 px-3.5 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer">
            <UploadCloud className="h-3.5 w-3.5 text-purple-400" />
            <span>Upload New Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleDropExcelFile}
              className="hidden"
            />
          </label>

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 rounded-xl border border-[#232330] bg-[#14141b] hover:bg-[#1f1f2b] p-2.5 text-xs text-[#8e8ea6] hover:text-red-400 transition"
              title="Clear / Upload New File"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Settings Drawer ────────────────────────────────────────────── */}
      {showSettings && (
        <div className="p-5 rounded-3xl bg-[#171722] border border-[#262638] shadow-lg space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Adaptive Background Removal &amp; Ink Styling Configuration
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-[#7d7d9b] hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Sensitivity slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>Paper Clean Sensitivity:</span>
                <span className="font-mono text-purple-400 font-bold">{sensitivity}</span>
              </div>
              <input
                type="range"
                min={12}
                max={48}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <p className="text-[11px] text-[#7d7d9b]">
                Higher values (28+) aggressively remove dark paper &amp; shadows. Lower values (16-20) preserve faint pencil marks.
              </p>
            </div>

            {/* 2. Ink Styling */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold block">Signature Ink Style:</label>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setInkStyle("pure-black")}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition ${
                    inkStyle === "pure-black"
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-[#101017] border-[#2c2c3e] text-[#8e8ea6] hover:text-white"
                  }`}
                >
                  Jet Black
                </button>
                <button
                  type="button"
                  onClick={() => setInkStyle("navy")}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition ${
                    inkStyle === "navy"
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-[#101017] border-[#2c2c3e] text-[#8e8ea6] hover:text-white"
                  }`}
                >
                  Navy Blue
                </button>
                <button
                  type="button"
                  onClick={() => setInkStyle("original")}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold border transition ${
                    inkStyle === "original"
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-[#101017] border-[#2c2c3e] text-[#8e8ea6] hover:text-white"
                  }`}
                >
                  Original
                </button>
              </div>
              <p className="text-[11px] text-[#7d7d9b]">
                {inkStyle === "pure-black"
                  ? "Crisp, solid black ink with smooth edges."
                  : inkStyle === "navy"
                  ? "Deep official navy document ink."
                  : "Preserves natural ink color."}
              </p>
            </div>

            {/* 3. Watermark Removal */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={removeWatermarks}
                  onChange={(e) => setRemoveWatermarks(e.target.checked)}
                  className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-semibold">Remove Corner Watermarks</span>
              </label>
              <p className="text-[11px] text-[#7d7d9b]">
                Automatically detects and strips app badges (e.g. &quot;(✓) eSignature&quot;, &quot;CamScanner&quot;) from corners.
              </p>
            </div>

            {/* 4. Auto Crop */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-semibold">Auto-Crop Whitespace</span>
              </label>
              <p className="text-[11px] text-[#7d7d9b]">
                Trims empty transparent borders with neat 16px padding.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State: Dedicated Independent DropZone for E-Signatures ── */}
      {items.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleLoadExcel(file);
          }}
          className={[
            "relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 text-center transition-all duration-300",
            isDragging
              ? "border-purple-400 bg-purple-500/10 shadow-2xl shadow-purple-950/40"
              : "border-[#2b2b3b] bg-[#14141b] hover:border-purple-500/50 hover:bg-[#181822]",
          ].join(" ")}
        >
          <div
            className={[
              "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 transition-all duration-300",
              isDragging
                ? "scale-110 bg-purple-500/30 ring-purple-400 text-purple-300"
                : "bg-[#1c1c27] ring-[#2f2f42] text-purple-400",
            ].join(" ")}
          >
            {isDragging ? (
              <CloudUpload className="h-8 w-8 animate-bounce" />
            ) : isLoadingExcel ? (
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            ) : (
              <FileSpreadsheet className="h-8 w-8" />
            )}
          </div>

          <h3 className="text-base font-bold text-slate-100 sm:text-lg">
            {isLoadingExcel
              ? "Reading spreadsheet and extracting embedded images..."
              : isDragging
              ? "Drop spreadsheet here to extract signatures"
              : "Upload Spreadsheet to Extract E-Signatures"}
          </h3>
          <p className="mt-1 text-xs text-[#8e8ea6] max-w-md">
            Drag &amp; drop an Excel (.xlsx, .xls) file with embedded signature photos or Google Drive links, or choose photos directly.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/30 transition">
              <Upload className="h-4 w-4" />
              <span>Choose Excel File (.xlsx, .csv)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleDropExcelFile}
                className="sr-only"
              />
            </label>

            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-[#1e1e2b] hover:bg-[#282838] border border-[#2e2e40] px-5 py-3 text-xs font-semibold text-slate-200 transition">
              <ImagePlus className="h-4 w-4 text-purple-400" />
              <span>Upload Photos Directly</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkPhotoUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      ) : (
        /* ── Full Width Signatures Table ──────────────────────────────── */
        <div className="flex flex-col w-full rounded-3xl border border-[#232330] bg-[#14141b] shadow-2xl overflow-hidden">
          {/* Table Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232330] bg-[#171720] p-4">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#686882]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by full name or filename..."
                className="w-full rounded-xl border border-[#2a2a3b] bg-[#0c0c11] pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-[#5e5e78] outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#8e8ea6]">
              <span>
                Photos Attached:{" "}
                <strong className="text-purple-300 font-mono">{photoCount}</strong> /{" "}
                <strong className="text-slate-200 font-mono">{items.length}</strong>
              </span>
              <span>·</span>
              <span>
                Processed:{" "}
                <strong className="text-emerald-400 font-mono">{readyCount}</strong> /{" "}
                <strong className="text-slate-200 font-mono">{items.length}</strong>
              </span>
            </div>
          </div>

          {/* Full Width Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#232330] bg-[#101017] text-[11px] font-bold uppercase tracking-wider text-[#82829e]">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-52">Output Filename</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Signature Source (Drive Link or Photo)</th>
                  <th className="py-3 px-4 text-center">Transparent PNG Preview</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20202c]">
                {paginatedItems.map((item) => {
                  const isProcessing = item.status === "loading";
                  const isReady = item.status === "ready";
                  const hasEmbedded = !!item.embeddedImage;
                  const hasLocalPhoto = !!item.localFile;
                  const hasLink = !!item.esignLink?.trim() || !!item.driveId;
                  const hasSource = hasEmbedded || hasLocalPhoto || hasLink;

                  return (
                    <tr
                      key={item.index}
                      className="hover:bg-[#1a1a24] transition-colors"
                    >
                      {/* Index */}
                      <td className="py-3.5 px-4 font-mono text-[#666680] text-center">
                        {item.index + 1}
                      </td>

                      {/* Output Filename (strictly firstname + lastname ONLY) */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.filename.replace(/\.png$/i, "")}
                            onChange={(e) =>
                              handleFilenameChange(item.index, e.target.value)
                            }
                            className="bg-transparent hover:bg-[#1a1a26] focus:bg-[#0c0c11] border border-transparent hover:border-[#2f2f42] focus:border-purple-500 rounded px-1.5 py-0.5 font-bold text-slate-100 outline-none w-40 transition"
                          />
                          <span className="rounded bg-[#1e1e2b] px-1 py-0.5 text-[10px] text-purple-300 font-semibold">
                            .png
                          </span>
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {item.fullName}
                      </td>

                      {/* Signature Source: Excel Embedded, GDrive Link, or Attached Photo */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {hasEmbedded ? (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-1.5 rounded-xl bg-purple-950/40 border border-purple-500/40 px-2.5 py-1 text-[11px] text-purple-300">
                                <Sparkles className="h-3 w-3 text-purple-400" />
                                <span className="font-semibold text-white">Excel Photo</span>
                                <span className="text-[10px] text-purple-400/80 font-mono">
                                  ({item.embeddedImage?.name})
                                </span>
                              </div>
                              <label className="text-[10px] text-[#7d7d9b] hover:text-purple-300 cursor-pointer transition">
                                [Replace]
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachPhoto(item.index, f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : hasLocalPhoto ? (
                            <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-300">
                              <Camera className="h-3 w-3 text-emerald-400" />
                              <span className="truncate max-w-[160px] font-mono">
                                {item.localFile?.name}
                              </span>
                              <label className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer underline ml-1">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachPhoto(item.index, f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : hasLink ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={item.esignLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 truncate max-w-xs transition"
                                title={item.esignLink}
                              >
                                <span className="truncate">{item.esignLink}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                              <label className="text-[10px] text-[#7d7d9b] hover:text-purple-300 cursor-pointer transition">
                                [Or Upload Photo]
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachPhoto(item.index, f);
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 px-3 py-1 text-xs font-semibold text-purple-300 transition cursor-pointer">
                                <UploadCloud className="h-3.5 w-3.5" />
                                <span>Upload Photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleAttachPhoto(item.index, f);
                                  }}
                                />
                              </label>
                              <span className="text-[10px] text-[#666680]">or</span>
                              <input
                                type="text"
                                placeholder="Paste link..."
                                value={item.esignLink || ""}
                                onChange={(e) =>
                                  handleLinkChange(item.index, e.target.value)
                                }
                                className="rounded-lg bg-[#0c0c11] border border-[#2a2a3b] px-2 py-1 text-[11px] text-slate-100 placeholder-[#55556a] outline-none w-32 focus:border-purple-500"
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Transparent PNG Preview with Clean High-Contrast Checkerboard */}
                      <td className="py-3 px-4 text-center">
                        {isReady && item.previewUrl ? (
                          <div
                            className="inline-block p-1.5 rounded-xl border border-white/20 shadow-md max-w-[170px] max-h-16 overflow-hidden transition-transform hover:scale-105"
                            style={{
                              backgroundImage: `linear-gradient(45deg, #e4e6eb 25%, transparent 25%), linear-gradient(-45deg, #e4e6eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e6eb 75%), linear-gradient(-45deg, transparent 75%, #e4e6eb 75%)`,
                              backgroundSize: `10px 10px`,
                              backgroundPosition: `0 0, 0 5px, 5px -5px, -5px 0px`,
                              backgroundColor: `#ffffff`,
                            }}
                            title="Transparent PNG Preview (White and grey squares denote 100% transparent paper)"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.previewUrl}
                              alt={item.fullName}
                              className="max-h-12 w-auto object-contain mx-auto"
                            />
                          </div>
                        ) : isProcessing ? (
                          <div className="flex items-center justify-center gap-1.5 text-xs text-purple-300">
                            <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                            <span>Processing...</span>
                          </div>
                        ) : hasEmbedded && item.embeddedImage?.dataUrl ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className="p-0.5 rounded bg-white/5 border border-white/10 max-w-[120px] max-h-11 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.embeddedImage.dataUrl}
                                alt={item.fullName}
                                className="max-h-9 w-auto object-contain mx-auto"
                              />
                            </div>
                            <span className="text-[9px] text-[#8e8ea6]">Excel Photo</span>
                          </div>
                        ) : hasLocalPhoto && item.originalUrl ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <div className="p-0.5 rounded bg-white/5 border border-white/10 max-w-[120px] max-h-11 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.originalUrl}
                                alt={item.fullName}
                                className="max-h-9 w-auto object-contain mx-auto"
                              />
                            </div>
                            <span className="text-[9px] text-[#8e8ea6]">Raw Photo</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#55556a]">
                            Not processed
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isReady ? (
                          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3" />
                            Clean PNG
                          </div>
                        ) : item.status === "failed" ? (
                          <div
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/30"
                            title={item.error}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </div>
                        ) : hasEmbedded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                            Excel Photo
                          </span>
                        ) : hasLocalPhoto || hasLink ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/20">
                            Photo Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#1e1e2b] px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            No Photo
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isReady ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadSingle(item)}
                              className="inline-flex items-center gap-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 px-2.5 py-1 text-xs font-semibold text-purple-200 transition"
                              title="Download transparent PNG"
                            >
                              <Download className="h-3 w-3" />
                              <span>Save</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleProcessSingle(item.index)}
                              disabled={isProcessing || !hasSource}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#1e1e2b] hover:bg-[#282838] border border-[#2e2e40] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Extract</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#232330] bg-[#111118] px-5 py-3.5 text-xs text-[#8e8ea6]">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Showing{" "}
                <strong className="text-white font-mono">
                  {filteredItems.length === 0 ? 0 : startIndex + 1}
                </strong>{" "}
                to <strong className="text-white font-mono">{endIndex}</strong> of{" "}
                <strong className="text-white font-mono">{filteredItems.length}</strong>{" "}
                e-signatures
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[#666680]">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-lg bg-[#0c0c11] border border-[#262636] px-2 py-1 text-xs text-slate-200 outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8e8ea6] mr-1">
                Page <strong className="text-white font-mono">{safePage}</strong> of{" "}
                <strong className="text-white font-mono">{totalPages}</strong>
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={safePage <= 1}
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-[#262636] bg-[#0c0c11] text-slate-300 hover:text-white hover:bg-[#1a1a24] disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-[#262636] bg-[#0c0c11] text-slate-300 hover:text-white hover:bg-[#1a1a24] disabled:opacity-30 disabled:pointer-events-none transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
