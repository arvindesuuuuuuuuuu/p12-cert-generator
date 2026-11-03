import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  const driveIdParam = req.nextUrl.searchParams.get("id");

  let driveId = driveIdParam ? driveIdParam.trim() : null;
  const url = urlParam ? urlParam.trim() : null;

  if (url && !driveId) {
    // Check if url is already a bare Google Drive ID (e.g. 1v_ykjeCiFN0oJCrZhGxn43tI6meKJLLw)
    if (/^[a-zA-Z0-9_-]{20,60}$/.test(url)) {
      driveId = url;
    } else {
      const match =
        url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
        url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        driveId = match[1];
      }
    }
  }

  const urlsToTry: string[] = [];

  if (driveId) {
    // 1. Google Drive user content endpoint (high-res direct image)
    urlsToTry.push(`https://lh3.googleusercontent.com/d/${driveId}=w2048`);
    // 2. Google Drive direct export download
    urlsToTry.push(`https://drive.google.com/uc?export=download&id=${driveId}`);
    // 3. Google Drive thumbnail endpoint
    urlsToTry.push(`https://drive.google.com/thumbnail?id=${driveId}&sz=w2048`);
  }

  if (url && !urlsToTry.includes(url)) {
    urlsToTry.push(url);
  }

  if (urlsToTry.length === 0) {
    return new NextResponse("Missing url or id parameter", { status: 400 });
  }

  for (const targetUrl of urlsToTry) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        redirect: "follow",
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        // Ensure it is actually an image or binary
        if (
          contentType.startsWith("image/") ||
          contentType.includes("octet-stream") ||
          contentType.includes("binary")
        ) {
          const buffer = await res.arrayBuffer();
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType.startsWith("image/")
                ? contentType
                : "image/png",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
            },
          });
        }
      }
    } catch {
      // try next fallback url
      continue;
    }
  }

  return new NextResponse("Unable to fetch image from Google Drive link", {
    status: 502,
  });
}
