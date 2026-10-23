"use client";

import React, { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Download,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { CertRow, GenerationResult } from "@/types";

interface DataPreviewTableProps {
  rows: CertRow[];
  results: GenerationResult[];
  onGenerateSingle?: (row: CertRow) => void;
  onDownloadSingle: (result: GenerationResult) => void;
  onDeleteRow?: (index: number) => void;
  onUpdatePassword?: (index: number, newPass: string) => void;
  onUpdateFilename?: (index: number, newFilename: string) => void;
  onUpdateValidity?: (index: number, days: number) => void;
  generatingIndex: number | null;
}

export function DataPreviewTable({
  rows,
  results,
  onDownloadSingle,
  onDeleteRow,
  onUpdatePassword,
  onUpdateFilename,
  onUpdateValidity,
  generatingIndex,
}: DataPreviewTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "valid" | "errors" | "done">("all");
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  const handleFilterChange = (mode: "all" | "valid" | "errors" | "done") => {
    setFilterMode(mode);
    setCurrentPage(1);
  };

  const resultMap = useMemo(
    () => new Map(results.map((r) => [r.index, r])),
    [results]
  );

  const toggleReveal = (idx: number) => {
    setRevealedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const copyPassword = (text: string, idx: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => {
      setCopiedIndex((cur) => (cur === idx ? null : cur));
    }, 1500);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const res = resultMap.get(row.index);
      const hasErrors = row.errors.length > 0;

      if (filterMode === "valid" && hasErrors) return false;
      if (filterMode === "errors" && !hasErrors) return false;
      if (filterMode === "done" && (!res || !res.success)) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.filename.toLowerCase().includes(q) ||
        row.commonName.toLowerCase().includes(q) ||
        (row.organization && row.organization.toLowerCase().includes(q)) ||
        (row.locality && row.locality.toLowerCase().includes(q)) ||
        (row.email && row.email.toLowerCase().includes(q))
      );
    });
  }, [rows, resultMap, filterMode, searchQuery]);

  // Total pages and safe page
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  // Paginated rows for the current page
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredRows.length);
  const paginatedRows = useMemo(() => {
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, startIndex, endIndex]);

  return (
    <div className="flex flex-col w-full rounded-3xl border border-[#232330] bg-[#14141b] shadow-2xl overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232330] bg-[#171720] p-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#686882]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search name, file, locality..."
            className="w-full rounded-xl border border-[#2a2a3b] bg-[#0c0c11] pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-[#5e5e78] outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-xl bg-[#0c0c11] p-1 border border-[#262636] text-xs">
          {(
            [
              { id: "all", label: `All (${rows.length})` },
              {
                id: "valid",
                label: `Ready (${rows.filter((r) => r.errors.length === 0).length})`,
              },
              {
                id: "errors",
                label: `Errors (${rows.filter((r) => r.errors.length > 0).length})`,
              },
              {
                id: "done",
                label: `Done (${results.filter((r) => r.success).length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id)}
              className={[
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition",
                filterMode === tab.id
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Full Width Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#232330] bg-[#101017] text-[11px] font-bold uppercase tracking-wider text-[#82829e]">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">File Name</th>
              <th className="py-3 px-4">Certificate Name (CN)</th>
              <th className="py-3 px-4">Password</th>
              <th className="py-3 px-4">Organization &amp; Locality</th>
              <th className="py-3 px-4 w-32">Validity</th>
              <th className="py-3 px-4 w-24">Status</th>
              <th className="py-3 px-4 w-16 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#20202c]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#6e6e8a]">
                  No certificate rows match your current filter.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const result = resultMap.get(row.index);
                const isGenerating = generatingIndex === row.index;
                const hasErrors = row.errors.length > 0;
                const revealed = revealedRows.has(row.index);
                const isCopied = copiedIndex === row.index;

                return (
                  <tr
                    key={row.index}
                    className={[
                      "transition-colors",
                      hasErrors
                        ? "bg-red-950/20 hover:bg-red-950/30"
                        : result?.success
                        ? "bg-purple-950/20 hover:bg-purple-950/30"
                        : "hover:bg-[#1a1a24]",
                    ].join(" ")}
                  >
                    {/* Index */}
                    <td className="py-3.5 px-4 font-mono text-[#666680] text-center">
                      {row.index + 1}
                    </td>

                    {/* Filename */}
                    <td className="py-3.5 px-4 font-mono">
                      {row.filename ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.filename}
                            onChange={(e) =>
                              onUpdateFilename?.(row.index, e.target.value)
                            }
                            title="Click to edit filename"
                            className="bg-transparent hover:bg-[#1a1a26] focus:bg-[#0c0c11] border border-transparent hover:border-[#2f2f42] focus:border-purple-500 rounded px-1.5 py-0.5 font-bold text-slate-100 outline-none w-40 transition"
                          />
                          <span className="rounded bg-[#1e1e2b] px-1 py-0.5 text-[10px] text-slate-400">
                            .p12
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 font-sans">
                          <AlertTriangle className="h-3 w-3" /> Missing Filename
                        </span>
                      )}
                    </td>

                    {/* Common Name */}
                    <td className="py-3.5 px-4">
                      {row.commonName ? (
                        <div>
                          <p className="font-semibold text-slate-100">
                            {row.commonName}
                          </p>
                          {row.email && (
                            <p className="text-[11px] text-[#7d7d9b]">
                              {row.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400">
                          <AlertTriangle className="h-3 w-3" /> Missing Name
                        </span>
                      )}
                    </td>

                    {/* Password */}
                    <td className="py-3.5 px-4">
                      {row.p12Password ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-200">
                            {revealed ? row.p12Password : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleReveal(row.index)}
                            className="text-[#686884] hover:text-slate-200 transition"
                            title={revealed ? "Hide password" : "Show password"}
                          >
                            {revealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyPassword(row.p12Password, row.index)}
                            className="text-[#686884] hover:text-slate-200 transition"
                            title="Copy password"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Enter password..."
                            onChange={(e) =>
                              onUpdatePassword?.(row.index, e.target.value)
                            }
                            className="rounded-lg bg-[#0c0c11] border border-red-500/50 px-2 py-1 text-xs text-slate-100 placeholder-[#7d7d9b] outline-none w-36 font-mono focus:border-purple-500"
                          />
                        </div>
                      )}
                    </td>

                    {/* Org & Locality */}
                    <td className="py-3.5 px-4">
                      {row.organization || row.locality || row.country ? (
                        <div>
                          <p className="text-slate-300">
                            {row.organization || "—"}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#7d7d9b]">
                            {row.locality && <span>{row.locality}</span>}
                            {row.country && (
                              <span className="rounded bg-[#1e1e2b] px-1 font-mono text-[10px] text-slate-300">
                                {row.country}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#55556a]">—</span>
                      )}
                    </td>

                    {/* Validity Input Field */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          max={36500}
                          value={row.validityDays}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            onUpdateValidity?.(row.index, isNaN(val) ? 365 : val);
                          }}
                          className="w-20 rounded-lg bg-[#0c0c11] border border-[#2a2a3b] hover:border-[#3d3d52] focus:border-purple-500 px-2.5 py-1 text-xs font-mono text-slate-100 outline-none transition text-center"
                        />
                        <span className="text-[11px] text-[#7d7d9b]">days</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {hasErrors ? (
                        <div className="space-y-0.5">
                          {row.errors.map((err, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1 text-[11px] font-medium text-red-400"
                            >
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              <span>{err}</span>
                            </div>
                          ))}
                        </div>
                      ) : result ? (
                        result.success ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Created
                          </div>
                        ) : (
                          <div
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-red-400 border border-red-500/30"
                            title={result.error}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Failed
                          </div>
                        )
                      ) : isGenerating ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 px-2.5 py-1 text-[11px] font-bold text-purple-300 border border-purple-500/30">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Creating...
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#1e1e2b] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          Ready
                        </span>
                      )}
                    </td>

                    {/* Action (Create button removed!) */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {result?.success && (
                          <button
                            type="button"
                            onClick={() => onDownloadSingle(result)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition"
                            title="Download this .p12"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Save</span>
                          </button>
                        )}

                        {onDeleteRow && (
                          <button
                            type="button"
                            onClick={() => onDeleteRow(row.index)}
                            className="text-[#686884] hover:text-red-400 p-1.5 rounded-lg hover:bg-[#1f1f2c] transition"
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#232330] bg-[#111118] px-5 py-3.5 text-xs text-[#8e8ea6]">
        {/* Left: Records info & Page size */}
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Showing <strong className="text-white font-mono">{filteredRows.length === 0 ? 0 : startIndex + 1}</strong> to <strong className="text-white font-mono">{endIndex}</strong> of <strong className="text-white font-mono">{filteredRows.length}</strong> certificates
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

        {/* Right: Page Navigation */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#8e8ea6] mr-1">
            Page <strong className="text-white font-mono">{safePage}</strong> of <strong className="text-white font-mono">{totalPages}</strong>
          </span>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={safePage <= 1}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-[#262636] bg-[#0c0c11] text-slate-300 hover:text-white hover:bg-[#1a1a24] disabled:opacity-30 disabled:pointer-events-none transition"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - safePage) <= 1
                );
              })
              .map((page, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && page - prev > 1;
                return (
                  <React.Fragment key={page}>
                    {showEllipsis && <span className="px-1 text-[#55556a]">...</span>}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 min-w-[32px] px-2 rounded-xl text-xs font-semibold transition ${
                        page === safePage
                          ? "bg-purple-600 text-white shadow-md shadow-purple-950/40"
                          : "bg-[#0c0c11] border border-[#262636] text-[#8e8ea6] hover:text-white hover:bg-[#1a1a24]"
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={safePage >= totalPages}
            className="flex items-center justify-center h-8 w-8 rounded-xl border border-[#262636] bg-[#0c0c11] text-slate-300 hover:text-white hover:bg-[#1a1a24] disabled:opacity-30 disabled:pointer-events-none transition"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
