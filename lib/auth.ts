export const TOKEN_KEY = "pc_token";
const ADMIN_KEY = "pc_is_admin";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, isAdmin = false) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ADMIN_KEY, isAdmin ? "1" : "0");

  // Cookie for middleware (basic, non-httpOnly for now)
  document.cookie = `${TOKEN_KEY}=${token}; path=/; SameSite=Lax`;
  document.cookie = `${ADMIN_KEY}=${isAdmin ? "1" : "0"}; path=/; SameSite=Lax`;
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
  document.cookie = `${TOKEN_KEY}=; path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = `${ADMIN_KEY}=; path=/; Max-Age=0; SameSite=Lax`;
}

export function getIsAdmin(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_KEY) === "1";
}
