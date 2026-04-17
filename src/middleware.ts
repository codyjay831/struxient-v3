import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Block dev-only UI in production (no accidental exposure of seed helpers).
 */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/dev" || pathname.startsWith("/dev/")) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dev", "/dev/:path*"],
};
