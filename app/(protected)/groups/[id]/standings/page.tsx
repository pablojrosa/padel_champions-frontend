"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { GroupStandingsOut } from "@/lib/types";

type IdParam = { id: string };

export default function GroupStandingsPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const groupId = Number(params.id);

  const [data, setData] = useState<GroupStandingsOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(groupId)) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await api<GroupStandingsOut>(`/groups/${groupId}/standings`);
        setData(res);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudo cargar la tabla");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [groupId, router]);

  const standings = useMemo(() => {
    if (!data) return [];
    return [...data.standings].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.set_diff !== b.set_diff) return b.set_diff - a.set_diff;
      return b.game_diff - a.game_diff;
    });
  }, [data]);

  function formatDiff(value: number) {
    return value > 0 ? `+${value}` : String(value);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Zonas
          </div>
          <h1 className="text-3xl font-semibold">Tabla de posiciones</h1>
          <p className="text-sm text-zinc-300">
            {data ? data.group_name : "Grupo"}
          </p>
        </div>

        <Button variant="secondary" onClick={() => router.back()}>
          Volver
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white/95">
          <div className="p-6 text-sm text-zinc-600">Cargando...</div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card className="bg-white/95">
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="py-2">Equipo</th>
                    <th className="py-2">PJ</th>
                    <th className="py-2">PG</th>
                    <th className="py-2">PP</th>
                    <th className="py-2">Dif sets</th>
                    <th className="py-2">Dif games</th>
                    <th className="py-2">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const teamLabel = row.team.players
                      .map((player) => player.name)
                      .join(" / ") || `Team #${row.team.id}`;

                    return (
                      <tr key={row.team.id} className="border-t border-zinc-200">
                        <td className="py-2 font-medium">{teamLabel}</td>
                        <td className="py-2">{row.played}</td>
                        <td className="py-2">{row.won}</td>
                        <td className="py-2">{row.lost}</td>
                        <td className="py-2">{formatDiff(row.set_diff)}</td>
                        <td className="py-2">{formatDiff(row.game_diff)}</td>
                        <td className="py-2 font-semibold">{row.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
