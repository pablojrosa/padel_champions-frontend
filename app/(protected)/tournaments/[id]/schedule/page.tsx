"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError, apiMaybe } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Match, Team, Tournament, TournamentGroupOut } from "@/lib/types";

type IdParam = { id: string };
type EditableSet = { a: string; b: string };

const DEFAULT_SETS: EditableSet[] = [
  { a: "", b: "" },
  { a: "", b: "" },
  { a: "", b: "" },
];

export default function TournamentSchedulePage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [setsInput, setSetsInput] = useState<EditableSet[]>(DEFAULT_SETS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [courtWidth, setCourtWidth] = useState<number | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [tournaments, tMatches, tTeams, tGroups] = await Promise.all([
          api<Tournament[]>("/tournaments"),
          apiMaybe<Match[]>(`/tournaments/${tournamentId}/matches`) || Promise.resolve([]),
          apiMaybe<Team[]>(`/tournaments/${tournamentId}/teams`) || Promise.resolve([]),
          apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) || Promise.resolve([]),
        ]);

        const found = tournaments.find((t) => t.id === tournamentId) ?? null;
        setTournament(found);
        setMatches(tMatches || []);
        setTeams(tTeams || []);
        setGroups(tGroups || []);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudo cargar el cronograma");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tournamentId, router]);

  const groupsById = useMemo(() => {
    const map = new Map<number, TournamentGroupOut>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  function getTeamLabel(teamId: number) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return `Team #${teamId}`;
    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }

  function getStageLabel(match: Match) {
    if (match.stage === "group") {
      const group = match.group_id ? groupsById.get(match.group_id) : null;
      return group ? group.name : "Zona";
    }

    if (match.stage === "quarter") return "Cuartos";
    if (match.stage === "semi") return "Semis";
    if (match.stage === "round_of_16") return "Octavos";
    if (match.stage === "round_of_32") return "16vos";
    return "Final";
  }

  function parseTimeToMinutes(value: string) {
    const parts = value.split(":").map((part) => Number(part));
    if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return null;
    const [hours, minutes] = parts;
    return hours * 60 + minutes;
  }

  function formatMinutes(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function formatSets(sets: Match["sets"]) {
    if (!sets || sets.length === 0) return "-";
    return sets.map((set) => `${set.a}-${set.b}`).join(", ");
  }

  function updateSet(idx: number, key: "a" | "b", value: string) {
    setSetsInput((prev) =>
      prev.map((setScore, i) => (i === idx ? { ...setScore, [key]: value } : setScore))
    );
  }

  function buildPayloadSets(): Match["sets"] | null {
    const filtered = setsInput.filter((setScore) => setScore.a !== "" || setScore.b !== "");

    if (filtered.length < 2) {
      setFormError("Tenes que cargar al menos 2 sets.");
      return null;
    }

    if (filtered.length > 3) {
      setFormError("Maximo 3 sets.");
      return null;
    }

    const payload: { a: number; b: number }[] = [];

    for (let i = 0; i < filtered.length; i += 1) {
      const a = Number(filtered[i].a);
      const b = Number(filtered[i].b);

      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        setFormError(`Set ${i + 1} incompleto.`);
        return null;
      }

      if (a < 0 || b < 0) {
        setFormError(`Set ${i + 1} invalido.`);
        return null;
      }

      if (a === b) {
        setFormError(`Set ${i + 1} no puede empatar.`);
        return null;
      }

      payload.push({ a, b });
    }

    return payload;
  }

  const scheduleSuggestion = useMemo(() => {
    if (
      !tournament?.start_time ||
      !tournament?.end_time ||
      !tournament?.match_duration_minutes ||
      !tournament?.courts_count
    ) {
      return null;
    }

    const startMinutes = parseTimeToMinutes(tournament.start_time);
    const endMinutes = parseTimeToMinutes(tournament.end_time);
    if (startMinutes === null || endMinutes === null) return null;

    const duration = tournament.match_duration_minutes;
    const courts = tournament.courts_count;
    if (duration <= 0 || courts <= 0) return null;

    const slots: number[] = [];
    for (let t = startMinutes; t + duration <= endMinutes; t += duration) {
      slots.push(t);
    }

    const stageOrder: Match["stage"][] = [
      "group",
      "round_of_32",
      "round_of_16",
      "quarter",
      "semi",
      "final",
    ];

    const sortedMatches = [...matches].sort((a, b) => {
      const stageDiff = stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);
      if (stageDiff !== 0) return stageDiff;
      return a.id - b.id;
    });

    const rows = slots.map((slotTime) => ({
      time: slotTime,
      matches: Array.from({ length: courts }, () => null as Match | null),
    }));

    const slotIndexByTime = new Map<number, number>();
    slots.forEach((slotTime, index) => {
      slotIndexByTime.set(slotTime, index);
    });

    const placedMatchIds = new Set<number>();

    matches.forEach((match) => {
      if (!match.scheduled_time || !match.court_number) return;
      const timeMinutes = parseTimeToMinutes(match.scheduled_time);
      if (timeMinutes === null) return;
      const rowIndex = slotIndexByTime.get(timeMinutes);
      if (rowIndex === undefined) return;
      const courtIndex = match.court_number - 1;
      if (courtIndex < 0 || courtIndex >= courts) return;
      if (rows[rowIndex].matches[courtIndex]) return;
      rows[rowIndex].matches[courtIndex] = match;
      placedMatchIds.add(match.id);
    });

    const remainingMatches = sortedMatches.filter((match) => !placedMatchIds.has(match.id));

    let remainingIndex = 0;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      for (let courtIndex = 0; courtIndex < courts; courtIndex += 1) {
        if (rows[rowIndex].matches[courtIndex]) continue;
        const nextMatch = remainingMatches[remainingIndex];
        if (!nextMatch) break;
        rows[rowIndex].matches[courtIndex] = nextMatch;
        remainingIndex += 1;
      }
    }

    const totalSlots = slots.length * courts;
    const overflow = Math.max(0, sortedMatches.length - totalSlots);

    const matchOrder = new Map<number, number>();
    let orderIndex = 1;
    rows.forEach((row) => {
      row.matches.forEach((match) => {
        if (!match) return;
        if (!matchOrder.has(match.id)) {
          matchOrder.set(match.id, orderIndex);
          orderIndex += 1;
        }
      });
    });

    return { rows, overflow, courts, matchOrder };
  }, [tournament, matches, groupsById]);

  useEffect(() => {
    if (!scheduleSuggestion || !tableWrapRef.current) return;
    const hourCol = 96;
    const visibleCourts = Math.min(5, scheduleSuggestion.courts);

    const compute = () => {
      const width = tableWrapRef.current?.clientWidth ?? 0;
      if (width <= hourCol) return;
      const nextCourtWidth = (width - hourCol) / visibleCourts;
      setCourtWidth(nextCourtWidth);
    };

    compute();

    const observer = new ResizeObserver(compute);
    observer.observe(tableWrapRef.current);
    return () => observer.disconnect();
  }, [scheduleSuggestion]);

  const tableMinWidth = useMemo(() => {
    if (!scheduleSuggestion || !courtWidth) return undefined;
    if (scheduleSuggestion.courts <= 5) return undefined;
    const hourCol = 96;
    return hourCol + courtWidth * scheduleSuggestion.courts;
  }, [scheduleSuggestion, courtWidth]);

  function statusLabel(status: Match["status"]) {
    if (status === "played") return "Finalizado";
    if (status === "ongoing") return "Jugando";
    return "Por jugar";
  }

  function statusBadgeClass(status: Match["status"]) {
    if (status === "played") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (status === "ongoing") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }

  async function startMatch(match: Match) {
    try {
      const updated = await api<Match>(`/matches/${match.id}/start`, { method: "POST" });
      setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMatch(updated);
      setFormError(null);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar el partido");
    }
  }

  async function moveMatch(match: Match, timeMinutes: number, courtNumber: number) {
    try {
      const payload = {
        scheduled_time: formatMinutes(timeMinutes),
        court_number: courtNumber,
      };
      const res = await api<{ updated: Match; swapped: Match | null }>(
        `/matches/${match.id}/schedule`,
        { method: "POST", body: payload }
      );
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id === res.updated.id) return res.updated;
          if (res.swapped && m.id === res.swapped.id) return res.swapped;
          return m;
        })
      );
    } catch (err: any) {
      setError(err?.message ?? "No se pudo reprogramar el partido");
    }
  }

  function handleDrop(e: React.DragEvent<HTMLTableCellElement>, slotTime: number, courtIndex: number) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { matchId: number };
      const match = matches.find((m) => m.id === parsed.matchId);
      if (!match || match.status !== "pending") return;
      moveMatch(match, slotTime, courtIndex + 1);
    } catch {
      // ignore invalid payload
    }
  }
  async function saveResult(match: Match) {
    const payloadSets = buildPayloadSets();
    if (!payloadSets) return;

    setSaving(true);
    setFormError(null);

    try {
      const updated = await api<Match>(`/matches/${match.id}/result`, {
        method: "POST",
        body: { sets: payloadSets },
      });
      setMatches((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setSelectedMatch(updated);
    } catch (err: any) {
      setFormError(err?.message ?? "No se pudo guardar el resultado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 px-4 md:px-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Cronograma sugerido</h1>
          <p className="text-sm text-zinc-300">
            Distribucion automatica por cancha segun horario y duracion.
          </p>
        </div>

        <Button variant="secondary" onClick={() => router.push(`/tournaments/${tournamentId}`)}>
          Volver
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="p-5 text-sm text-zinc-600">Cargando...</div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card>
            <div className="p-5 space-y-3">
              {!tournament?.start_time ||
              !tournament?.end_time ||
              !tournament?.match_duration_minutes ||
              !tournament?.courts_count ? (
                <div className="text-sm text-zinc-600">
                  Completa horario de inicio/fin, duracion y canchas para ver el cronograma.
                </div>
              ) : matches.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  Todavia no hay partidos generados.
                </div>
              ) : scheduleSuggestion ? (
                <div className="space-y-3">
                  <div ref={tableWrapRef} className="overflow-x-auto hidden md:block">
                    <table
                      className="w-full text-sm table-fixed"
                      style={tableMinWidth ? { minWidth: tableMinWidth } : undefined}
                    >
                      <colgroup>
                        <col style={{ width: 96 }} />
                        {Array.from({ length: scheduleSuggestion.courts }).map((_, idx) => (
                          <col key={idx} style={{ width: courtWidth ?? 200 }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr className="text-left text-zinc-500">
                          <th className="py-2">Hora</th>
                          {Array.from({ length: scheduleSuggestion.courts }).map((_, idx) => (
                            <th key={idx} className="py-2">
                              Cancha {idx + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleSuggestion.rows.map((row) => (
                          <tr key={row.time} className="border-t border-zinc-200">
                            <td className="py-2 font-medium text-zinc-700">
                              {formatMinutes(row.time)}
                            </td>
                            {row.matches.map((match, idx) => (
                              <td
                                key={idx}
                                className="py-2 pr-4 align-top"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDrop(e, row.time, idx)}
                              >
                                {match ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMatch(match);
                                      setFormError(null);
                                      if (match.sets && match.sets.length > 0) {
                                        const mapped = match.sets.map((setScore) => ({
                                          a: String(setScore.a),
                                          b: String(setScore.b),
                                        }));
                                        setSetsInput([...mapped, ...DEFAULT_SETS].slice(0, 3));
                                      } else {
                                        setSetsInput(DEFAULT_SETS);
                                      }
                                    }}
                                    className="relative w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
                                    draggable={match.status === "pending"}
                                    onDragStart={(e) => {
                                      if (match.status !== "pending") return;
                                      e.dataTransfer.setData(
                                        "application/json",
                                        JSON.stringify({ matchId: match.id })
                                      );
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                  >
                                    <span
                                      className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(match.status)}`}
                                    >
                                      {statusLabel(match.status)}
                                    </span>
                                    <div className="text-xs text-zinc-500">
                                      {getStageLabel(match)}
                                    </div>
                                    <div className="font-semibold text-zinc-800">
                                      Partido {scheduleSuggestion.matchOrder.get(match.id) ?? match.id}
                                    </div>
                                  </button>
                                ) : (
                                  <span className="text-xs text-zinc-400">-</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {scheduleSuggestion.rows.map((row) => (
                      <div key={row.time} className="rounded-xl border border-zinc-200 bg-white p-3">
                        <div className="text-xs font-semibold text-zinc-500">
                          {formatMinutes(row.time)}
                        </div>
                        <div className="mt-2 space-y-2">
                          {row.matches.map((match, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="mt-1 inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                                Cancha {idx + 1}
                              </span>
                              {match ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMatch(match);
                                    setFormError(null);
                                    if (match.sets && match.sets.length > 0) {
                                      const mapped = match.sets.map((setScore) => ({
                                        a: String(setScore.a),
                                        b: String(setScore.b),
                                      }));
                                      setSetsInput([...mapped, ...DEFAULT_SETS].slice(0, 3));
                                    } else {
                                      setSetsInput(DEFAULT_SETS);
                                    }
                                  }}
                                  className="relative w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm shadow-sm"
                                >
                                  <span
                                    className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(match.status)}`}
                                  >
                                    {statusLabel(match.status)}
                                  </span>
                                  <div className="text-xs text-zinc-500">
                                    {getStageLabel(match)}
                                  </div>
                                  <div className="font-semibold text-zinc-800">
                                    Partido {scheduleSuggestion.matchOrder.get(match.id) ?? match.id}
                                  </div>
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">-</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {scheduleSuggestion.overflow > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Quedan {scheduleSuggestion.overflow} partidos fuera del rango horario.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-zinc-600">
                  No se pudo armar el cronograma con la configuracion actual.
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <Modal
        open={!!selectedMatch}
        title={selectedMatch ? `Partido ${scheduleSuggestion?.matchOrder.get(selectedMatch.id) ?? selectedMatch.id}` : "Partido"}
        onClose={() => {
          setSelectedMatch(null);
          setFormError(null);
          setSaving(false);
        }}
      >
        {selectedMatch && (
          <div className="space-y-4 text-sm">
            <div className="text-zinc-600">{getStageLabel(selectedMatch)}</div>
            <div className="text-base font-semibold text-zinc-900">
              {getTeamLabel(selectedMatch.team_a_id)} vs {getTeamLabel(selectedMatch.team_b_id)}
            </div>
            <div className="text-zinc-700">
              Estado: {statusLabel(selectedMatch.status)}
            </div>
            <div className="text-zinc-700">
              Resultado: {selectedMatch.status === "played" ? formatSets(selectedMatch.sets) : "-"}
            </div>

            {selectedMatch.status === "pending" && (
              <Button onClick={() => startMatch(selectedMatch)}>
                Comenzar partido
              </Button>
            )}

            {selectedMatch.status === "ongoing" && (
              <div className="space-y-3">
                {setsInput.map((setScore, idx) => (
                  <div key={idx} className="grid grid-cols-3 items-center gap-2">
                    <div className="text-sm text-zinc-600">Set {idx + 1}</div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="A"
                      value={setScore.a}
                      onChange={(e) => updateSet(idx, "a", e.target.value)}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="B"
                      value={setScore.b}
                      onChange={(e) => updateSet(idx, "b", e.target.value)}
                    />
                  </div>
                ))}

                {formError && (
                  <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                    {formError}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => saveResult(selectedMatch)} disabled={saving}>
                    {saving ? "Guardando..." : "Finalizar partido"}
                  </Button>
                </div>
              </div>
            )}

            {selectedMatch.status === "played" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Partido finalizado.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
