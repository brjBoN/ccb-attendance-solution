import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  isAllowedCcbGroupImageContentType,
  validatedCcbGroupImageUrl
} from "@/lib/ccb/group-image-url";
import { createCcbClient } from "@/lib/ccb/client";
import { getEnabledClassDisplayMapping } from "@/lib/checkin/class-display";

const MAX_IMAGE_BYTES = 5_000_000;
const getCachedGroupImageUrl = unstable_cache(
  async (groupId: string) => {
    const group = await createCcbClient().getGroupProfile({
      groupId,
      includeImageLink: true
    });
    return validatedCcbGroupImageUrl(group?.imageUrl ?? null)?.toString() ?? null;
  },
  ["ccb-group-image-url-v1"],
  { revalidate: 21_600 }
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (request.nextUrl.search) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.search = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  const { token } = await params;
  const mapping = await getEnabledClassDisplayMapping(token);
  if (!mapping) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" }
    });
  }

  try {
    const cachedImageUrl = await getCachedGroupImageUrl(mapping.ccb_group_id);
    const imageUrl = validatedCcbGroupImageUrl(cachedImageUrl);
    if (!imageUrl) return fallbackImage(request);

    const source = await fetch(imageUrl, {
      cache: "no-store",
      redirect: "error",
      headers: { Accept: "image/jpeg,image/png,image/webp" },
      signal: AbortSignal.timeout(15_000)
    });
    const contentType = source.headers.get("content-type");
    const contentLength = Number(source.headers.get("content-length") ?? 0);

    if (
      !source.ok ||
      !isAllowedCcbGroupImageContentType(contentType) ||
      contentLength > MAX_IMAGE_BYTES
    ) {
      return fallbackImage(request);
    }

    const bytes = await source.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) return fallbackImage(request);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Length": String(bytes.byteLength),
        "Content-Type": contentType ?? "image/jpeg",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return fallbackImage(request);
  }
}

function fallbackImage(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/heritage-church-logo.png", request.url),
    307
  );
  response.headers.set(
    "Cache-Control",
    "public, max-age=300, s-maxage=300"
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
