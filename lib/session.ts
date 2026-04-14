export const TOKEN_KEY = "pc_token";
export const LEGACY_ADMIN_KEY = "pc_is_admin";
export const SESSION_ADMIN_KEY = "pc_session_admin";
export const SESSION_EXP_KEY = "pc_session_exp";

type JwtSessionPayload = {
  exp?: number;
  is_admin?: boolean;
};

type SessionMetadataFallback = {
  legacyIsAdmin?: boolean | null;
  sessionAdmin?: boolean | null;
  sessionExp?: number | null;
};

export type SessionMetadata = {
  isAdmin: boolean;
  expiresAt: number | null;
};

function decodeBase64Url(input: string): string | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    if (typeof atob === "function") {
      return atob(padded);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf-8");
    }
  } catch {
    return null;
  }

  return null;
}

export function parseJwtSessionPayload(token: string): JwtSessionPayload | null {
  const [, payloadSegment] = token.split(".");
  if (!payloadSegment) return null;

  const decoded = decodeBase64Url(payloadSegment);
  if (!decoded) return null;

  try {
    const payload = JSON.parse(decoded) as JwtSessionPayload;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function parseSessionBoolean(value?: string | null): boolean | null {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

export function parseSessionExp(value?: string | number | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) return null;
    return Math.trunc(parsed / 1000);
  }

  return null;
}

export function resolveSessionMetadata(
  token: string,
  fallback: SessionMetadataFallback = {}
): SessionMetadata {
  const payload = parseJwtSessionPayload(token);
  const expiresAt =
    parseSessionExp(payload?.exp ?? null)
    ?? parseSessionExp(fallback.sessionExp ?? null);

  const payloadAdmin =
    typeof payload?.is_admin === "boolean" ? payload.is_admin : null;
  const isAdmin =
    payloadAdmin
    ?? fallback.sessionAdmin
    ?? fallback.legacyIsAdmin
    ?? false;

  return {
    isAdmin,
    expiresAt,
  };
}

export function isSessionExpired(
  expiresAt: number | null,
  nowMs = Date.now()
): boolean {
  if (expiresAt === null) return false;
  return expiresAt * 1000 <= nowMs;
}
