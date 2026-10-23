/**
 * ZIP bundler utility.
 * Packs an array of GenerationResult objects into a single .zip archive
 * and triggers a browser download via FileSaver.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { GenerationResult } from "@/types";

export async function downloadAllAsZip(results: GenerationResult[]): Promise<void> {
  const zip = new JSZip();
  const successful = results.filter((r) => r.success && r.data);

  if (successful.length === 0) {
    throw new Error("No successful certificates to bundle.");
  }

  for (const result of successful) {
    zip.file(`${result.filename}.p12`, result.data!);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  saveAs(blob, "p12_certificates.zip");
}

export function downloadSingle(result: GenerationResult): void {
  if (!result.data) throw new Error("No data for this certificate.");
  // Slice to ensure we have a plain ArrayBuffer (no SharedArrayBuffer)
  const blob = new Blob([result.data.slice(0)], { type: "application/x-pkcs12" });
  saveAs(blob, `${result.filename}.p12`);
}
