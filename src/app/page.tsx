"use client";

import React, { useState, useCallback } from "react";
import {
  FileSpreadsheet,
  Download,
  PackageOpen,
  PenSquare,
  ShieldAlert,
  Plus,
  X,
  Trash2,
  Dices,
  FileImage,
} from "lucide-react";

import { DropZone } from "@/components/DropZone";
import { DataPreviewTable } from "@/components/DataPreviewTable";
import { ProgressModal } from "@/components/ProgressModal";
import { CAUploadPanel } from "@/components/CAUploadPanel";
import { ManualCertForm } from "@/components/ManualCertForm";
import { EsignExtractorPanel } from "@/components/EsignExtractorPanel";

import { parseExcelFile } from "@/lib/excelParser";
import { generateP12, generateBatch } from "@/lib/certGenerator";
import { downloadSampleTemplate, DEMO_ROWS } from "@/lib/templateGenerator";
import { downloadAllAsZip, downloadSingle } from "@/lib/zipBundler";
import { formatFilenameFromName, type FilenameFormat } from "@/lib/nameFormatter";

import type {
  CertRow,
  GenerationResult,
  GenerationProgress,
  CACredentials,
} from "@/types";

const IDLE_PROGRESS: GenerationProgress = {
  current: 0,
  total: 0,
  currentName: "",
  status: "idle",
  results: [],
};

export default function Home() {
  // Tabs: "manual" (default matching reference) | "batch" | "esign" | "ca"
  const [activeTab, setActiveTab] = useState<"manual" | "batch" | "esign" | "ca">("manual");

  // Batch state
  const [rows, setRows] = useState<CertRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [progress, setProgress] = useState<GenerationProgress>(IDLE_PROGRESS);
  const [showProgress, setShowProgress] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

  // CA state
  const [signingMode, setSigningMode] = useState<"self" | "ca">("self");
  const [caCredentials, setCaCredentials] = useState<CACredentials | null>(null);

  // Filename format: default "firstlast" (firstname + lastname directly, e.g. alilylipio)
  const [filenameFormat, setFilenameFormat] = useState<FilenameFormat>("firstlast");

  // Bulk password state
  const [bulkPassword, setBulkPassword] = useState("City@Accounting2026");

  // Quick Add Row Modal state
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [newCommonName, setNewCommonName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newLocality, setNewLocality] = useState("");
  const [newCountry, setNewCountry] = useState("PH");
  const [newValidity, setNewValidity] = useState(10950);

  // Derived
  const validRows = rows.filter((r) => r.errors.length === 0);
  const emptyPasswordCount = rows.filter((r) => !r.p12Password.trim()).length;
  const hasRows = rows.length > 0;
  const hasValidRows = validRows.length > 0;
  const isBusy = progress.status === "running";
  const successResults = results.filter((r) => r.success);

  // File import
  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setResults([]);
      setProgress(IDLE_PROGRESS);
      try {
        const parsed = await parseExcelFile(file, undefined, filenameFormat);
        setRows(parsed);
        setActiveTab("batch");
      } catch (err) {
        alert("Error reading spreadsheet: " + (err instanceof Error ? err.message : String(err)));
      }
    },
    [filenameFormat]
  );

  const handleLoadDemo = useCallback(() => {
    setFileName("sample_certificates.xlsx");
    setResults([]);
    setProgress(IDLE_PROGRESS);
    setRows(DEMO_ROWS);
    setActiveTab("batch");
  }, []);

  const handleReset = () => {
    setRows([]);
    setFileName("");
    setResults([]);
    setProgress(IDLE_PROGRESS);
    setShowProgress(false);
    setGeneratingIndex(null);
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((r) => r.index !== index));
    setResults((prev) => prev.filter((r) => r.index !== index));
  };

  const handleUpdatePassword = (index: number, newPass: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.index !== index) return r;
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("password"));
        if (!newPass.trim()) errors.push("Password is required");
        return { ...r, p12Password: newPass, errors };
      })
    );
  };

  const handleUpdateFilename = (index: number, newFilename: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.index !== index) return r;
        const clean = newFilename.trim().replace(/\.p12$/i, "");
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("file"));
        if (!clean) errors.push("File Name is required");
        return { ...r, filename: clean, errors };
      })
    );
  };

  const handleUpdateValidity = (index: number, days: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.index !== index) return r;
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("validity"));
        if (days <= 0) errors.push("Validity must be at least 1 day");
        return { ...r, validityDays: days, errors };
      })
    );
  };

  const handleReformatFilenames = (format: FilenameFormat) => {
    setFilenameFormat(format);
    setRows((prev) =>
      prev.map((r) => {
        if (!r.commonName) return r;
        const formatted = formatFilenameFromName(r.commonName, format);
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("file"));
        return { ...r, filename: formatted, errors };
      })
    );
  };

  const handleApplyBulkPassword = () => {
    if (!bulkPassword.trim()) {
      alert("Please enter a password to apply.");
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        if (r.p12Password.trim()) return r;
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("password"));
        return { ...r, p12Password: bulkPassword, errors };
      })
    );
  };

  const handleGenerateRandomPasswordsForEmpty = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    const gen = () => {
      let p = "";
      for (let i = 0; i < 12; i++) {
        p += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return p;
    };
    setRows((prev) =>
      prev.map((r) => {
        if (r.p12Password.trim()) return r;
        const errors = r.errors.filter((e) => !e.toLowerCase().includes("password"));
        return { ...r, p12Password: gen(), errors };
      })
    );
  };

  const handleAddManualRow = (row: CertRow) => {
    setRows((prev) => [...prev, { ...row, index: prev.length }]);
    if (!fileName) setFileName("manual_batch.xlsx");
  };

  const handleCreateRowFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilename.trim() || !newCommonName.trim() || !newPassword.trim()) {
      alert("Please enter File Name, Common Name, and Password.");
      return;
    }
    const cleanFilename = newFilename.trim().replace(/\.p12$/i, "");
    handleAddManualRow({
      index: rows.length,
      filename: cleanFilename,
      commonName: newCommonName.trim(),
      p12Password: newPassword,
      email: newEmail.trim() || undefined,
      organization: newOrg.trim() || undefined,
      locality: newLocality.trim() || undefined,
      country: newCountry.trim().toUpperCase() || undefined,
      validityDays: newValidity,
      errors: [],
    });
    setNewFilename("");
    setNewCommonName("");
    setNewPassword("");
    setNewEmail("");
    setNewOrg("");
    setNewLocality("");
    setShowAddRowModal(false);
  };

  // Generate single .p12 from table
  const handleGenerateSingle = useCallback(
    async (row: CertRow) => {
      setGeneratingIndex(row.index);
      try {
        const data = await generateP12(
          row,
          signingMode === "ca" && caCredentials ? caCredentials : undefined
        );
        const result: GenerationResult = {
          index: row.index,
          filename: row.filename,
          success: true,
          data,
        };
        setResults((prev) => {
          const filtered = prev.filter((r) => r.index !== row.index);
          return [...filtered, result];
        });
        downloadSingle(result);
      } catch (err) {
        setResults((prev) => {
          const filtered = prev.filter((r) => r.index !== row.index);
          return [
            ...filtered,
            {
              index: row.index,
              filename: row.filename,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            },
          ];
        });
      } finally {
        setGeneratingIndex(null);
      }
    },
    [signingMode, caCredentials]
  );

  // Generate all .p12 batch
  const handleGenerateAll = useCallback(async () => {
    if (!hasValidRows || isBusy) return;
    if (signingMode === "ca" && !caCredentials) {
      alert("Please upload and unlock your CA certificate before generating.");
      setActiveTab("ca");
      return;
    }

    const initial: GenerationProgress = {
      current: 0,
      total: validRows.length,
      currentName: "",
      status: "running",
      results: [],
    };
    setProgress(initial);
    setShowProgress(true);
    setResults([]);

    const batchResults = await generateBatch(
      validRows,
      (current, name) => {
        setProgress((prev) => ({ ...prev, current, currentName: name }));
        const row = validRows[current - 1];
        if (row) setGeneratingIndex(row.index);
      },
      signingMode === "ca" && caCredentials ? caCredentials : undefined
    );

    setGeneratingIndex(null);
    setResults(batchResults);
    setProgress({
      current: validRows.length,
      total: validRows.length,
      currentName: "",
      status: "done",
      results: batchResults,
    });

    const successful = batchResults.filter((r) => r.success && r.data);
    if (successful.length > 0) {
      try {
        await downloadAllAsZip(batchResults);
      } catch {
        // user can trigger re-download manually
      }
    }
  }, [hasValidRows, isBusy, validRows, signingMode, caCredentials]);

  const handleDownloadZip = useCallback(async () => {
    try {
      await downloadAllAsZip(results);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [results]);

  const handleDownloadSingle = useCallback((result: GenerationResult) => {
    try {
      downloadSingle(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col dark-canvas text-slate-100 antialiased selection:bg-purple-500/30 selection:text-purple-200">
      {/* Progress Dialog during batch generation */}
      {showProgress && progress.status !== "idle" && (
        <ProgressModal
          progress={progress}
          onClose={() => setShowProgress(false)}
          onDownloadZip={successResults.length > 0 ? handleDownloadZip : undefined}
        />
      )}

      {/* Modal: Quick Add Single Row to Batch Table */}
      {showAddRowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowAddRowModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-[#14141b] border border-[#2b2b3b] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-100">Add Certificate to Table</h3>
              <button
                type="button"
                onClick={() => setShowAddRowModal(false)}
                className="text-[#7d7d9b] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRowFromModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  File Base Name <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs">
                  <input
                    type="text"
                    value={newFilename}
                    onChange={(e) => setNewFilename(e.target.value)}
                    placeholder="e.g. cruz"
                    className="w-full bg-transparent outline-none text-slate-100"
                    required
                  />
                  <span className="text-[#666680] font-mono">.p12</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Common Name / Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newCommonName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCommonName(val);
                    if (!newFilename.trim()) {
                      setNewFilename(formatFilenameFromName(val, filenameFormat));
                    }
                  }}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  P12 Password <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs font-mono text-slate-100 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. juandelacruz@email.com"
                  className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    placeholder="e.g. Infosoft Studio"
                    className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Locality / City
                  </label>
                  <input
                    type="text"
                    value={newLocality}
                    onChange={(e) => setNewLocality(e.target.value)}
                    placeholder="e.g. Davao"
                    className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Country Code
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                    className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Validity Days
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newValidity}
                    onChange={(e) => setNewValidity(parseInt(e.target.value, 10) || 10950)}
                    className="w-full rounded-xl bg-[#0c0c11] border border-[#272736] px-3 py-2 text-xs text-slate-100 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] py-2.5 text-xs font-bold uppercase tracking-wider text-white transition"
                >
                  Add Row
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddRowModal(false)}
                  className="rounded-xl bg-[#1e1e2b] py-2.5 px-4 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Minimal Centered Mode Switcher ─────────────────────────────────── */}
      <nav className="pt-8 pb-2 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-2xl bg-[#14141b] p-1 border border-[#242432] text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={[
              "flex items-center gap-1.5 rounded-xl py-2 px-4 font-semibold transition",
              activeTab === "manual"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/40"
                : "text-[#8d8da8] hover:text-white",
            ].join(" ")}
          >
            <PenSquare className="h-4 w-4" />
            <span>Single Certificate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={[
              "flex items-center gap-1.5 rounded-xl py-2 px-4 font-semibold transition",
              activeTab === "batch"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/40"
                : "text-[#8d8da8] hover:text-white",
            ].join(" ")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Batch (Excel)</span>
            {hasRows && (
              <span className="rounded-full bg-purple-400/20 px-1.5 py-0.2 font-mono text-[10px] text-purple-200">
                {rows.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("esign")}
            className={[
              "flex items-center gap-1.5 rounded-xl py-2 px-4 font-semibold transition",
              activeTab === "esign"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/40"
                : "text-[#8d8da8] hover:text-white",
            ].join(" ")}
          >
            <FileImage className="h-4 w-4" />
            <span>E-Sign Extractor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ca")}
            className={[
              "flex items-center gap-1.5 rounded-xl py-2 px-4 font-semibold transition",
              activeTab === "ca"
                ? "bg-amber-500 text-slate-950 shadow-md font-bold"
                : "text-[#8d8da8] hover:text-white",
            ].join(" ")}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>CA Settings</span>
            {caCredentials && (
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </nav>

      {/* ── Main Stage ────────────────────────────────────────────────────── */}
      <main
        className={`mx-auto w-full flex-1 py-6 sm:py-8 space-y-7 transition-all duration-300 ${
          (activeTab === "batch" && hasRows) || activeTab === "esign"
            ? "max-w-[1700px] px-4 sm:px-8 xl:px-12"
            : "max-w-4xl px-4 sm:px-6"
        }`}
      >
        {/* Centered Hero Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Tamad Tips
          </h1>
          <p className="text-xs sm:text-sm text-[#8c8ca5] leading-relaxed">
            All-in-one automation toolkit for fast-track workflows: generate secure PKCS#12 (`.p12`) certificates and extract pure transparent e-signatures instantly.
          </p>
        </div>

        {/* ── TAB 1: MANUAL SINGLE GENERATOR (Matches user reference) ──────── */}
        {activeTab === "manual" && (
          <ManualCertForm
            signingMode={signingMode}
            caCredentials={caCredentials}
          />
        )}

        {/* ── TAB 2: AUTO BATCH FROM EXCEL / CSV ──────────────────────────── */}
        {activeTab === "batch" && (
          <div className="space-y-6">
            {!hasRows ? (
              <DropZone
                onFile={handleFile}
                onLoadDemo={handleLoadDemo}
                onDownloadTemplate={downloadSampleTemplate}
                disabled={isBusy}
              />
            ) : (
              /* Active Batch Deck */
              <div className="space-y-5">
                {/* Clean Batch Control Bar */}
                <div className="p-5 rounded-3xl bg-[#14141b] border border-[#232330] shadow-xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-100 font-mono">
                        {fileName}
                      </h3>
                      <span className="rounded-md bg-[#1e1e2b] px-2 py-0.5 text-xs text-slate-300">
                        {rows.length} Rows
                      </span>
                    </div>
                    <p className="text-xs text-[#8e8ea6] mt-0.5">
                      {validRows.length} valid ·{" "}
                      {signingMode === "ca" && caCredentials
                        ? "CA Mode"
                        : "Self-Signed"}
                    </p>
                  </div>

                  {/* Batch Action Buttons */}
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleGenerateAll}
                      disabled={!hasValidRows || isBusy}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] py-3 px-5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-950/50 transition disabled:opacity-40"
                    >
                      <PackageOpen className="h-4 w-4" />
                      Generate &amp; Download .ZIP
                    </button>

                    {successResults.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDownloadZip}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e40] bg-[#1e1e2b] hover:bg-[#282838] py-3 px-4 text-xs font-semibold text-slate-200 transition"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Re-download .ZIP
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowAddRowModal(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#2e2e40] bg-[#1e1e2b] hover:bg-[#282838] py-3 px-4 text-xs font-semibold text-slate-200 transition"
                    >
                      <Plus className="h-3.5 w-3.5 text-purple-400" />
                      Add Row
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#232330] bg-[#14141b] hover:bg-[#1f1f2b] p-3 text-xs text-[#8e8ea6] hover:text-red-400 transition"
                      title="Clear / Upload New File"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Filename Format Switcher Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[#8e8ea6] text-xs">Filename format (Firstname + Lastname):</span>
                    <div className="inline-flex items-center rounded-xl bg-[#14141b] border border-[#232330] p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => handleReformatFilenames("firstlast")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          filenameFormat === "firstlast"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-[#8e8ea6] hover:text-white"
                        }`}
                      >
                        firstlast <span className="opacity-60 text-[10px]">(e.g. alilylipio)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReformatFilenames("first_last")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          filenameFormat === "first_last"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-[#8e8ea6] hover:text-white"
                        }`}
                      >
                        first_last <span className="opacity-60 text-[10px]">(e.g. alily_lipio)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReformatFilenames("first.last")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                          filenameFormat === "first.last"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-[#8e8ea6] hover:text-white"
                        }`}
                      >
                        first.last <span className="opacity-60 text-[10px]">(e.g. alily.lipio)</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password helper bar if passwords are missing */}
                {emptyPasswordCount > 0 && (
                  <div className="p-4 rounded-2xl bg-[#1c142c] border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="font-semibold text-purple-300">
                        {emptyPasswordCount} row{emptyPasswordCount !== 1 ? "s" : ""} missing password:
                      </span>
                      <span className="text-[#8e8ea6]">Set a password for empty rows:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={bulkPassword}
                        onChange={(e) => setBulkPassword(e.target.value)}
                        placeholder="Password..."
                        className="rounded-xl bg-[#0c0c11] border border-[#2e2e40] px-3 py-1.5 text-xs text-slate-100 outline-none font-mono focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBulkPassword}
                        className="rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 transition"
                      >
                        Apply to All Empty
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPasswordsForEmpty}
                        className="inline-flex items-center gap-1 rounded-xl bg-[#1e1e2b] hover:bg-[#282838] border border-[#2e2e40] text-purple-300 font-semibold px-3 py-1.5 transition"
                      >
                        <Dices className="h-3.5 w-3.5" />
                        Random Passwords
                      </button>
                    </div>
                  </div>
                )}

                {/* Table */}
                <DataPreviewTable
                  rows={rows}
                  results={results}
                  onGenerateSingle={handleGenerateSingle}
                  onDownloadSingle={handleDownloadSingle}
                  onDeleteRow={handleDeleteRow}
                  onUpdatePassword={handleUpdatePassword}
                  onUpdateFilename={handleUpdateFilename}
                  onUpdateValidity={handleUpdateValidity}
                  generatingIndex={generatingIndex}
                />
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: E-SIGN EXTRACTOR & BACKGROUND CLEANER ─────────────────── */}
        {activeTab === "esign" && <EsignExtractorPanel />}

        {/* ── TAB 4: CUSTOM CA SETTINGS ────────────────────────────────────── */}
        {activeTab === "ca" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="p-6 rounded-3xl bg-[#14141b] border border-[#232330] space-y-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                Signing Authority
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSigningMode("self")}
                  className={[
                    "p-4 rounded-2xl border text-left transition",
                    signingMode === "self"
                      ? "border-purple-500 bg-purple-500/15"
                      : "border-[#232330] bg-[#0c0c11] hover:border-[#353545]",
                  ].join(" ")}
                >
                  <p className="text-xs font-bold text-slate-100">Self-Signed (Default)</p>
                  <p className="text-[11px] text-[#8e8ea6] mt-1">
                    Each certificate signs itself with its own keypair.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSigningMode("ca")}
                  className={[
                    "p-4 rounded-2xl border text-left transition",
                    signingMode === "ca"
                      ? "border-amber-500 bg-amber-500/15"
                      : "border-[#232330] bg-[#0c0c11] hover:border-[#353545]",
                  ].join(" ")}
                >
                  <p className="text-xs font-bold text-slate-100">Custom CA Authority</p>
                  <p className="text-[11px] text-[#8e8ea6] mt-1">
                    Upload your CA certificate &amp; key to sign all certs.
                  </p>
                </button>
              </div>
            </div>

            {signingMode === "ca" && (
              <CAUploadPanel
                credentials={caCredentials}
                onCredentials={setCaCredentials}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
