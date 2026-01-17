"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
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
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTeamId, setMoveTeamId] = useState<number | "">("");
  const [moveSourceGroupId, setMoveSourceGroupId] = useState<number | null>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<number | "">("");
  const [moveSwapTeamId, setMoveSwapTeamId] = useState<number | "">("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const allTeams = useMemo(() => {
    return groups.flatMap((group) =>
      group.teams.map((team) => ({
        ...team,
        group_id: group.id,
        group_name: group.name,
      }))
    );
  }, [groups]);

  const capacity = useMemo(() => {
    if (teamsPerGroup) return teamsPerGroup;
    return Math.max(1, ...groups.map((group) => group.teams.length));
  }, [teamsPerGroup, groups]);

  const selectedTargetGroup = useMemo(() => {
    if (moveTargetGroupId === "") return null;
    return groups.find((group) => group.id === moveTargetGroupId) ?? null;
  }, [groups, moveTargetGroupId]);

  const targetIsFull = selectedTargetGroup
    ? selectedTargetGroup.teams.length >= capacity
    : false;

  function getTeamLabel(team: { id: number; players: { name: string }[] }) {
    return team.players.map((p) => p.name).join(" / ") || `Team #${team.id}`;
  }

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

      const updatedGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(updatedGroups);
    } catch (err: any) {
      alert(err?.message ?? "No se pudo quitar el equipo de la zona");
    } finally {
      setRemoving(null);
    }
  }

  async function removeEmptyGroup(groupId: number, groupName: string) {
    if (status !== "upcoming") return;

    const confirmed = window.confirm(
      `Vas a eliminar la zona ${groupName}.\n\n¿Deseás continuar?`
    );

    if (!confirmed) return;

    try {
      await api(`/tournaments/${tournamentId}/groups/${groupId}`, {
        method: "DELETE",
      });

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err: any) {
      alert(err?.message ?? "No se pudo eliminar la zona");
    }
  }

  function openMoveModal(teamId: number, sourceGroupId: number, targetGroupId?: number) {
    setMoveTeamId(teamId);
    setMoveSourceGroupId(sourceGroupId);
    setMoveTargetGroupId(targetGroupId ?? "");
    setMoveSwapTeamId("");
    setMoveError(null);
    setMoveOpen(true);
  }

  function updateMoveTeam(teamId: number | "") {
    setMoveTeamId(teamId);
    if (teamId === "") {
      setMoveSourceGroupId(null);
      return;
    }
    const team = allTeams.find((t) => t.id === teamId);
    setMoveSourceGroupId(team?.group_id ?? null);
  }

  function applyMoveLocally(
    teamId: number,
    sourceGroupId: number,
    targetGroupId: number,
    swapTeamId: number | null
  ) {
    setGroups((prev) => {
      const source = prev.find((g) => g.id === sourceGroupId);
      const target = prev.find((g) => g.id === targetGroupId);
      if (!source || !target) return prev;

      const teamToMove = source.teams.find((t) => t.id === teamId);
      if (!teamToMove) return prev;

      const swapTeam = swapTeamId
        ? target.teams.find((t) => t.id === swapTeamId)
        : null;

      return prev.map((group) => {
        if (group.id === sourceGroupId) {
          const remaining = group.teams.filter((t) => t.id !== teamId);
          return {
            ...group,
            teams: swapTeam ? [swapTeam, ...remaining] : remaining,
          };
        }
        if (group.id === targetGroupId) {
          const remaining = group.teams.filter((t) => t.id !== swapTeamId);
          return {
            ...group,
            teams: [teamToMove, ...remaining],
          };
        }
        return group;
      });
    });
  }

  async function submitMove() {
    if (moveTeamId === "" || moveTargetGroupId === "" || moveSourceGroupId === null) {
      setMoveError("Selecciona equipo y zona destino.");
      return;
    }

    if (moveSourceGroupId === moveTargetGroupId) {
      setMoveError("La zona destino debe ser distinta.");
      return;
    }

    const targetGroup = groups.find((group) => group.id === moveTargetGroupId);
    if (!targetGroup) {
      setMoveError("Zona destino invalida.");
      return;
    }

    const targetIsFull = targetGroup.teams.length >= capacity;
    if (targetIsFull && moveSwapTeamId === "") {
      setMoveError("La zona destino esta completa. Selecciona una pareja para intercambiar.");
      return;
    }

    setMoving(true);
    setMoveError(null);
    const swapId = moveSwapTeamId === "" ? null : moveSwapTeamId;
    const prevGroups = groups;
    applyMoveLocally(moveTeamId, moveSourceGroupId, moveTargetGroupId, swapId);
    setMoveOpen(false);

    try {
      await api(
        `/tournaments/${tournamentId}/groups/${moveSourceGroupId}/teams/${moveTeamId}/move`,
        {
          method: "POST",
          body: {
            target_group_id: moveTargetGroupId,
            swap_team_id: swapId,
          },
        }
      );
      const updatedGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(updatedGroups);
    } catch (err: any) {
      setGroups(prevGroups);
      setMoveError(err?.message ?? "No se pudo mover el equipo");
    } finally {
      setMoving(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetGroupId: number) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { teamId: number; groupId: number };
      if (parsed.groupId === targetGroupId) return;
      openMoveModal(parsed.teamId, parsed.groupId, targetGroupId);
    } catch {
      // ignore invalid payload
    }
  }

  return (
    <Card className="bg-white/95">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-800">Zona de grupos</div>
            <div className="text-xs text-zinc-600">
              Se generan solo cuando el torneo está en estado <b>Por jugar</b>.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.location.assign(`/tournaments/${tournamentId}/matches`)}
            >
              Ver partidos
            </Button>
            <Button
              onClick={onGenerate}
              disabled={disabled || generating || groups.length > 0}
            >
              {generating ? "Generando..." : "Generar zonas"}
            </Button>
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
        </div>

        {/* Groups */}
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, g.id)}
            >
              <div className="flex justify-between">
                <div className="font-medium">{g.name.replace(/^Group\s+/i, "Grupo ")}</div>
                <div className="flex items-center gap-2">
                  {status === "upcoming" && g.teams.length === 0 && (
                    <button
                      onClick={() => removeEmptyGroup(g.id, g.name)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      Eliminar
                    </button>
                  )}
                  <Link
                    href={`/groups/${g.id}/standings`}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    Tabla
                  </Link>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {g.teams.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between rounded-xl border border-zinc-200 px-3 py-2"
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ teamId: t.id, groupId: g.id })
                      )
                    }
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Pareja {idx + 1}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {t.players?.[0]?.name ?? "Jugador"}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {t.players?.[1]?.name ?? "Jugador"}
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

      <Modal
        open={moveOpen}
        title="Mover equipo"
        onClose={() => setMoveOpen(false)}
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            Selecciona la pareja y la zona destino.
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500">Equipo</label>
            <select
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={moveTeamId}
              onChange={(e) => {
                const value = e.target.value;
                updateMoveTeam(value === "" ? "" : Number(value));
              }}
            >
              <option value="">Seleccionar pareja</option>
              {allTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamLabel(team)} ({team.group_name})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500">Zona destino</label>
            <select
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={moveTargetGroupId}
              onChange={(e) => {
                const value = e.target.value;
                setMoveTargetGroupId(value === "" ? "" : Number(value));
                setMoveSwapTeamId("");
              }}
            >
              <option value="">Seleccionar zona</option>
              {groups.map((group) => {
                const full = group.teams.length >= capacity;
                return (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.teams.length}/{capacity}
                    {full ? ", completa" : ""})
                  </option>
                );
              })}
            </select>
          </div>
          {selectedTargetGroup && targetIsFull && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500">
                Intercambiar con
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={moveSwapTeamId}
                onChange={(e) => {
                  const value = e.target.value;
                  setMoveSwapTeamId(value === "" ? "" : Number(value));
                }}
              >
                <option value="">Seleccionar pareja</option>
                {selectedTargetGroup.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {getTeamLabel(team)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {moveError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {moveError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitMove} disabled={moving}>
              {moving ? "Moviendo..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
