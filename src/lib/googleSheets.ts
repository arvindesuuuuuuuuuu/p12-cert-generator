/**
 * Google Sheets helper utility.
 * Validates Google Sheets URLs and fetches exported .xlsx binaries
 * via the server proxy (/api/fetch-sheet) to bypass CORS and convert
 * directly to a standard browser File object.
 */

export function isGoogleSheetsUrl(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (
    trimmed.includes("docs.google.com/spreadsheets") ||
    trimmed.includes("sheets.google.com")
  ) {
    return true;
  }
  // Check if it's a bare Google Sheet ID (typically ~44 alphanumeric characters)
  if (/^[a-zA-Z0-9_-]{30,60}$/.test(trimmed)) {
    return true;
  }
  return false;
}

export async function fetchGoogleSheetAsFile(urlOrId: string): Promise<File> {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    throw new Error("Please enter a Google Sheets URL or ID.");
  }

  const endpoint = `/api/fetch-sheet?url=${encodeURIComponent(trimmed)}`;
  const res = await fetch(endpoint, {
    method: "GET",
  });

  if (!res.ok) {
    let errorMsg = `Failed to fetch Google Sheet (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) {
        errorMsg = data.error;
      }
    } catch {
      const text = await res.text();
      if (text) errorMsg = text;
    }
    throw new Error(errorMsg);
  }

  // Extract filename from custom header or Content-Disposition
  let filename = "Google_Sheet.xlsx";
  const headerFilename = res.headers.get("X-Sheet-Filename");
  if (headerFilename) {
    try {
      filename = decodeURIComponent(headerFilename);
    } catch {
      filename = headerFilename;
    }
  } else {
    const cd = res.headers.get("Content-Disposition");
    if (cd) {
      const match = cd.match(/filename="?([^";]+)"?/i);
      if (match) {
        filename = match[1];
      }
    }
  }

  const blob = await res.blob();
  const mimeType =
    blob.type ||
    (filename.endsWith(".csv")
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  return new File([blob], filename, {
    type: mimeType,
    lastModified: Date.now(),
  });
}
