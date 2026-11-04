/**
 * E-Signature Extractor and Background Removal Utility
 * Downloads images from Google Drive links, strips paper backgrounds,
 * isolates purely the signature ink, and exports as high-quality transparent PNGs.
 */

import JSZip from "jszip";
import { saveAs } from "file-saver";

export interface BackgroundRemovalOptions {
  /** Adaptive sensitivity: threshold distance below local paper brightness (12 to 50, default: 24) */
  sensitivity?: number;
  /** Ink styling: "pure-black" (sharp jet-black, ideal for certificates) | "navy" | "original" */
  inkStyle?: "pure-black" | "navy" | "original";
  /** Transition width for anti-aliasing edges (default: 20) */
  featherBand?: number;
  /** Whether to detect and remove corner watermarks / app logos (e.g. "(✓) eSignature", "CamScanner") (default: true) */
  removeWatermarks?: boolean;
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
 * Removes background paper adaptively and produces a crisp, clean transparent PNG signature.
 * Uses local adaptive background surface estimation to completely eliminate grey paper,
 * shadows, lighting gradients, and camera phone noise.
 */
export async function removeSignatureBackground(
  imageSource: HTMLImageElement,
  options: BackgroundRemovalOptions = {}
): Promise<ProcessedSignature> {
  const {
    sensitivity = 24,
    inkStyle = "pure-black",
    featherBand = 20,
    removeWatermarks = true,
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
  const totalPixels = width * height;

  // ── STEP 1: COMPUTE PER-PIXEL LUMINANCE & DETECT BLUE BALLPOINT PEN ──
  const lum = new Uint8ClampedArray(totalPixels);
  let blueDominanceCount = 0;
  let nonWhitePixelCount = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 10) {
      lum[p] = 255;
      continue;
    }

    // Perceived luminance (standard Rec. 601 formula)
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lum[p] = l;

    // Detect if image was signed with a blue ballpoint pen
    if (l < 220 && b > r + 15 && b > g + 5) {
      blueDominanceCount++;
    }
    if (l < 240) {
      nonWhitePixelCount++;
    }
  }

  const isBluePen = nonWhitePixelCount > 0 && blueDominanceCount / nonWhitePixelCount > 0.04;

  // ── STEP 2: BUILD ADAPTIVE LOCAL BACKGROUND SURFACE (GRID OF BLOCKS) ──
  // Divides photo into blocks and calculates local paper brightness in each block
  const blockSize = Math.max(16, Math.min(64, Math.floor(Math.min(width, height) / 10)));
  const gridW = Math.ceil(width / blockSize);
  const gridH = Math.ceil(height / blockSize);
  const bgGrid = new Float32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    const yStart = gy * blockSize;
    const yEnd = Math.min(yStart + blockSize, height);

    for (let gx = 0; gx < gridW; gx++) {
      const xStart = gx * blockSize;
      const xEnd = Math.min(xStart + blockSize, width);

      const blockLums: number[] = [];
      for (let y = yStart; y < yEnd; y++) {
        const rowOffset = y * width;
        for (let x = xStart; x < xEnd; x++) {
          blockLums.push(lum[rowOffset + x]);
        }
      }

      if (blockLums.length > 0) {
        blockLums.sort((a, b) => a - b);
        // The 88th percentile reliably captures the paper surface even with dense strokes
        const pIdx = Math.floor(blockLums.length * 0.88);
        bgGrid[gy * gridW + gx] = blockLums[pIdx];
      } else {
        bgGrid[gy * gridW + gx] = 230;
      }
    }
  }

  // Smooth the grid with a 3x3 box blur for smooth lighting transitions across blocks
  const smoothedGrid = new Float32Array(gridW * gridH);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = gy + dy;
        if (ny < 0 || ny >= gridH) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = gx + dx;
          if (nx < 0 || nx >= gridW) continue;
          sum += bgGrid[ny * gridW + nx];
          count++;
        }
      }
      smoothedGrid[gy * gridW + gx] = sum / count;
    }
  }

  let maxPaperLum = 0;
  for (let k = 0; k < smoothedGrid.length; k++) {
    if (smoothedGrid[k] > maxPaperLum) maxPaperLum = smoothedGrid[k];
  }
  const globalPaperBaseline = Math.max(160, maxPaperLum);

  // Helper for bilinear interpolation of local paper background
  const getLocalBg = (x: number, y: number): number => {
    const gx = x / blockSize - 0.5;
    const gy = y / blockSize - 0.5;
    const x0 = Math.max(0, Math.min(Math.floor(gx), gridW - 1));
    const y0 = Math.max(0, Math.min(Math.floor(gy), gridH - 1));
    const x1 = Math.max(0, Math.min(x0 + 1, gridW - 1));
    const y1 = Math.max(0, Math.min(y0 + 1, gridH - 1));

    const fx = Math.max(0, Math.min(gx - x0, 1));
    const fy = Math.max(0, Math.min(gy - y0, 1));

    const v00 = smoothedGrid[y0 * gridW + x0];
    const v10 = smoothedGrid[y0 * gridW + x1];
    const v01 = smoothedGrid[y1 * gridW + x0];
    const v11 = smoothedGrid[y1 * gridW + x1];

    const top = v00 * (1 - fx) + v10 * fx;
    const bottom = v01 * (1 - fx) + v11 * fx;
    const val = top * (1 - fy) + bottom * fy;

    return Math.max(val, globalPaperBaseline * 0.65);
  };

  // ── STEP 3: ISOLATE SIGNATURE INK AND STRIP ALL PAPER / SHADOWS ──
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let foundInk = false;

  // Margin to discard border shadows / camera vignette around perimeter
  const borderMarginX = Math.round(width * 0.02);
  const borderMarginY = Math.round(height * 0.02);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    const isBorderY = y < borderMarginY || y >= height - borderMarginY;

    for (let x = 0; x < width; x++) {
      const p = rowOffset + x;
      const i = p * 4;
      const originalAlpha = data[i + 3];

      if (originalAlpha < 10) {
        data[i + 3] = 0;
        continue;
      }

      const isBorder = isBorderY || x < borderMarginX || x >= width - borderMarginX;
      const currentLum = lum[p];
      const localBg = getLocalBg(x, y);

      // Delta: distance below local paper surface
      const delta = localBg - currentLum;

      // Check if pixel belongs to paper background or border vignette
      if (delta <= sensitivity || (isBorder && delta < sensitivity + 25)) {
        // Pure transparent paper
        data[i + 3] = 0;
      } else {
        // Ink stroke detected
        const inkDepth = delta - sensitivity;
        const alphaFraction = Math.min(1, Math.max(0, inkDepth / featherBand));
        const finalAlpha = Math.round(originalAlpha * alphaFraction);

        data[i + 3] = finalAlpha;

        if (finalAlpha > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundInk = true;

          // INK ENHANCEMENT & STYLING
          if (inkStyle === "pure-black") {
            // Clean official jet-black signature (#000000 with anti-aliased edge alpha)
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else if (inkStyle === "navy" || (inkStyle === "original" && isBluePen)) {
            // Deep crisp official navy blue ink (#0f2b5c)
            data[i] = 15;
            data[i + 1] = 43;
            data[i + 2] = 92;
          } else {
            // Deepened original color with paper haze stripped
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const factor = Math.min(1, currentLum / localBg);
            data[i] = Math.round(r * 0.4 * factor);
            data[i + 1] = Math.round(g * 0.4 * factor);
            data[i + 2] = Math.round(b * 0.4 * factor);
          }
        }
      }
    }
  }

  // ── STEP 4: AUTOMATIC CORNER WATERMARK & APP BADGE REMOVAL ──
  // Detects and purges corner watermarks (e.g. "(✓) eSignature", "CamScanner", app stamps)
  if (removeWatermarks && foundInk) {
    const cellSize = Math.max(4, Math.min(12, Math.floor(Math.min(width, height) / 80)));
    const gw = Math.ceil(width / cellSize);
    const gh = Math.ceil(height / cellSize);
    const grid = new Uint8Array(gw * gh);

    // Populate grid with ink cells
    for (let y = 0; y < height; y++) {
      const gy = Math.floor(y / cellSize);
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const i = (rowOffset + x) * 4;
        if (data[i + 3] > 20) {
          grid[gy * gw + Math.floor(x / cellSize)] = 1;
        }
      }
    }

    // Connected components on small grid
    const visited = new Uint8Array(gw * gh);
    interface Component {
      count: number;
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }
    const components: Component[] = [];

    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const idx = gy * gw + gx;
        if (grid[idx] === 1 && visited[idx] === 0) {
          visited[idx] = 1;
          const queue = [gx, gy];
          let head = 0;
          let count = 0;
          let cMinX = gx * cellSize;
          let cMaxX = gx * cellSize + cellSize;
          let cMinY = gy * cellSize;
          let cMaxY = gy * cellSize + cellSize;

          while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            count++;

            const px0 = cx * cellSize, px1 = px0 + cellSize;
            const py0 = cy * cellSize, py1 = py0 + cellSize;
            if (px0 < cMinX) cMinX = px0;
            if (px1 > cMaxX) cMaxX = px1;
            if (py0 < cMinY) cMinY = py0;
            if (py1 > cMaxY) cMaxY = py1;

            for (let dy = -1; dy <= 1; dy++) {
              const ny = cy + dy;
              if (ny < 0 || ny >= gh) continue;
              for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx;
                if (nx < 0 || nx >= gw) continue;
                const nidx = ny * gw + nx;
                if (grid[nidx] === 1 && visited[nidx] === 0) {
                  visited[nidx] = 1;
                  queue.push(nx, ny);
                }
              }
            }
          }

          components.push({
            count,
            minX: cMinX,
            maxX: Math.min(cMaxX, width),
            minY: cMinY,
            maxY: Math.min(cMaxY, height),
          });
        }
      }
    }

    if (components.length > 1) {
      components.sort((a, b) => b.count - a.count);
      const mainComp = components[0];

      // Identify watermark components
      const watermarkRegions: Component[] = [];
      for (let cIdx = 1; cIdx < components.length; cIdx++) {
        const c = components[cIdx];

        // Is component in a corner or extreme bottom margin?
        const isBottomRight = c.minX > 0.55 * width && c.minY > 0.72 * height;
        const isBottomLeft = c.maxX < 0.45 * width && c.minY > 0.75 * height;
        const isBottomEdge = c.minY > 0.88 * height;
        const isCorner = isBottomRight || isBottomLeft || isBottomEdge;

        // Gap check: separated vertically or horizontally from main signature body
        const yGap = c.minY - mainComp.maxY;
        const xGap = c.minX - mainComp.maxX;
        const hasGap =
          yGap > Math.max(8, height * 0.015) ||
          xGap > Math.max(10, width * 0.02) ||
          c.maxX < mainComp.minX - Math.max(10, width * 0.02);

        // Watermarks are small compared to primary signature
        const isSmall = c.count < mainComp.count * 0.25;

        if (isCorner && hasGap && isSmall) {
          watermarkRegions.push(c);
        }
      }

      // If watermark components are found, erase all pixels in those regions
      if (watermarkRegions.length > 0) {
        for (const wm of watermarkRegions) {
          for (let y = wm.minY; y < wm.maxY; y++) {
            const rowOffset = y * width;
            for (let x = wm.minX; x < wm.maxX; x++) {
              const i = (rowOffset + x) * 4;
              data[i + 3] = 0; // Pure transparent!
            }
          }
        }

        // Re-compute bounding box of remaining genuine signature ink for auto-crop
        minX = width;
        minY = height;
        maxX = 0;
        maxY = 0;
        foundInk = false;

        for (let y = 0; y < height; y++) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const i = (rowOffset + x) * 4;
            if (data[i + 3] > 20) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              foundInk = true;
            }
          }
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let finalCanvas = canvas;

  // Auto-crop to isolate purely the signature with neat padding
  if (autoCrop && foundInk && maxX >= minX && maxY >= minY) {
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
    const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

    if (cropW > 10 && cropH > 10) {
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
