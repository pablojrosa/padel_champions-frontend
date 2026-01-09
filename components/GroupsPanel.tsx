"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import type {
  TournamentGroupOut,
  TournamentStatus,
} from "@/lib/types";

type Props = {
  tournamentId: number;
  status: TournamentStatus;
  groups: TournamentGroupOut[];
  setGroups: React.Dispatch<React.SetStateAction<TournamentGroupOut[]>>;
  teamsPerGroup: number;
  setTeamsPerGroup: (n: number) => void;
  generating: boolean;
  onGenerate: () => Promise<void>;
};

export default function GroupsPanel({
  tournamentId,
  status,
  groups,
  setGroups,
  teamsPerGroup,
  setTeamsPerGroup,
  generating,
  onGenerate,
}: Props) {
  const disabled = status !== "upcoming";

  const [removing, setRemoving] = useState<{
    groupId: number;
    teamId: number;
  } | null>(null);

  async function removeTeamFromGroup(
    groupId: number,
    team: { id: number; players: { name: string }[] },
    groupName: string
  ) {
    if (status !== "upcoming") return;

    const teamLabel = team.players.map((p) => p.name).join(" / ");

    const confirmed = window.confirm(
      `Estás por eliminar la pareja:\n\n${teamLabel}\n\n` +
        `de la zona ${groupName}.\n\n¿Deseás continuar?`
    );

    if (!confirmed) return;

    setRemoving({ groupId, teamId: team.id });

    try {
      await api(
        `/tournaments/${tournamentId}/groups/${groupId}/teams/${team.id}`,
        { method: "DELETE" }
      );

      // 🔄 actualizar estado local
      setGroups((prev) =>
        prev.map((g) =>
          g.id !== groupId
            ? g
            : { ...g, teams: g.teams.filter((t) => t.id !== team.id) }
        )
      );
    } catch (err: any) {
      alert(err?.message ?? "No se pudo quitar el equipo de la zona");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Zonas (Groups)</div>
            <div className="text-xs text-zinc-600">
              Se generan solo cuando el torneo está <b>upcoming</b>.
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700">Equipos por zona</label>
            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teamsPerGroup}
              onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
              disabled={disabled || generating || groups.length > 0}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <Button
            onClick={onGenerate}
            disabled={disabled || generating || groups.length > 0}
          >
            {generating ? "Generando..." : "Generar zonas"}
          </Button>
        </div>

        {/* Groups */}
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex justify-between">
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-zinc-500">#{g.id}</div>
              </div>

              <div className="mt-3 space-y-2">
                {g.teams.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between rounded-xl border border-zinc-200 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Team #{t.id}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {t.players.map((p) => p.name).join(" / ")}
                      </div>
                    </div>

                    {status === "upcoming" && (
                      <button
                        onClick={() =>
                          removeTeamFromGroup(g.id, t, g.name)
                        }
                        disabled={
                          removing?.groupId === g.id &&
                          removing?.teamId === t.id
                        }
                        className="rounded-lg p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        title="Quitar equipo de la zona"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
