"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Player, Tournament, TournamentStatusResponse } from "@/lib/types";

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
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="text-xs text-zinc-400">
          {loading ? "Actualizando métricas..." : "Actualizado ahora"}
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
