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
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Bienvenido de nuevo! 👋</h1>
      </div>

      <Link href="/tournaments" className="block">
        <Card className="bg-amber-50 ring-amber-200">
          <div className="p-5 md:p-6 flex flex-col gap-2">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Acceso rápido
            </div>
            <div className="text-lg font-semibold">Torneos</div>
            <div className="text-sm text-zinc-600">
              Crear, organizar y administrar.
            </div>
          </div>
        </Card>
      </Link>

      <Card>
        <div className="p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-lg">Resumen</div>
            {loading ? (
              <div className="text-xs text-zinc-500">Actualizando...</div>
            ) : (
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

          <div className="grid gap-3 md:grid-cols-3">
            {statItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
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
