"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import { api, ApiError } from "@/lib/api";
import { clearToken, getIsAdmin } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [accountStatus, setAccountStatus] = useState<"active" | "inactive" | null>(
    null
  );
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    const adminFlag = getIsAdmin();
    setIsAdmin(adminFlag);
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const adminFlag = getIsAdmin();
    if (adminFlag) return;
    let active = true;

    async function loadAccount() {
      try {
        const profile = await api<UserProfile>("/profile");
        if (!active) return;
        setAccountStatus(profile.status ?? null);
        setPlanExpiresAt(profile.last_payment_expires_at ?? null);
      } catch (err: any) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
        }
      }
    }

    loadAccount();
    return () => {
      active = false;
    };
  }, [router]);

  const daysUntilExpiry = useMemo(() => {
    if (!planExpiresAt) return null;
    const parts = planExpiresAt.split("-").map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const targetUtc = Date.UTC(year, month - 1, day);
    return Math.round((targetUtc - todayUtc) / 86400000);
  }, [planExpiresAt]);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto w-full max-w-screen-2xl px-4 md:px-6 min-h-14 py-2 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-wide text-zinc-800">
          Padel Champions
        </Link>
        <nav className="flex items-center gap-3 relative" ref={menuRef}>
          {!isAdmin && (
            <Link
              href="/soporte"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Soporte
            </Link>
          )}
          <Button
            variant="secondary"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            Mi cuenta
          </Button>
          {!isAdmin && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="hidden sm:inline">Estado de la cuenta</span>
              <span className="sm:hidden">Cuenta</span>
              {accountStatus ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    accountStatus === "active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {accountStatus === "active" ? "Activa" : "Inactiva"}
                </span>
              ) : (
                <span className="text-xs text-zinc-400">-</span>
              )}
              {daysUntilExpiry === 5 && (
                <span className="text-amber-700">
                  Faltan 5 dias para el vencimiento de tu plan.
                </span>
              )}
            </div>
          )}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
              {isAdmin ? (
                <>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                  >
                    Backoffice
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/admin/users"
                    onClick={() => setMenuOpen(false)}
                  >
                    Usuarios
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/admin/pagos"
                    onClick={() => setMenuOpen(false)}
                  >
                    Pagos
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/admin/soporte"
                    onClick={() => setMenuOpen(false)}
                  >
                    Soporte
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                  >
                    Club
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/ayuda"
                    onClick={() => setMenuOpen(false)}
                  >
                    Ayuda
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/players"
                    onClick={() => setMenuOpen(false)}
                  >
                    Jugadores
                  </Link>
                  <Link
                    className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                    href="/tournaments"
                    onClick={() => setMenuOpen(false)}
                  >
                    Torneos
                  </Link>
                </>
              )}
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  clearToken();
                  router.replace("/");
                }}
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
