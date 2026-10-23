"use client";

import React, { useState } from "react";
import {
  FileText,
  Lock,
  User,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  Map,
  Flag,
  Calendar,
  Download,
  Dices,
  Eye,
  EyeOff,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { CertRow, CACredentials } from "@/types";
import { generateP12 } from "@/lib/certGenerator";
import { downloadSingle } from "@/lib/zipBundler";
import { formatFilenameFromName } from "@/lib/nameFormatter";

interface ManualCertFormProps {
  signingMode: "self" | "ca";
  caCredentials: CACredentials | null;
}

export function ManualCertForm({
  signingMode,
  caCredentials,
}: ManualCertFormProps) {
  const [filename, setFilename] = useState("");
  const [filenameCustomized, setFilenameCustomized] = useState(false);
  const [password, setPassword] = useState("");
  const [commonName, setCommonName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [orgUnit, setOrgUnit] = useState("");
  const [locality, setLocality] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("PH");
  const [validityDays, setValidityDays] = useState(10950);

  const [showPassword, setShowPassword] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Success state after creation
  const [createdInfo, setCreatedInfo] = useState<{
    filename: string;
    commonName: string;
    password: string;
  } | null>(null);

  // Helper to generate a strong random password
  const handleGeneratePassword = () => {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 14; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
  };

  const copyPassword = () => {
    if (!createdInfo?.password) return;
    navigator.clipboard.writeText(createdInfo.password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Validation
  const errors: string[] = [];
  if (!filename.trim()) errors.push("File Base Name is required");
  if (!password.trim()) {
    errors.push("P12 Password is required");
  } else if (password.length < 6) {
    errors.push("P12 Password must be at least 6 characters");
  }
  if (!commonName.trim()) errors.push("Common Name / Full Name is required");
  if (country.trim() && country.trim().length !== 2) {
    errors.push("Country Code must be 2 characters (e.g. PH, US)");
  }
  if (!validityDays || validityDays <= 0) {
    errors.push("Validity Days must be at least 1 day");
  }

  // Generate & Download single .p12
  const handleGenerateAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errors.length > 0) {
      alert("Please fix the following:\n• " + errors.join("\n• "));
      return;
    }

    const cleanFilename = filename.trim().replace(/\.p12$/i, "");
    const row: CertRow = {
      index: 0,
      filename: cleanFilename,
      commonName: commonName.trim(),
      p12Password: password,
      organization: organization.trim() || undefined,
      orgUnit: orgUnit.trim() || undefined,
      locality: locality.trim() || undefined,
      state: state.trim() || undefined,
      country: country.trim().toUpperCase() || undefined,
      email: email.trim() || undefined,
      validityDays: Number(validityDays) || 10950,
      errors: [],
    };

    setIsGenerating(true);
    try {
      const data = await generateP12(
        row,
        signingMode === "ca" && caCredentials ? caCredentials : undefined
      );

      downloadSingle({
        index: 0,
        filename: cleanFilename,
        success: true,
        data,
      });

      setCreatedInfo({
        filename: `${cleanFilename}.p12`,
        commonName: commonName.trim(),
        password: password,
      });
    } catch (err) {
      alert("Error generating certificate: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Success Notification */}
      {createdInfo && (
        <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 shadow-lg text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-emerald-300 text-sm">
                  Certificate Generated &amp; Downloaded!
                </p>
                <p className="text-slate-300 mt-0.5">
                  Saved as <span className="font-mono font-bold text-white">{createdInfo.filename}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 border border-slate-800">
              <span className="text-slate-400">Password:</span>
              <span className="font-mono font-bold text-emerald-300 tracking-wider">
                {createdInfo.password}
              </span>
              <button
                type="button"
                onClick={copyPassword}
                className="ml-2 text-slate-400 hover:text-white transition"
                title="Copy password"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCreatedInfo(null)}
              className="text-slate-400 hover:text-slate-200 underline text-right text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main 10-Field Form Card (matching reference layout) */}
      <div className="rounded-3xl bg-[#14141b] border border-[#232330] p-6 sm:p-9 shadow-2xl">
        <form onSubmit={handleGenerateAndDownload} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* 1. FILE BASE NAME */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <FileText className="h-4 w-4 text-purple-400" />
                  FILE BASE NAME
                </label>
                {commonName.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilename(formatFilenameFromName(commonName, "firstlast"));
                      setFilenameCustomized(false);
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 transition"
                  >
                    Format from Name
                  </button>
                )}
              </div>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => {
                    setFilename(e.target.value);
                    setFilenameCustomized(true);
                  }}
                  placeholder="e.g. juancruz"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                  required
                />
                <span className="text-xs font-mono text-[#66667e] ml-2">.p12</span>
              </div>
            </div>

            {/* 2. P12 PASSWORD */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  <Lock className="h-4 w-4 text-purple-400" />
                  P12 PASSWORD
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition"
                >
                  <Dices className="h-3 w-3" />
                  Random Password
                </button>
              </div>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-transparent text-sm font-mono text-slate-100 placeholder-[#55556a] outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="ml-2 text-[#66667e] hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 3. COMMON NAME / FULL NAME */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <User className="h-4 w-4 text-purple-400" />
                COMMON NAME / FULL NAME
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={commonName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCommonName(val);
                    if (!filenameCustomized || !filename.trim()) {
                      setFilename(formatFilenameFromName(val, "firstlast"));
                    }
                  }}
                  placeholder="e.g. Juan dela Cruz"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                  required
                />
              </div>
            </div>

            {/* 4. EMAIL ADDRESS */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Mail className="h-4 w-4 text-purple-400" />
                EMAIL ADDRESS
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. juandelacruz@email.com"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                />
              </div>
            </div>

            {/* 5. ORGANIZATION */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Building2 className="h-4 w-4 text-purple-400" />
                ORGANIZATION
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Infosoft Studio"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                />
              </div>
            </div>

            {/* 6. ORGANIZATIONAL UNIT */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Briefcase className="h-4 w-4 text-purple-400" />
                ORGANIZATIONAL UNIT
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={orgUnit}
                  onChange={(e) => setOrgUnit(e.target.value)}
                  placeholder="e.g. Infosoft Studio"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                />
              </div>
            </div>

            {/* 7. LOCALITY / CITY */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <MapPin className="h-4 w-4 text-purple-400" />
                LOCALITY / CITY
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Davao"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                />
              </div>
            </div>

            {/* 8. STATE / PROVINCE */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Map className="h-4 w-4 text-purple-400" />
                STATE / PROVINCE
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. IL"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-[#55556a] outline-none"
                />
              </div>
            </div>

            {/* 9. COUNTRY CODE (2 CHARS) */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Flag className="h-4 w-4 text-purple-400" />
                COUNTRY CODE (2 CHARS)
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="text"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  placeholder="e.g. PH"
                  className="w-full bg-transparent text-sm font-mono text-slate-100 placeholder-[#55556a] outline-none uppercase"
                />
              </div>
            </div>

            {/* 10. VALIDITY DAYS */}
            <div>
              <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                VALIDITY DAYS
              </label>
              <div className="flex items-center rounded-xl bg-[#0c0c11] border border-[#272736] px-3.5 py-3 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition">
                <input
                  type="number"
                  min={1}
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 10950)}
                  placeholder="e.g. 10950"
                  className="w-full bg-transparent text-sm font-mono text-slate-100 placeholder-[#55556a] outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7e22ce] py-4 px-6 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-purple-900/40 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  GENERATING IN-MEMORY...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  GENERATE &amp; DOWNLOAD .P12
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Subtle bottom note from reference */}
      <p className="text-center text-xs text-[#6e6e84] max-w-xl mx-auto">
        This utility is for internal use. Form inputs are processed purely in-memory and are never stored on disk.
      </p>
    </div>
  );
}
