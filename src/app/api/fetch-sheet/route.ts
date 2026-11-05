import { NextRequest, NextResponse } from "next/server";

interface ParsedGSheet {
  id: string;
  isPublished: boolean;
  gid: string | null;
  exportUrl: string;
  fallbackExportUrl?: string;
}

export function parseGoogleSheetsUrl(input: string): ParsedGSheet | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Published sheet URL: /spreadsheets/d/e/2PACX-.../pubhtml or /pub
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (pubMatch) {
    const pubId = pubMatch[1];
    return {
      id: pubId,
      isPublished: true,
      gid: null,
      exportUrl: `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=xlsx`,
      fallbackExportUrl: `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`,
    };
  }

  // 2. Standard sheet URL: /spreadsheets/d/{id} or /spreadsheets/u/{n}/d/{id}
  const stdMatch = trimmed.match(
    /\/spreadsheets(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/
  );
  if (stdMatch) {
    const id = stdMatch[1];
    // Check for gid in query or fragment (hash)
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : null;

    return {
      id,
      isPublished: false,
      gid,
      exportUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx${
        gid ? `&gid=${gid}` : ""
      }`,
      fallbackExportUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${
        gid ? `&gid=${gid}` : ""
      }`,
    };
  }

  // 3. Bare Google Sheet ID (e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)
  if (/^[a-zA-Z0-9_-]{20,80}$/.test(trimmed)) {
    return {
      id: trimmed,
      isPublished: false,
      gid: null,
      exportUrl: `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=xlsx`,
      fallbackExportUrl: `https://docs.google.com/spreadsheets/d/${trimmed}/export?format=csv`,
    };
  }

  return null;
}

function extractFilenameFromHeader(header: string | null): string | null {
  if (!header) return null;
  // RFC 5987 UTF-8 encoded filename
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      // ignore
    }
  }
  // Standard quoted or unquoted filename
  const quoteMatch = header.match(/filename="?([^";]+)"?/i);
  if (quoteMatch) {
    return quoteMatch[1].trim();
  }
  return null;
}

async function handleFetch(urlParam: string | null) {
  if (!urlParam) {
    return NextResponse.json(
      { error: "Missing Google Sheet URL or ID parameter." },
      { status: 400 }
    );
  }

  const parsed = parseGoogleSheetsUrl(urlParam);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid Google Sheet link. Please paste a valid URL (e.g. https://docs.google.com/spreadsheets/d/...).",
      },
      { status: 400 }
    );
  }

  const urlsToTry = [parsed.exportUrl];
  if (parsed.fallbackExportUrl && !urlsToTry.includes(parsed.fallbackExportUrl)) {
    urlsToTry.push(parsed.fallbackExportUrl);
  }

  let lastStatus = 502;
  let isPermissionError = false;

  for (const targetUrl of urlsToTry) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,text/csv,*/*",
        },
        redirect: "follow",
      });

      lastStatus = res.status;

      // If Google redirected to login page or restricted view
      const finalUrl = res.url || "";
      const contentType = (res.headers.get("content-type") || "").toLowerCase();

      if (
        finalUrl.includes("accounts.google.com/ServiceLogin") ||
        finalUrl.includes("accounts.google.com/InteractiveLogin") ||
        res.status === 401 ||
        res.status === 403
      ) {
        isPermissionError = true;
        break;
      }

      if (res.ok) {
        // If Google returned HTML instead of an actual binary/csv file, it's a permission/login barrier
        if (contentType.includes("text/html")) {
          isPermissionError = true;
          break;
        }

        const buffer = await res.arrayBuffer();
        if (buffer.byteLength < 50) {
          continue;
        }

        // Determine filename
        let filename = extractFilenameFromHeader(
          res.headers.get("content-disposition")
        );
        const isCsv = contentType.includes("csv");

        if (!filename) {
          filename = `Google_Sheet_${parsed.id.slice(0, 8)}.${isCsv ? "csv" : "xlsx"}`;
        } else {
          // Ensure correct file extension
          if (
            !filename.toLowerCase().endsWith(".xlsx") &&
            !filename.toLowerCase().endsWith(".xls") &&
            !filename.toLowerCase().endsWith(".csv")
          ) {
            filename += isCsv ? ".csv" : ".xlsx";
          }
        }

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": isCsv
              ? "text/csv; charset=utf-8"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(
              filename
            )}"`,
            "X-Sheet-Filename": encodeURIComponent(filename),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers":
              "Content-Disposition, X-Sheet-Filename",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      }
    } catch (err) {
      console.error("Error fetching Google Sheet export URL:", targetUrl, err);
      continue;
    }
  }

  if (isPermissionError) {
    return NextResponse.json(
      {
        error:
          "This Google Sheet is private or requires sign-in. To allow Tamad Tips to import it:\n1. Open your sheet in Google Sheets.\n2. Click the 'Share' button in the top right.\n3. Under 'General access', change 'Restricted' to 'Anyone with the link' (Viewer).\n4. Copy and paste the link again.",
      },
      { status: 403 }
    );
  }

  if (lastStatus === 404) {
    return NextResponse.json(
      {
        error:
          "Spreadsheet not found (404). Please verify that the Google Sheets URL or ID is correct.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Unable to fetch spreadsheet from Google Sheets. Please ensure the link is public ('Anyone with the link can view') and try again.",
    },
    { status: 502 }
  );
}

export async function GET(req: NextRequest) {
  const urlParam =
    req.nextUrl.searchParams.get("url") || req.nextUrl.searchParams.get("id");
  return handleFetch(urlParam);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const urlParam = body?.url || body?.id || null;
    return handleFetch(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
