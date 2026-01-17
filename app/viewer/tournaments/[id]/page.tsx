"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import type {
  GroupStandingsOut,
  Match,
  Team,
  Tournament,
  TournamentGroupOut,
  TournamentStatus,
  TournamentStatusResponse,
} from "@/lib/types";

type IdParam = { id: string };

const STAGE_ORDER: Match["stage"][] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "final",
];

const PLAYOFF_STAGES: Match["stage"][] = [
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "final",
];

const STAGE_TEAM_COUNTS: Record<Match["stage"], number> = {
  group: 0,
  round_of_32: 32,
  round_of_16: 16,
  quarter: 8,
  semi: 4,
  final: 2,
};

function stageLabel(stage: Match["stage"]) {
  if (stage === "round_of_32") return "16vos";
  if (stage === "round_of_16") return "Octavos";
  if (stage === "quarter") return "Cuartos";
  if (stage === "semi") return "Semis";
  if (stage === "final") return "Final";
  return "Zonas";
}

export default function PublicTournamentPage() {
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standingsByGroup, setStandingsByGroup] = useState<Record<number, GroupStandingsOut>>({});

  const [query, setQuery] = useState("");
  const [showGroups, setShowGroups] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [tRes, statusRes, groupsRes, matchesRes, teamsRes] =
          await Promise.all([
            api<Tournament>(`/public/tournaments/${tournamentId}`, { auth: false }),
            api<TournamentStatusResponse>(`/public/tournaments/${tournamentId}/status`, { auth: false }),
            api<TournamentGroupOut[]>(`/public/tournaments/${tournamentId}/groups`, { auth: false }),
            api<Match[]>(`/public/tournaments/${tournamentId}/matches`, { auth: false }),
            api<Team[]>(`/public/tournaments/${tournamentId}/teams`, { auth: false }),
          ]);

        setTournament(tRes);
        setStatus(statusRes.status);
        setGroups(groupsRes);
        setMatches(matchesRes);
        setTeams(teamsRes);

        const standings = await Promise.all(
          groupsRes.map(async (group) => {
            try {
              return await api<GroupStandingsOut>(`/public/groups/${group.id}/standings`, { auth: false });
            } catch {
              return null;
            }
          })
        );

        const nextStandings: Record<number, GroupStandingsOut> = {};
        standings.forEach((row) => {
          if (row) nextStandings[row.group_id] = row;
        });
        setStandingsByGroup(nextStandings);
      } catch (err: any) {
        setError(err?.message ?? "No se pudo cargar el torneo");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tournamentId]);

  const teamsById = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const groupsById = useMemo(() => {
    const map = new Map<number, TournamentGroupOut>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  function getTeamLabel(teamId: number) {
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;
    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }

  function isMatchVisible(match: Match, normalized: string) {
    if (!normalized) return true;
    const aLabel = getTeamLabel(match.team_a_id).toLowerCase();
    const bLabel = getTeamLabel(match.team_b_id).toLowerCase();
    return aLabel.includes(normalized) || bLabel.includes(normalized);
  }

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups.filter((group) =>
      group.teams.some((team) =>
        team.players.some((player) => player.name.toLowerCase().includes(normalized))
      )
    );
  }, [groups, query]);

  const filteredMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return matches.filter((match) => isMatchVisible(match, normalized));
  }, [matches, query, teamsById]);

  const playoffMatches = useMemo(
    () => matches.filter((match) => match.stage !== "group"),
    [matches]
  );
  const hasPlayoffs = playoffMatches.length > 0;

  useEffect(() => {
    if (hasPlayoffs) setShowGroups(false);
  }, [hasPlayoffs]);

  const sortedMatches = useMemo(() => {
    return [...filteredMatches].sort((a, b) => {
      const stageDiff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return a.id - b.id;
    });
  }, [filteredMatches]);

  const pendingMatches = useMemo(
    () => sortedMatches.filter((match) => match.status === "pending"),
    [sortedMatches]
  );
  const playedMatches = useMemo(
    () => sortedMatches.filter((match) => match.status === "played"),
    [sortedMatches]
  );

  function formatSets(sets: Match["sets"]) {
    if (!sets || sets.length === 0) return "-";
    return sets.map((set) => `${set.a}-${set.b}`).join(", ");
  }

  function formatSetLine(sets: Match["sets"], side: "a" | "b") {
    if (!sets || sets.length === 0) return "";
    return sets.map((set) => String(set[side] ?? "")).join("  ");
  }

  function normalizeTime(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 5);
  }

  const matchesByStage = useMemo(() => {
    const map = new Map<Match["stage"], Match[]>();
    PLAYOFF_STAGES.forEach((stage) => map.set(stage, []));
    playoffMatches.forEach((match) => {
      map.get(match.stage)?.push(match);
    });
    return map;
  }, [playoffMatches]);

  const initialStage = useMemo(() => {
    for (const stage of PLAYOFF_STAGES) {
      const stageMatches = matchesByStage.get(stage) ?? [];
      if (stageMatches.length > 0) return stage;
    }
    return null;
  }, [matchesByStage]);

  const activeStages = useMemo(() => {
    if (!initialStage) return [];
    return PLAYOFF_STAGES.filter(
      (stage) => PLAYOFF_STAGES.indexOf(stage) >= PLAYOFF_STAGES.indexOf(initialStage)
    );
  }, [initialStage]);

  const finalWinner = useMemo(() => {
    const finals = matchesByStage.get("final") ?? [];
    const finalMatch = finals.find(
      (match) => match.status === "played" && match.winner_team_id
    );
    if (!finalMatch || !finalMatch.winner_team_id) return null;
    const team = teamsById.get(finalMatch.winner_team_id);
    const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
    const name = names.length > 0 ? names.join(" / ") : `Team #${finalMatch.winner_team_id}`;
    return name;
  }, [matchesByStage, teamsById]);

  function renderMatchRow(match: Match) {
    const group = match.group_id ? groupsById.get(match.group_id) : null;
    const stage = match.stage === "group" ? group?.name ?? "Zona" : stageLabel(match.stage);
    const teamALabel = getTeamLabel(match.team_a_id);
    const teamBLabel = getTeamLabel(match.team_b_id);
    const winnerId = match.winner_team_id;

    return (
      <div
        key={match.id}
        className="rounded-xl bg-zinc-200 p-3 shadow-sm shadow-black/10"
      >
        <div className="text-xs font-semibold text-zinc-700">{stage}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={winnerId === match.team_a_id ? "font-semibold text-emerald-700" : ""}>
            {teamALabel}
          </span>
          <span className="text-zinc-600">vs</span>
          <span className={winnerId === match.team_b_id ? "font-semibold text-emerald-700" : ""}>
            {teamBLabel}
          </span>
          <span className="text-zinc-500">|</span>
          <span className="font-semibold text-zinc-700">
            {match.status === "played" ? formatSets(match.sets) : "Pendiente"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {tournament?.club_logo_url ? (
            <img
              src={tournament.club_logo_url}
              alt={tournament.club_name ?? "Logo del club"}
              className="h-14 w-14 rounded-2xl border border-zinc-800 object-cover"
            />
          ) : null}
          <div>
            <h1 className="text-3xl font-semibold">
              {tournament ? tournament.name : "Torneo"}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {tournament?.club_name ? tournament.club_name : "Club"}
              {tournament?.location ? ` · ${tournament.location}` : " · Sede a confirmar"}
            </p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <Card className="bg-white/95">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-zinc-800">Categoria</div>
            <div className="text-sm font-semibold text-zinc-600">
              {tournament?.category ?? "Libre"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-800">Fecha</div>
            <div className="text-sm font-semibold text-zinc-600">
              {tournament?.start_date ?? "Por definir"} - {tournament?.end_date ?? "Por definir"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-800">Partidos</div>
            <div className="text-sm font-semibold text-zinc-600">
              {playedMatches.length} jugados / {matches.length} totales
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-white/95">
        <div className="p-5">
          <div className="text-sm font-medium text-zinc-700">Buscar jugador o pareja</div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ej: Juan / Pedro"
          />
        </div>
      </Card>

      {loading ? (
        <Card className="bg-white/95">
          <div className="p-5 text-sm text-zinc-400">Cargando...</div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {finalWinner && (
            <Card className="bg-white/95">
              <div className="p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  🏆 Pareja ganadora
                </div>
                <div className="mt-2 rounded-2xl border border-emerald-300 bg-emerald-100/70 px-4 py-3 text-lg font-semibold text-emerald-900">
                  {finalWinner}
                </div>
              </div>
            </Card>
          )}

          {hasPlayoffs && initialStage && (
            <Card className="bg-white/95">
              <div className="p-5 space-y-4">
                <div className="text-sm font-semibold text-zinc-800">
                  Llaves de playoffs
                </div>
                <div className="overflow-x-auto">
                  <div className="flex w-full justify-between gap-8 pb-2">
                    {activeStages.map((stage, stageIdx) => {
                      const stageMatches = [...(matchesByStage.get(stage) ?? [])].sort(
                        (a, b) => a.id - b.id
                      );
                      const expectedMatches = STAGE_TEAM_COUNTS[stage] / 2;
                      const prevStage = stageIdx > 0 ? activeStages[stageIdx - 1] : null;
                      const prevStageMatches = prevStage
                        ? [...(matchesByStage.get(prevStage) ?? [])].sort(
                            (a, b) => a.id - b.id
                          )
                        : [];
                      const seededPlaceholders = Array.from(
                        { length: expectedMatches },
                        (_, idx) => {
                          if (!prevStage) return { type: "placeholder", key: `${stage}-${idx}` };
                          const left = prevStageMatches[idx * 2];
                          const right = prevStageMatches[idx * 2 + 1];
                          const leftWinner = left?.winner_team_id ?? null;
                          const rightWinner = right?.winner_team_id ?? null;
                          return {
                            type: "placeholder",
                            key: `${stage}-placeholder-${idx}`,
                            seedA: leftWinner ? getTeamLabel(leftWinner) : "Por definir",
                            seedB: rightWinner ? getTeamLabel(rightWinner) : "Por definir",
                          };
                        }
                      );
                      const items = Array.from({ length: expectedMatches }, (_, idx) => {
                        const match = stageMatches[idx];
                        if (match) return { type: "match", match };
                        return seededPlaceholders[idx];
                      });
                      const baseMatches = initialStage
                        ? STAGE_TEAM_COUNTS[initialStage] / 2
                        : 0;
                      const rowHeight = 18;
                      const cardSpan = 5;
                      const gapSpan = 1;
                      const baseStep = cardSpan + gapSpan;
                      const totalRows = Math.max(1, baseMatches * baseStep);
                      const step = baseStep * Math.pow(2, stageIdx);
                      const offset =
                        stageIdx === 0
                          ? 1
                          : Math.max(
                              1,
                              Math.floor(step / 2) - Math.floor(cardSpan / 2) + 1
                            );

                      return (
                        <div key={stage} className="min-w-[260px] space-y-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {stageLabel(stage)}
                          </div>
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateRows: `repeat(${totalRows}, ${rowHeight}px)`,
                            }}
                          >
                            {items.map((item, idx) => {
                              const rowStart = idx * step + offset;
                              const gridStyle = {
                                gridRow: `${rowStart} / span ${cardSpan}`,
                              } as const;

                              if (item.type === "placeholder") {
                                const seedA =
                                  "seedA" in item ? item.seedA : "Por definir";
                                const seedB =
                                  "seedB" in item ? item.seedB : "Por definir";
                                return (
                                  <div
                                    key={item.key}
                                    className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-400"
                                    style={gridStyle}
                                  >
                                    <div className="text-xs uppercase tracking-[0.12em]">
                                      Por definir
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-600">
                                      {seedA}
                                    </div>
                                    <div className="text-xs text-zinc-400">vs</div>
                                    <div className="text-sm text-zinc-600">
                                      {seedB}
                                    </div>
                                  </div>
                                );
                              }

                              const match = item.match;
                              const played = match.status === "played";
                              const schedule = match.scheduled_date
                                ? `${match.scheduled_date} · ${normalizeTime(match.scheduled_time)}`
                                : normalizeTime(match.scheduled_time);
                              const scoreA = played ? formatSetLine(match.sets, "a") : "";
                              const scoreB = played ? formatSetLine(match.sets, "b") : "";
                              const aWinner = match.winner_team_id === match.team_a_id;
                              const bWinner = match.winner_team_id === match.team_b_id;
                              return (
                                <div
                                  key={match.id}
                                  className={`rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                                    played
                                      ? "border-emerald-300 bg-emerald-100/70"
                                      : "border-zinc-200 bg-white"
                                  }`}
                                  style={gridStyle}
                                >
                                  <div className="text-xs text-zinc-500">Partido</div>
                                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                                    <div
                                      className={`font-medium text-zinc-900 ${
                                        match.winner_team_id === match.team_a_id
                                          ? "font-semibold"
                                          : ""
                                      }`}
                                    >
                                      {getTeamLabel(match.team_a_id)}
                                    </div>
                                    {played && (
                                      <div
                                        className={`text-sm text-right ${
                                          aWinner
                                            ? "font-semibold text-zinc-900"
                                            : "font-normal text-zinc-400"
                                        }`}
                                      >
                                        {scoreA}
                                      </div>
                                    )}
                                    <div
                                      className={`font-medium text-zinc-900 ${
                                        match.winner_team_id === match.team_b_id
                                          ? "font-semibold"
                                          : ""
                                      }`}
                                    >
                                      {getTeamLabel(match.team_b_id)}
                                    </div>
                                    {played && (
                                      <div
                                        className={`text-sm text-right ${
                                          bWinner
                                            ? "font-semibold text-zinc-900"
                                            : "font-normal text-zinc-400"
                                        }`}
                                      >
                                        {scoreB}
                                      </div>
                                    )}
                                  </div>
                                  {played && (
                                    <div className="mt-1 h-px w-full bg-emerald-400/70" />
                                  )}
                                  {schedule ? (
                                    <div className="mt-1 text-xs text-zinc-500">
                                      {schedule}
                                    </div>
                                  ) : (
                                    <div className="mt-1 text-xs text-zinc-500">
                                      Horario a confirmar
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-semibold">Zonas y posiciones</h2>
              {hasPlayoffs && (
                <button
                  type="button"
                  onClick={() => setShowGroups((prev) => !prev)}
                  className="text-sm font-semibold text-emerald-200 hover:text-emerald-100"
                >
                  {showGroups ? "Ocultar zonas" : "Mostrar zonas"}
                </button>
              )}
            </div>
            {filteredGroups.length === 0 ? (
              <Card className="bg-white/95">
                <div className="p-5 text-sm text-zinc-400">
                  Todavia no hay zonas cargadas.
                </div>
              </Card>
            ) : showGroups ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredGroups.map((group) => {
                  const standings = standingsByGroup[group.id]?.standings ?? [];
                  return (
                    <Card key={group.id}>
                      <div className="space-y-4 p-5">
                        <div className="text-sm font-semibold text-zinc-800">{group.name}</div>
                        <div className="space-y-2 text-sm text-zinc-800">
                          {group.teams.map((team) => {
                            const label =
                              team.players.map((player) => player.name).join(" / ") ||
                              `Team #${team.id}`;
                            return (
                              <div key={team.id} className="rounded-lg border border-zinc-800 px-3 py-2">
                                {label}
                              </div>
                            );
                          })}
                        </div>

                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-zinc-500">
                                <th className="py-2">Equipo</th>
                                <th className="py-2">PJ</th>
                                <th className="py-2">PG</th>
                                <th className="py-2">PP</th>
                                <th className="py-2">Sets</th>
                                <th className="py-2">Games</th>
                                <th className="py-2">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {standings.map((row) => {
                                const teamLabel =
                                  row.team.players.map((player) => player.name).join(" / ") ||
                                  `Team #${row.team.id}`;
                                return (
                                  <tr key={row.team.id} className="border-t border-zinc-800">
                                    <td className="py-2 font-medium">{teamLabel}</td>
                                    <td className="py-2">{row.played}</td>
                                    <td className="py-2">{row.won}</td>
                                    <td className="py-2">{row.lost}</td>
                                    <td className="py-2">
                                      {row.sets_for}-{row.sets_against}
                                    </td>
                                    <td className="py-2">
                                      {row.games_for}-{row.games_against}
                                    </td>
                                    <td className="py-2 font-semibold">{row.points}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-white/95">
                <div className="p-5 text-sm text-zinc-400">
                  Zonas comprimidas. Usá “Mostrar zonas” para ver la tabla completa.
                </div>
              </Card>
            )}
          </div>

          {!hasPlayoffs && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Partidos</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <div className="space-y-3 p-5">
                    <div className="text-sm font-semibold text-zinc-800">Proximos</div>
                    {pendingMatches.length === 0 ? (
                      <div className="text-sm text-zinc-400">No hay partidos pendientes.</div>
                    ) : (
                      <div className="space-y-3">
                        {pendingMatches.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
                <Card>
                  <div className="space-y-3 p-5">
                    <div className="text-sm font-semibold text-zinc-800">Resultados</div>
                    {playedMatches.length === 0 ? (
                      <div className="text-sm text-zinc-400">No hay resultados cargados.</div>
                    ) : (
                      <div className="space-y-3">
                        {playedMatches.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
