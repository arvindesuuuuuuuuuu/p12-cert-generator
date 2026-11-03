/**
 * E-Signature Extractor and Background Removal Utility
 * Downloads images from Google Drive links, strips paper backgrounds,
 * isolates purely the signature ink, and exports as high-quality transparent PNGs.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface BackgroundRemovalOptions {
  /** Brightness threshold above which pixels become transparent (0-255, default: 215) */
  threshold?: number;
  /** Width of the anti-aliased feather transition zone (default: 30) */
  smoothBand?: number;
  /** Whether to enhance and deepen faint pen ink strokes (default: true) */
  darkenInk?: boolean;
  /** Whether to trim empty border whitespace around the signature (default: true) */
  autoCrop?: boolean;
  /** Margin in pixels to leave around the signature when auto-cropping (default: 16) */
  padding?: number;
}

export interface ProcessedSignature {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Extracts the Google Drive file ID from various link formats.
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // If it is already a bare Drive ID (20-60 alphanumeric characters with _ and -)
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return trimmed;
  }

  // Match /file/d/<ID>
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileDMatch) return fileDMatch[1];

  // Match id=<ID>
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];

  // Match /d/<ID>
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];

  return null;
}

/**
 * Resolves the proxy URL to fetch the image without CORS issues.
 */
export function getProxyImageUrl(urlOrId: string): string {
  const driveId = extractGoogleDriveId(urlOrId);
  if (driveId) {
    return `/api/proxy-image?id=${encodeURIComponent(driveId)}`;
  }
  return `/api/proxy-image?url=${encodeURIComponent(urlOrId)}`;
}

/**
 * Loads an image from a URL into an HTMLImageElement safely.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image from source: ${e}`));
    img.src = src;
  });
}

/**
 * Removes background paper and produces a clean transparent PNG signature.
 */
export async function removeSignatureBackground(
  imageSource: HTMLImageElement,
  options: BackgroundRemovalOptions = {}
): Promise<ProcessedSignature> {
  const {
    threshold = 215,
    smoothBand = 30,
    darkenInk = true,
    autoCrop = true,
    padding = 16,
  } = options;

  const width = imageSource.naturalWidth || imageSource.width;
  const height = imageSource.naturalHeight || imageSource.height;

  if (width === 0 || height === 0) {
    throw new Error("Invalid image dimensions.");
  }

  // Create primary off-screen canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context.");
  }

  ctx.drawImage(imageSource, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Track bounding box for auto-crop
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let foundInk = false;

  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const originalAlpha = data[i + 3];

    if (originalAlpha === 0) continue;

    // Perceived luminance (standard Rec. 601 formula)
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance >= threshold) {
      // Background paper -> pure transparent
      data[i + 3] = 0;
    } else {
      let finalAlpha = originalAlpha;

      if (luminance > threshold - smoothBand) {
        // Anti-aliased transition band along stroke edges
        const factor = (threshold - luminance) / smoothBand;
        finalAlpha = Math.round(originalAlpha * Math.min(Math.max(factor, 0), 1));
      }

      data[i + 3] = finalAlpha;

      if (finalAlpha > 15) {
        const pixelIdx = i / 4;
        const px = pixelIdx % width;
        const py = Math.floor(pixelIdx / width);

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        foundInk = true;

        if (darkenInk) {
          // Darken and enrich stroke colors while preserving natural ink tint (black or blue)
          const inkFactor = Math.min(luminance / (threshold - smoothBand), 1);
          data[i] = Math.round(r * 0.45 * (0.6 + 0.4 * inkFactor));
          data[i + 1] = Math.round(g * 0.45 * (0.6 + 0.4 * inkFactor));
          data[i + 2] = Math.round(b * 0.55 * (0.6 + 0.4 * inkFactor));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let finalCanvas = canvas;

  // Auto-crop to isolate just the signature with comfortable padding
  if (autoCrop && foundInk && maxX >= minX && maxY >= minY) {
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
    const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

    if (cropW > 0 && cropH > 0) {
      const croppedCanvas = document.createElement("canvas");
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext("2d");

      if (cropCtx) {
        cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        finalCanvas = croppedCanvas;
      }
    }
  }

  const dataUrl = finalCanvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to convert canvas to PNG blob."));
    }, "image/png");
  });

  return {
    blob,
    dataUrl,
    width: finalCanvas.width,
    height: finalCanvas.height,
  };
}

/**
 * Bundles multiple transparent PNG signatures into a single .zip file.
 */
export async function downloadAllSignaturesAsZip(
  items: Array<{ filename: string; blob: Blob }>,
  zipFileName = "extracted_esignatures.zip"
): Promise<void> {
  const zip = new JSZip();

  items.forEach((item) => {
    const cleanName = item.filename.endsWith(".png")
      ? item.filename
      : `${item.filename}.png`;
    zip.file(cleanName, item.blob);
  });

  const content = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  saveAs(content, zipFileName);
}
