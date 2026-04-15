const API_ORIGIN = (() => {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL;
    if (!base) return null;
    return new URL(base).origin;
  } catch {
    return null;
  }
})();

function withApiOrigin(pathname: string, search: string): string {
  if (!API_ORIGIN) return `${pathname}${search}`;
  return `${API_ORIGIN}${pathname}${search}`;
}

export function resolveClubLogoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("/public/clubs/")) {
    return withApiOrigin(value, "");
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith("/public/clubs/")) {
      return withApiOrigin(parsed.pathname, parsed.search);
    }
    return parsed.toString();
  } catch {
    if (value.startsWith("www.")) return `https://${value}`;
    return value;
  }
}
