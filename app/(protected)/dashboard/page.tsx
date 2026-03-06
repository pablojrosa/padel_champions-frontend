"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import { clearToken, getIsAdmin } from "@/lib/auth";
import type { AdminUser, Player, Tournament } from "@/lib/types";

type DashboardStats = {
  ongoing: number;
  tournaments: number;
  players: number;
};

const emptyStats: DashboardStats = {
  ongoing: 0,
  tournaments: 0,
  players: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const isAdmin = getIsAdmin();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expiringUsers, setExpiringUsers] = useState<AdminUser[]>([]);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringError, setExpiringError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tournaments, players] = await Promise.all([
          api<Tournament[]>("/tournaments"),
          api<Player[]>("/players"),
        ]);

        if (!mounted) return;
        const ongoing = tournaments.filter((t) => t.status === "ongoing").length;

        setStats({
          ongoing,
          tournaments: tournaments.length,
          players: players.length,
        });
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudieron cargar los datos");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    async function loadExpiringUsers() {
      if (!isAdmin) return;
      setExpiringLoading(true);
      setExpiringError(null);
      try {
        const users = await api<AdminUser[]>("/admin/users");
        if (!mounted) return;
        const today = new Date();
        const cutoff = new Date();
        cutoff.setDate(today.getDate() + 10);
        const todayISO = today.toISOString().slice(0, 10);
        const cutoffISO = cutoff.toISOString().slice(0, 10);

        const filtered = users
          .filter(
            (user) =>
              user.last_payment_expires_at &&
              user.last_payment_expires_at >= todayISO &&
              user.last_payment_expires_at <= cutoffISO
          )
          .sort((a, b) =>
            (a.last_payment_expires_at ?? "").localeCompare(
              b.last_payment_expires_at ?? ""
            )
          );

        setExpiringUsers(filtered);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setExpiringUsers([]);
          return;
        }
        setExpiringError(err?.message ?? "No se pudieron cargar los vencimientos");
      } finally {
        if (mounted) setExpiringLoading(false);
      }
    }

    load();
    loadExpiringUsers();

    return () => {
      mounted = false;
    };
  }, [router, isAdmin, reloadKey]);

  const daysUntil = (dateString: string) => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(`${dateString}T00:00:00`);
    const diff = target.getTime() - todayStart.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const statItems = useMemo(
    () => [
      {
        label: "Competencias jugándose",
        value: stats.ongoing,
        note: "En curso ahora",
      },
      {
        label: "Competencias organizadas",
        value: stats.tournaments,
        note: "Creados en total",
      },
      {
        label: "Jugadores registrados",
        value: stats.players,
        note: "Base activa",
      },
    ],
    [stats]
  );

  function retryLoad() {
    setReloadKey((prev) => prev + 1);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          Panel principal
        </div>
        <h1 className="text-3xl font-semibold">Bienvenido de nuevo</h1>
        <p className="text-sm text-zinc-300">
          Revisa el estado general y entra rápido a las competencias.
        </p>
      </div>

      <Card className="bg-gradient-to-br from-amber-50 via-amber-100/70 to-amber-50 ring-amber-200/70">
        <div className="p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.28em] text-amber-700/70">
            Acciones rápidas
          </div>

          <div className="max-w-2xl">
            <Link
              href="/tournaments"
              className="group flex h-full flex-col rounded-2xl border border-white/70 bg-white/90 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700/80">
                    Organización de torneos
                  </div>
                  <div className="text-lg font-semibold text-zinc-900">Competencias</div>
                  <p className="max-w-xs text-sm text-zinc-600">
                    Crea y administra cada torneo desde un solo lugar.
                  </p>
                </div>
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.02 9.02 0 01-2.48 5.228m2.48-5.492a23.278 23.278 0 00-2.48.492m-8.52 0a7.454 7.454 0 00-.982 3.172" />
                  </svg>
                </div>
              </div>
              <div className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
                Abrir competencias
                <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5l7.5 7.5-7.5 7.5M3 12h18" />
                </svg>
              </div>
            </Link>
          </div>

          {isAdmin && (
            <div className="rounded-2xl border border-amber-200/80 bg-white/50 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Administración
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/users"
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  Admin usuarios
                </Link>
                <Link
                  href="/admin/pagos"
                  className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:-translate-y-0.5 hover:shadow-sm"
                >
                  Admin pagos
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-white/95">
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-semibold text-zinc-900">Resumen</div>
            {!loading && (
              <div className="text-xs text-zinc-500">
                {stats.tournaments} competencias en total
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="text-xs font-semibold underline decoration-dotted hover:text-red-900"
                >
                  Reintentar
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {statItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-4 shadow-sm"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {item.label}
                </div>
                {loading ? (
                  <div className="mt-2 h-8 w-16 animate-pulse rounded-lg bg-zinc-200" />
                ) : (
                  <div className="mt-2 text-2xl font-semibold text-zinc-900">
                    {item.value}
                  </div>
                )}
                <div className="mt-1 text-xs text-zinc-500">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {isAdmin && (
        <Card className="bg-white/95">
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-zinc-900">
                Vencimientos próximos
              </div>
              <div className="text-xs text-zinc-500">Próximos 10 días</div>
            </div>

            {expiringError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{expiringError}</span>
                  <button
                    type="button"
                    onClick={retryLoad}
                    className="text-xs font-semibold underline decoration-dotted hover:text-red-900"
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            )}

            {expiringLoading ? (
              <div className="text-sm text-zinc-600">Cargando vencimientos...</div>
            ) : expiringUsers.length === 0 ? (
              <div className="text-sm text-zinc-600">
                No hay usuarios con vencimiento en los próximos 10 días.
              </div>
            ) : (
              <div className="space-y-2">
                {expiringUsers.map((user) => {
                  const expiresAt = user.last_payment_expires_at ?? "";
                  const daysLeft = daysUntil(expiresAt);
                  const urgencyText =
                    daysLeft <= 0
                      ? "Vence hoy"
                      : daysLeft === 1
                      ? "Vence mañana"
                      : `Vence en ${daysLeft} días`;
                  const urgencyTextColor =
                    daysLeft <= 1
                      ? "text-red-600"
                      : daysLeft <= 3
                      ? "text-amber-600"
                      : "text-zinc-500";
                  const urgencyBadge =
                    daysLeft <= 1
                      ? "border-red-200 bg-red-50 text-red-700"
                      : daysLeft <= 3
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700";

                  return (
                    <div
                      key={user.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-zinc-800">
                          {user.club_name || user.email}
                        </div>
                        <div className="text-xs text-zinc-500">{user.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs font-semibold ${urgencyBadge}`}
                        >
                          {urgencyText}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-zinc-900">
                          {expiresAt}
                        </div>
                        <div className={`text-xs ${urgencyTextColor}`}>
                          {urgencyText}
                        </div>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/pagos?user=${user.id}`)}
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                        >
                          Gestionar pago
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
