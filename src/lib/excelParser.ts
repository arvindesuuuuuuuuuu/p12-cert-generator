/**
 * Excel-parser utility.
 * Uses SheetJS (xlsx) to read an .xlsx / .xls / .csv file and extract rows
 * that match the expected column schema.
 */

import * as XLSX from "xlsx";
import JSZip from "jszip";
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
const COL_ESIGN = [
  "link for esignature (google drive link)",
  "link for esignature",
  "link for e-signature",
  "link for signature",
  "esignature link",
  "esign link",
  "e-signature link",
  "esignature",
  "esign",
  "e-signature",
  "signature",
  "signature link",
  "google drive link",
  "drive link",
  "drive",
];

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

/**
 * Extracts embedded drawing images from an .xlsx file, mapping each 0-indexed data row
 * to its corresponding embedded image Blob, data URL, and original filename.
 */
export async function extractEmbeddedImagesFromExcel(
  file: File
): Promise<Map<number, { blob: Blob; dataUrl: string; name: string }>> {
  const imageMap = new Map<number, { blob: Blob; dataUrl: string; name: string }>();

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return imageMap;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Build relationship map: rId -> media file path
    const relsFiles = Object.keys(zip.files).filter((f) =>
      /^xl\/drawings\/_rels\/drawing\d+\.xml\.rels$/.test(f)
    );
    const relsMap: Record<string, string> = {};

    for (const rf of relsFiles) {
      const text = await zip.file(rf)!.async("text");
      const matches = text.matchAll(
        /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g
      );
      for (const m of matches) {
        let target = m[2];
        if (target.startsWith("../media/")) {
          target = "xl/media/" + target.replace("../media/", "");
        } else if (target.startsWith("media/")) {
          target = "xl/media/" + target.replace("media/", "");
        }
        relsMap[m[1]] = target;
      }
    }

    // 2. Parse drawings XML to map row anchors to relationship IDs
    const drawingFiles = Object.keys(zip.files).filter((f) =>
      /^xl\/drawings\/drawing\d+\.xml$/.test(f)
    );

    interface AnchorEntry {
      finalRow: number;
      mediaPath: string;
    }

    const anchorList: AnchorEntry[] = [];

    for (const df of drawingFiles) {
      const text = await zip.file(df)!.async("text");
      const anchorMatches = text.matchAll(
        /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g
      );

      for (const am of anchorMatches) {
        const block = am[1];
        const rowM = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const rowOffM = block.match(/<xdr:from>[\s\S]*?<xdr:rowOff>(\d+)<\/xdr:rowOff>/);
        const blipM = block.match(/<a:blip[^>]+(?:r:embed|r:link)="([^"]+)"/);

        if (rowM && blipM) {
          const baseRow = parseInt(rowM[1], 10);
          const rowOff = rowOffM ? parseInt(rowOffM[1], 10) : 0;
          // Standard row height in Excel is approx 350000 - 400000 EMU
          const rowShift = rowOff > 250000 ? Math.round(rowOff / 400000) : 0;
          const finalRow = baseRow + rowShift;
          const relId = blipM[1];
          const mediaPath = relsMap[relId];

          if (mediaPath && zip.file(mediaPath)) {
            anchorList.push({ finalRow, mediaPath });
          }
        }
      }
    }

    anchorList.sort((a, b) => a.finalRow - b.finalRow);

    // 3. Extract binary blobs for each row
    for (const item of anchorList) {
      const dataRowIdx = item.finalRow - 1; // 0-based data row (header row is 0 in XML)
      if (dataRowIdx >= 0 && !imageMap.has(dataRowIdx)) {
        const zipFile = zip.file(item.mediaPath);
        if (zipFile) {
          const extension = item.mediaPath.split(".").pop()?.toLowerCase() || "png";
          const mime =
            extension === "jpg" || extension === "jpeg"
              ? "image/jpeg"
              : extension === "webp"
              ? "image/webp"
              : "image/png";

          const arrayBuffer = await zipFile.async("arraybuffer");
          const blob = new Blob([arrayBuffer], { type: mime });
          const dataUrl = URL.createObjectURL(blob);
          const name = item.mediaPath.split("/").pop() || `embedded_image_${dataRowIdx + 1}.${extension}`;

          imageMap.set(dataRowIdx, { blob, dataUrl, name });
        }
      }
    }
  } catch (err) {
    console.warn("Could not extract embedded drawings from Excel:", err);
  }

  return imageMap;
}

export async function parseExcelFile(
  file: File,
  defaultPassword?: string,
  filenameFormat: FilenameFormat = "firstlast"
): Promise<CertRow[]> {
  const [buffer, embeddedImages] = await Promise.all([
    file.arrayBuffer(),
    extractEmbeddedImagesFromExcel(file),
  ]);

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
    const esignLink = get(COL_ESIGN) || undefined;
    const embeddedImage = embeddedImages.get(idx) || undefined;
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
      esignLink,
      embeddedImage,
      errors,
    };
  });
}
