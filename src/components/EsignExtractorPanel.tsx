"use client";

import React, { useState, useCallback, useMemo } from "react";
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
  FileSpreadsheet,
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

interface EsignExtractorPanelProps {
  initialRows?: CertRow[];
  onUploadSpreadsheet?: (file: File) => void;
}

function convertRowsToItems(rows: CertRow[]): EsignItem[] {
  return rows
    .filter((r) => r.esignLink && r.esignLink.trim().length > 0)
    .map((r, idx): EsignItem => {
      const driveId = extractGoogleDriveId(r.esignLink || "") || undefined;
      const cleanName = formatFilenameFromName(r.commonName, "firstlast");
      return {
        index: idx,
        fullName: r.commonName,
        filename: `${cleanName}.png`,
        esignLink: r.esignLink || "",
        driveId,
        status: "idle",
      };
    });
}

export function EsignExtractorPanel({
  initialRows = [],
  onUploadSpreadsheet,
}: EsignExtractorPanelProps) {
  // Settings for background removal
  const [threshold, setThreshold] = useState<number>(215);
  const [darkenInk, setDarkenInk] = useState<boolean>(true);
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Batch items state initialized from props
  const [items, setItems] = useState<EsignItem[]>(() =>
    convertRowsToItems(initialRows)
  );
  const [prevInitialRows, setPrevInitialRows] = useState(initialRows);

  // Idiomatic React pattern: Adjust state when props change during render
  if (initialRows !== prevInitialRows) {
    setPrevInitialRows(initialRows);
    const converted = convertRowsToItems(initialRows);
    if (converted.length > 0) {
      setItems(converted);
    }
  }

  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({
    current: 0,
    total: 0,
  });

  // Handle direct file upload in this tab
  const handleDropFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      onUploadSpreadsheet?.(file);
      const rowsWithLinks = parsed
        .filter((r) => r.esignLink && r.esignLink.trim().length > 0)
        .map((r, idx): EsignItem => {
          const driveId = extractGoogleDriveId(r.esignLink || "") || undefined;
          const cleanName = formatFilenameFromName(r.commonName, "firstlast");
          return {
            index: idx,
            fullName: r.commonName,
            filename: `${cleanName}.png`,
            esignLink: r.esignLink || "",
            driveId,
            status: "idle",
          };
        });

      if (rowsWithLinks.length === 0) {
        alert(
          "Spreadsheet imported, but no 'LINK FOR ESIGNATURE' column with valid links was found."
        );
      } else {
        setItems(rowsWithLinks);
        setCurrentPage(1);
      }
    } catch (err) {
      alert("Error reading spreadsheet: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Process a single row item
  const processItem = useCallback(
    async (item: EsignItem): Promise<EsignItem> => {
      try {
        const driveId = item.driveId || extractGoogleDriveId(item.esignLink);
        const proxyUrl = driveId
          ? `/api/proxy-image?id=${encodeURIComponent(driveId)}`
          : getProxyImageUrl(item.esignLink);

        const img = await loadImage(proxyUrl);
        const processed = await removeSignatureBackground(img, {
          threshold,
          darkenInk,
          autoCrop,
          padding: 16,
        });

        return {
          ...item,
          status: "ready",
          originalUrl: proxyUrl,
          previewUrl: processed.dataUrl,
          processedBlob: processed.blob,
          error: undefined,
        };
      } catch (err) {
        return {
          ...item,
          status: "failed",
          error: err instanceof Error ? err.message : "Failed to extract image",
        };
      }
    },
    [threshold, darkenInk, autoCrop]
  );

  // Process a specific row on demand
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
    if (items.length === 0 || isProcessingAll) return;
    setIsProcessingAll(true);
    setProcessingProgress({ current: 0, total: items.length });

    const updatedItems = [...items];
    for (let i = 0; i < updatedItems.length; i++) {
      const it = updatedItems[i];
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
      // Brief yield to keep UI responsive
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
      alert("No processed signatures ready for download yet. Please click 'Process All' first.");
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

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.fullName.toLowerCase().includes(q) ||
        it.filename.toLowerCase().includes(q) ||
        it.esignLink.toLowerCase().includes(q)
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

  return (
    <div className="space-y-6 w-full">
      {/* ── Control Header Bar ─────────────────────────────────────────── */}
      <div className="p-5 rounded-3xl bg-[#14141b] border border-[#232330] shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <FileImage className="h-4 w-4 text-purple-400" />
              E-Signature Extractor &amp; Background Cleaner
            </h3>
            {items.length > 0 && (
              <span className="rounded-md bg-[#1e1e2b] px-2 py-0.5 text-xs font-mono text-purple-300">
                {items.length} Signature Links
              </span>
            )}
          </div>
          <p className="text-xs text-[#8e8ea6] mt-0.5">
            Extracts images from Google Drive, isolates pure signature ink, and converts to transparent PNGs.
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

          <button
            type="button"
            onClick={handleProcessAll}
            disabled={items.length === 0 || isProcessingAll}
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
              onChange={handleDropFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ── Settings Drawer ────────────────────────────────────────────── */}
      {showSettings && (
        <div className="p-5 rounded-3xl bg-[#171722] border border-[#262638] shadow-lg space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              Background Removal &amp; Ink Enhancement Configuration
            </span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-[#7d7d9b] hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* 1. Threshold slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span>Background Cutoff Threshold:</span>
                <span className="font-mono text-purple-400 font-bold">{threshold}</span>
              </div>
              <input
                type="range"
                min={140}
                max={245}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <p className="text-[11px] text-[#7d7d9b]">
                Higher values remove fainter paper texture; lower values preserve softer edges.
              </p>
            </div>

            {/* 2. Ink Enhancement */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={darkenInk}
                  onChange={(e) => setDarkenInk(e.target.checked)}
                  className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-semibold">Deepen / Enhance Pen Ink</span>
              </label>
              <p className="text-[11px] text-[#7d7d9b]">
                Intelligently boosts contrast so faint or thin signatures appear rich and crisp.
              </p>
            </div>

            {/* 3. Auto Crop */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.target.checked)}
                  className="rounded accent-purple-600 h-4 w-4 cursor-pointer"
                />
                <span className="font-semibold">Auto-Crop Padding (16px)</span>
              </label>
              <p className="text-[11px] text-[#7d7d9b]">
                Crops out excess white paper margins around the signature automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#14141b] border border-[#232330] shadow-xl space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-slate-100">
              No E-Signature Links Detected
            </h4>
            <p className="text-xs text-[#8e8ea6]">
              Upload an Excel or CSV file containing a{" "}
              <code className="text-purple-300 bg-[#1e1e2b] px-1 py-0.5 rounded font-mono">
                LINK FOR ESIGNATURE (GOOGLE DRIVE LINK)
              </code>{" "}
              column to begin extracting transparent signatures.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-purple-950/40">
            <UploadCloud className="h-4 w-4" />
            <span>Select Excel / CSV File</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleDropFile}
              className="hidden"
            />
          </label>
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

            <div className="flex items-center gap-2 text-xs text-[#8e8ea6]">
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
                  <th className="py-3 px-4 w-56">Output Filename</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Google Drive Link</th>
                  <th className="py-3 px-4 text-center">Transparent PNG Preview</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#20202c]">
                {paginatedItems.map((item) => {
                  const isProcessing = item.status === "loading";
                  const isReady = item.status === "ready";

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
                            className="bg-transparent hover:bg-[#1a1a26] focus:bg-[#0c0c11] border border-transparent hover:border-[#2f2f42] focus:border-purple-500 rounded px-1.5 py-0.5 font-bold text-slate-100 outline-none w-44 transition"
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

                      {/* Google Drive Link */}
                      <td className="py-3.5 px-4">
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
                      </td>

                      {/* Transparent PNG Preview with Checkerboard */}
                      <td className="py-3 px-4 text-center">
                        {isReady && item.previewUrl ? (
                          <div
                            className="inline-block p-1 rounded-lg border border-[#2a2a3c] shadow-sm max-w-[160px] max-h-14 overflow-hidden"
                            style={{
                              backgroundImage: `linear-gradient(45deg, #1c1c28 25%, transparent 25%), linear-gradient(-45deg, #1c1c28 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1c1c28 75%), linear-gradient(-45deg, transparent 75%, #1c1c28 75%)`,
                              backgroundSize: `10px 10px`,
                              backgroundPosition: `0 0, 0 5px, 5px -5px, -5px 0px`,
                              backgroundColor: `#12121a`,
                            }}
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
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#1e1e2b] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                            Ready
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
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 rounded-xl bg-[#1e1e2b] hover:bg-[#282838] border border-[#2e2e40] px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white transition disabled:opacity-40"
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
