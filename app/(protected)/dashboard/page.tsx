"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type {
  PlanType,
  Player,
  Tournament,
  TournamentStatusResponse,
  UserProfile,
} from "@/lib/types";

type DashboardStats = {
  ongoing: number;
  tournaments: number;
  players: number;
};

type SubscriptionInfo = {
  last_payment_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  plan_type: PlanType;
};

const emptyStats: DashboardStats = {
  ongoing: 0,
  tournaments: 0,
  players: 0,
};

const emptySubscription: SubscriptionInfo = {
  last_payment_at: null,
  subscription_ends_at: null,
  is_active: true,
  plan_type: "free",
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const planLabels: Record<PlanType, string> = {
  free: "Free",
  plus: "Plus",
  pro_plus: "Pro+",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(emptySubscription);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tournaments, players, profile] = await Promise.all([
          api<Tournament[]>("/tournaments"),
          api<Player[]>("/players"),
          api<UserProfile>("/profile"),
        ]);

        const statuses = await Promise.all(
          tournaments.map((tournament) =>
            api<TournamentStatusResponse>(`/tournaments/${tournament.id}/status`)
          )
        );

        if (!mounted) return;
        const ongoing = statuses.filter((item) => item.status === "ongoing")
          .length;

        setStats({
          ongoing,
          tournaments: tournaments.length,
          players: players.length,
        });
        setSubscription({
          last_payment_at: profile.last_payment_at,
          subscription_ends_at: profile.subscription_ends_at,
          is_active: profile.is_active,
          plan_type: profile.plan_type,
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

    load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const statItems = useMemo(
    () => [
      {
        label: "Torneos jugándose",
        value: stats.ongoing,
        note: "En curso ahora",
      },
      {
        label: "Torneos organizados",
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

  const remainingDays = daysUntil(subscription.subscription_ends_at);
  const expiryTone =
    remainingDays !== null && remainingDays <= 2
      ? "border-red-200 bg-red-50 text-red-700"
      : remainingDays !== null && remainingDays <= 5
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Panel principal
          </div>
          <h1 className="text-3xl font-semibold">Bienvenido de nuevo</h1>
          <p className="text-sm text-zinc-300">
            Revisá el estado general y entrá rápido a los torneos.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
          <div className="text-xs text-zinc-400">
            {loading ? "Actualizando métricas..." : "Actualizado ahora"}
          </div>
          <Card className="bg-white/95 shadow-lg w-full md:w-[520px] lg:w-[600px]">
            <div className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400">
                  Suscripcion
                </div>
              </div>
              <div className="mt-2.5 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-1.5">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    Plan
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {loading ? "..." : planLabels[subscription.plan_type]}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-1.5">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    Ultimo pago
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900">
                    {loading ? "..." : formatDate(subscription.last_payment_at)}
                  </div>
                </div>
                <div className={`rounded-xl border px-3 py-1.5 ${expiryTone}`}>
                  <div className="text-[11px] uppercase tracking-[0.2em]">
                    Proximo vencimiento
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {loading ? "..." : formatDate(subscription.subscription_ends_at)}
                  </div>
                  {remainingDays !== null && !loading && (
                    <div className="mt-1 text-[11px]">
                      {remainingDays < 0 ? "Vencido" : `Faltan ${remainingDays} dias`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Link href="/tournaments" className="block">
        <Card className="bg-gradient-to-br from-amber-50 via-amber-100/70 to-amber-50 ring-amber-200/70 transition hover:-translate-y-0.5 hover:shadow-xl">
          <div className="p-6 flex flex-col gap-2">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-700/70">
              Acceso rápido
            </div>
            <div className="text-xl font-semibold text-zinc-900">Torneos</div>
            <div className="text-sm text-zinc-700">
              Crear, organizar y administrar.
            </div>
          </div>
        </Card>
      </Link>

      <Card className="bg-white/95">
        <div className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-semibold text-zinc-900">Resumen</div>
            {!loading && (
              <div className="text-xs text-zinc-500">
                {stats.tournaments} torneos en total
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
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
                <div className="mt-2 text-2xl font-semibold text-zinc-900">
                  {loading ? "..." : item.value}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
