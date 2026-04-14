import { NextRequest, NextResponse } from "next/server";
import {
  LEGACY_ADMIN_KEY,
  SESSION_ADMIN_KEY,
  SESSION_EXP_KEY,
  TOKEN_KEY,
  isSessionExpired,
  parseSessionBoolean,
  parseSessionExp,
  resolveSessionMetadata,
} from "@/lib/session";

const PROTECTED_PREFIXES = ["/dashboard", "/players", "/tournaments", "/ayuda", "/profile", "/admin"];

function clearAuthCookies(response: NextResponse) {
  [TOKEN_KEY, LEGACY_ADMIN_KEY, SESSION_ADMIN_KEY, SESSION_EXP_KEY].forEach(
    (name) => response.cookies.delete(name)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(TOKEN_KEY)?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const metadata = resolveSessionMetadata(token, {
    legacyIsAdmin: parseSessionBoolean(req.cookies.get(LEGACY_ADMIN_KEY)?.value),
    sessionAdmin: parseSessionBoolean(req.cookies.get(SESSION_ADMIN_KEY)?.value),
    sessionExp: parseSessionExp(req.cookies.get(SESSION_EXP_KEY)?.value),
  });

  if (isSessionExpired(metadata.expiresAt)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    clearAuthCookies(response);
    return response;
  }

  if (pathname.startsWith("/admin") && !metadata.isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/admin") && metadata.isAdmin) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  const expectedAdmin = metadata.isAdmin ? "1" : "0";
  const expectedExp = metadata.expiresAt !== null ? String(metadata.expiresAt) : null;
  const currentAdmin = req.cookies.get(SESSION_ADMIN_KEY)?.value;
  const currentExp = req.cookies.get(SESSION_EXP_KEY)?.value;
  const maxAge =
    metadata.expiresAt === null
      ? undefined
      : Math.max(0, metadata.expiresAt - Math.trunc(Date.now() / 1000));

  if (currentAdmin !== expectedAdmin) {
    response.cookies.set(SESSION_ADMIN_KEY, expectedAdmin, {
      path: "/",
      sameSite: "lax",
      maxAge,
      secure: req.nextUrl.protocol === "https:",
    });
  }
  if (expectedExp && currentExp !== expectedExp) {
    response.cookies.set(SESSION_EXP_KEY, expectedExp, {
      path: "/",
      sameSite: "lax",
      maxAge,
      secure: req.nextUrl.protocol === "https:",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/players/:path*",
    "/tournaments/:path*",
    "/ayuda/:path*",
    "/profile/:path*",
    "/admin/:path*",
  ],
};
