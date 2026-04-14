import {
  LEGACY_ADMIN_KEY,
  SESSION_ADMIN_KEY,
  SESSION_EXP_KEY,
  TOKEN_KEY,
  isSessionExpired,
  parseSessionBoolean,
  parseSessionExp,
  resolveSessionMetadata,
} from "./session";

type SetTokenOptions =
  | boolean
  | {
      isAdmin?: boolean;
      expiresAt?: string | number | null;
    };

export { TOKEN_KEY };

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds?: number | null) {
  if (typeof document === "undefined") return;
  const attributes = ["path=/", "SameSite=Lax"];
  if (
    typeof window !== "undefined"
    && window.location.protocol === "https:"
  ) {
    attributes.push("Secure");
  }
  if (
    typeof maxAgeSeconds === "number"
    && Number.isFinite(maxAgeSeconds)
    && maxAgeSeconds > 0
  ) {
    attributes.push(`Max-Age=${Math.trunc(maxAgeSeconds)}`);
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; ${attributes.join("; ")}`;
}

function clearCookie(name: string) {
  if (typeof document === "undefined") return;
  const attributes = ["path=/", "Max-Age=0", "SameSite=Lax"];
  if (
    typeof window !== "undefined"
    && window.location.protocol === "https:"
  ) {
    attributes.push("Secure");
  }
  document.cookie = `${name}=; ${attributes.join("; ")}`;
}

function buildSessionSnapshot() {
  if (typeof window === "undefined") {
    return {
      token: null as string | null,
      isAdmin: false,
      expiresAt: null as number | null,
      isExpired: false,
    };
  }

  const token =
    localStorage.getItem(TOKEN_KEY)
    ?? getCookieValue(TOKEN_KEY);
  if (!token) {
    return {
      token: null,
      isAdmin: false,
      expiresAt: null,
      isExpired: false,
    };
  }

  const metadata = resolveSessionMetadata(token, {
    legacyIsAdmin: parseSessionBoolean(
      localStorage.getItem(LEGACY_ADMIN_KEY) ?? getCookieValue(LEGACY_ADMIN_KEY)
    ),
    sessionAdmin: parseSessionBoolean(
      localStorage.getItem(SESSION_ADMIN_KEY) ?? getCookieValue(SESSION_ADMIN_KEY)
    ),
    sessionExp: parseSessionExp(
      localStorage.getItem(SESSION_EXP_KEY) ?? getCookieValue(SESSION_EXP_KEY)
    ),
  });

  return {
    token,
    isAdmin: metadata.isAdmin,
    expiresAt: metadata.expiresAt,
    isExpired: isSessionExpired(metadata.expiresAt),
  };
}

export function getToken(): string | null {
  const snapshot = buildSessionSnapshot();
  if (snapshot.isExpired) {
    clearToken();
    return null;
  }
  return snapshot.token;
}

export function setToken(token: string, options: SetTokenOptions = false) {
  if (typeof window === "undefined") return;

  const optionIsAdmin =
    typeof options === "boolean" ? options : options.isAdmin ?? null;
  const optionExp =
    typeof options === "boolean" ? null : parseSessionExp(options.expiresAt ?? null);
  const metadata = resolveSessionMetadata(token, {
    legacyIsAdmin: optionIsAdmin,
    sessionAdmin: optionIsAdmin,
    sessionExp: optionExp,
  });

  const maxAgeSeconds =
    metadata.expiresAt === null
      ? null
      : Math.max(0, metadata.expiresAt - Math.trunc(Date.now() / 1000));

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LEGACY_ADMIN_KEY, metadata.isAdmin ? "1" : "0");
  localStorage.setItem(SESSION_ADMIN_KEY, metadata.isAdmin ? "1" : "0");
  if (metadata.expiresAt !== null) {
    localStorage.setItem(SESSION_EXP_KEY, String(metadata.expiresAt));
  } else {
    localStorage.removeItem(SESSION_EXP_KEY);
  }

  setCookie(TOKEN_KEY, token, maxAgeSeconds);
  setCookie(LEGACY_ADMIN_KEY, metadata.isAdmin ? "1" : "0", maxAgeSeconds);
  setCookie(SESSION_ADMIN_KEY, metadata.isAdmin ? "1" : "0", maxAgeSeconds);
  if (metadata.expiresAt !== null) {
    setCookie(SESSION_EXP_KEY, String(metadata.expiresAt), maxAgeSeconds);
  } else {
    clearCookie(SESSION_EXP_KEY);
  }
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_ADMIN_KEY);
  localStorage.removeItem(SESSION_ADMIN_KEY);
  localStorage.removeItem(SESSION_EXP_KEY);
  clearCookie(TOKEN_KEY);
  clearCookie(LEGACY_ADMIN_KEY);
  clearCookie(SESSION_ADMIN_KEY);
  clearCookie(SESSION_EXP_KEY);
}

export function getIsAdmin(): boolean {
  const snapshot = buildSessionSnapshot();
  if (snapshot.isExpired) {
    clearToken();
    return false;
  }
  return snapshot.isAdmin;
}

export function resolvePostAuthPath(
  isAdmin: boolean,
  nextPath?: string | null
): string {
  let target = nextPath || (isAdmin ? "/admin" : "/dashboard");

  if (!isAdmin && target.startsWith("/admin")) {
    target = "/dashboard";
  }
  if (isAdmin && target === "/dashboard") {
    target = "/admin";
  }

  return target;
}
