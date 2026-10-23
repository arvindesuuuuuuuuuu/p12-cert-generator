/**
 * Excel-parser utility.
 * Uses SheetJS (xlsx) to read an .xlsx / .xls / .csv file and extract rows
 * that match the expected column schema.
 */

import * as XLSX from "xlsx";
import type { CertRow } from "@/types";
import { formatFilenameFromName, type FilenameFormat } from "@/lib/nameFormatter";

/** Column header aliases (case-insensitive, normalized) */
const COL_FILENAME = [
  "filename",
  "file_name",
  "file name",
  "file base name",
  "file",
  "basename",
];
const COL_COMMON_NAME = [
  "full name",
  "fullname",
  "name",
  "common name",
  "commonname",
  "common_name",
  "cn",
  "person",
];
const COL_PASSWORD = [
  "self-sign password",
  "self sign password",
  "self-sign",
  "self sign",
  "p12password",
  "password",
  "p12pass",
  "pass",
  "p12_password",
];
const COL_ORG = [
  "name of office",
  "office",
  "organization",
  "org",
  "company",
  "agency",
  "o",
];
const COL_OU = [
  "orgunit",
  "org_unit",
  "ou",
  "organizational unit",
  "department",
  "unit",
  "division",
  "section",
];
const COL_LOCALITY = ["locality", "city", "l", "town", "municipality"];
const COL_STATE = ["state", "province", "st", "region"];
const COL_COUNTRY = ["country", "c", "country code", "country_code"];
const COL_EMAIL = ["email", "emailaddress", "email address", "e", "mail"];
const COL_VALIDITY = ["validitydays", "validity", "days", "validity days", "expiry"];

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchHeader(
  headers: Record<string, string>,
  aliases: string[]
): string | undefined {
  for (const alias of aliases) {
    const normAlias = normalizeKey(alias);
    if (headers[normAlias] !== undefined) return headers[normAlias];
  }
  return undefined;
}

export async function parseExcelFile(
  file: File,
  defaultPassword?: string,
  filenameFormat: FilenameFormat = "firstlast"
): Promise<CertRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });

  if (raw.length === 0) return [];

  // Build a normalised header-key → original-key map from the first row keys
  const headerMap: Record<string, string> = {};
  Object.keys(raw[0]).forEach((key) => {
    headerMap[normalizeKey(key)] = key;
  });

  return raw.map((row, idx): CertRow => {
    const get = (aliases: string[]): string =>
      String(row[matchHeader(headerMap, aliases) ?? ""] ?? "").trim();

    const commonName = get(COL_COMMON_NAME);
    let filename = get(COL_FILENAME);

    // Auto-generate clean filename if column is missing or empty
    // Uses the combination of firstname and lastname (e.g. ALILY T. LIPIO -> alily_lipio)
    if (!filename) {
      if (commonName) {
        filename = formatFilenameFromName(commonName, filenameFormat);
      } else {
        const mail = get(COL_EMAIL);
        filename = mail ? mail.split("@")[0].toLowerCase() : `cert_${idx + 1}`;
      }
    }

    // Password: check row, fallback to defaultPassword if provided
    let p12Password = get(COL_PASSWORD);
    if (!p12Password && defaultPassword) {
      p12Password = defaultPassword;
    }

    const organization = get(COL_ORG) || undefined;
    const orgUnit = get(COL_OU) || undefined;
    const locality = get(COL_LOCALITY) || undefined;
    const state = get(COL_STATE) || undefined;
    const country = get(COL_COUNTRY) || "PH"; // default to PH if not specified
    const email = get(COL_EMAIL) || undefined;
    const validityRaw = get(COL_VALIDITY);
    const validityDays = validityRaw ? parseInt(validityRaw, 10) || 10950 : 10950;

    const errors: string[] = [];
    if (!filename) errors.push("File Name is required");
    if (!commonName) errors.push("Common Name is required");
    if (!p12Password) errors.push("Password is required");
    if (country && country.length !== 2)
      errors.push("Country must be 2 letters (e.g. PH)");
    if (isNaN(validityDays) || validityDays <= 0)
      errors.push("Validity must be at least 1 day");

    return {
      index: idx,
      filename,
      commonName,
      p12Password,
      organization,
      orgUnit,
      locality,
      state,
      country,
      email,
      validityDays,
      errors,
    };
  });
}
