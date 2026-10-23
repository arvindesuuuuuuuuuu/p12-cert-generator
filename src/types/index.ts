// ─── Row data parsed from the spreadsheet or manual form ─────────────────────
export interface CertRow {
  /** Index in the list (0-based) */
  index: number;
  filename: string;
  commonName: string;
  p12Password: string;
  organization?: string;
  orgUnit?: string;
  locality?: string;
  state?: string;
  country?: string;
  email?: string;
  validityDays: number;
  /** Validation errors, if any */
  errors: string[];
}

// ─── Per-row generation result ───────────────────────────────────────────────
export interface GenerationResult {
  index: number;
  filename: string;
  success: boolean;
  error?: string;
  /** DER-encoded .p12 bytes */
  data?: Uint8Array;
}

// ─── Progress state emitted during batch generation ──────────────────────────
export interface GenerationProgress {
  current: number;
  total: number;
  currentName: string;
  status: "idle" | "running" | "done" | "error";
  results: GenerationResult[];
}

// ─── CA credentials for Custom CA signing mode ───────────────────────────────
export interface CACredentials {
  /** PEM-encoded CA certificate */
  certPem: string;
  /** PEM-encoded CA private key */
  keyPem: string;
}
