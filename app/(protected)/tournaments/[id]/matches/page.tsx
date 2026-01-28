"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type {
  Match,
  MatchSet,
  TournamentGroupOut,
  TournamentStatusResponse,
  Team,
} from "@/lib/types";

type IdParam = { id: string };

type EditableSet = { a: string; b: string };

const DEFAULT_SETS: EditableSet[] = [
  { a: "", b: "" },
  { a: "", b: "" },
  { a: "", b: "" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const COURT_BADGES = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-yellow-100 text-yellow-700",
  "bg-green-100 text-green-700",
  "bg-blue-100 text-blue-700",
  "bg-red-100 text-red-700",
  "bg-gray-100 text-gray-700",
  "bg-black-100 text-black-700",
  "bg-white-100 text-white-700",
  "bg-brown-100 text-brown-700",
  "bg-cyan-100 text-cyan-700",
  "bg-teal-100 text-teal-700",
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-indigo-100 text-indigo-700",
  "bg-lime-100 text-lime-700",
  "bg-fuchsia-100 text-fuchsia-700",
  
];

export default function TournamentMatchesPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [tournamentStatus, setTournamentStatus] = useState<string>("upcoming");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [setsInput, setSetsInput] = useState<EditableSet[]>(DEFAULT_SETS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"unscheduled" | "scheduled" | "played">("unscheduled");

  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleHour, setScheduleHour] = useState("");
  const [scheduleMinute, setScheduleMinute] = useState("");
  const [scheduleCourt, setScheduleCourt] = useState("1");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [gridMatch, setGridMatch] = useState<Match | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");
  const [nameQuery, setNameQuery] = useState("");

  const teamsById = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);
  const categories = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      team.players?.forEach((player) => {
        if (player.category) values.add(player.category);
      });
    });
    return Array.from(values).sort();
  }, [teams]);
  const genders = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      team.players?.forEach((player) => {
        if (player.gender) values.add(player.gender);
      });
    });
    return Array.from(values).sort();
  }, [teams]);

  const groupsById = useMemo(() => {
    const map = new Map<number, TournamentGroupOut>();
    groups.forEach((group) => map.set(group.id, group));
    return map;
  }, [groups]);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [matchesRes, teamsRes, groupsRes, statusRes] = await Promise.all([
          api<Match[]>(`/tournaments/${tournamentId}/matches`),
          api<Team[]>(`/tournaments/${tournamentId}/teams`),
          api<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`),
          api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
        ]);

        setMatches(matchesRes);
        setTeams(teamsRes);
        setGroups(groupsRes);
        setTournamentStatus(statusRes.status);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudieron cargar los partidos");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tournamentId, router]);

  function getTeamLabel(teamId: number) {
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;

    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }
  function getTeamCategory(teamId: number) {
    const team = teamsById.get(teamId);
    return team?.players?.[0]?.category ?? null;
  }
  function getTeamGender(teamId: number) {
    const team = teamsById.get(teamId);
    return team?.players?.[0]?.gender ?? null;
  }
  function getTeamSearchLabel(teamId: number) {
    const team = teamsById.get(teamId);
    const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return "";
    return names.join(" ").toLowerCase();
  }
  function getMatchCode(match: Match) {
    return match.match_code ?? String(match.id);
  }
  function getCourtBadgeClass(courtNumber?: number | null) {
    if (!courtNumber || courtNumber <= 0) {
      return "bg-zinc-100 text-zinc-600";
    }
    return COURT_BADGES[(courtNumber - 1) % COURT_BADGES.length];
  }

  function getStageLabel(match: Match) {
    if (match.stage === "group") {
      const group = match.group_id ? groupsById.get(match.group_id) : null;
      if (!group) return "Zona";
      return group.name.replace(/^group\s*/i, "Grupo ");
    }

    if (match.stage === "quarter") return "Cuartos";
    if (match.stage === "semi") return "Semis";
    if (match.stage === "round_of_16") return "Octavos";
    if (match.stage === "round_of_32") return "16vos";
    return "Final";
  }

  function openResultModal(match: Match) {
    setSelectedMatch(match);
    setFormError(null);
    setSuccessMessage(null);

    if (match.sets && match.sets.length > 0) {
      const mapped = match.sets.map((setScore) => ({
        a: String(setScore.a),
        b: String(setScore.b),
      }));
      setSetsInput([...mapped, ...DEFAULT_SETS].slice(0, 3));
    } else {
      setSetsInput(DEFAULT_SETS);
    }
  }

  function closeResultModal() {
    setSelectedMatch(null);
    setFormError(null);
    setSuccessMessage(null);
  }

  function normalizeTime(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 5);
  }
  function formatShortDate(value: string) {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}`;
  }

  function openScheduleModal(match: Match) {
    setScheduleMatch(match);
    setScheduleDate(match.scheduled_date ?? "");
    const normalized = normalizeTime(match.scheduled_time);
    const [hour = "", minute = ""] = normalized.split(":");
    setScheduleHour(hour);
    setScheduleMinute(minute === "00" || minute === "30" ? minute : "");
    setScheduleCourt(match.court_number ? String(match.court_number) : "1");
    setScheduleError(null);
  }

  function closeScheduleModal() {
    setScheduleMatch(null);
    setScheduleHour("");
    setScheduleMinute("");
    setScheduleError(null);
  }

  function updateSet(idx: number, key: "a" | "b", value: string) {
    setSetsInput((prev) =>
      prev.map((setScore, i) =>
        i === idx ? { ...setScore, [key]: value } : setScore
      )
    );
  }

  function buildPayloadSets(): MatchSet[] | null {
    const filtered = setsInput.filter((setScore) =>
      setScore.a !== "" || setScore.b !== ""
    );

    if (filtered.length < 2) {
      setFormError("Tenes que cargar al menos 2 sets.");
      return null;
    }

    if (filtered.length > 3) {
      setFormError("Maximo 3 sets.");
      return null;
    }

    const payload: MatchSet[] = [];

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

  async function saveResult() {
    if (!selectedMatch) return;

    const payloadSets = buildPayloadSets();
    if (!payloadSets) return;

    setSaving(true);
    setFormError(null);

    try {
      const updated = await api<Match>(`/matches/${selectedMatch.id}/result`, {
        method: "POST",
        body: { sets: payloadSets },
      });

      setMatches((prev) =>
        prev.map((match) => (match.id === updated.id ? updated : match))
      );
      setSelectedMatch(updated);
      setSuccessMessage("Resultado cargado con exito.");
      setTimeout(() => {
        closeResultModal();
      }, 900);
    } catch (err: any) {
      setFormError(err?.message ?? "No se pudo guardar el resultado");
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (!scheduleMatch) return;

    if (!scheduleDate || !scheduleHour || !scheduleMinute) {
      setScheduleError("Selecciona fecha y horario.");
      return;
    }

    if (scheduleMinute !== "00" && scheduleMinute !== "30") {
      setScheduleError("Los turnos deben ser a las :00 o :30.");
      return;
    }

    const courtNumber = Number(scheduleCourt);
    if (!Number.isFinite(courtNumber) || courtNumber <= 0) {
      setScheduleError("La cancha debe ser un numero valido.");
      return;
    }

    setScheduling(true);
    setScheduleError(null);

    try {
      const scheduleTime = `${scheduleHour}:${scheduleMinute}`;
      const res = await api<{ updated: Match; swapped: Match | null }>(
        `/matches/${scheduleMatch.id}/schedule`,
        {
          method: "POST",
          body: {
            scheduled_date: scheduleDate,
            scheduled_time: scheduleTime,
            court_number: courtNumber,
          },
        }
      );

      setMatches((prev) =>
        prev.map((match) => {
          if (match.id === res.updated.id) return res.updated;
          if (res.swapped && match.id === res.swapped.id) return res.swapped;
          return match;
        })
      );
      closeScheduleModal();
    } catch (err: any) {
      setScheduleError(err?.message ?? "No se pudo programar el partido");
    } finally {
      setScheduling(false);
    }
  }

  const canSchedule = tournamentStatus !== "finished";
  const canResult = tournamentStatus === "ongoing" || tournamentStatus === "groups_finished";
  const categoryFilteredMatches = useMemo(() => {
    const normalizedQuery = nameQuery.trim().toLowerCase();
    return matches.filter((match) => {
      const category = getTeamCategory(match.team_a_id);
      const gender = getTeamGender(match.team_a_id);
      const categoryMatch = categoryFilter === "all" || category === categoryFilter;
      const genderMatch = genderFilter === "all" || gender === genderFilter;
      if (!categoryMatch || !genderMatch) return false;
      if (!normalizedQuery) return true;
      const aLabel = getTeamSearchLabel(match.team_a_id);
      const bLabel = getTeamSearchLabel(match.team_b_id);
      return aLabel.includes(normalizedQuery) || bLabel.includes(normalizedQuery);
    });
  }, [matches, categoryFilter, genderFilter, nameQuery, teamsById]);
  const unscheduledMatches = useMemo(
    () => categoryFilteredMatches.filter((match) => match.status !== "played" && !match.scheduled_time),
    [categoryFilteredMatches]
  );
  const scheduledMatches = useMemo(
    () => categoryFilteredMatches.filter((match) => match.status !== "played" && !!match.scheduled_time),
    [categoryFilteredMatches]
  );
  const playedMatches = useMemo(
    () => categoryFilteredMatches.filter((match) => match.status === "played"),
    [categoryFilteredMatches]
  );
  const groupStageComplete = useMemo(() => {
    if (groups.length === 0) return false;

    for (const group of groups) {
      const groupMatches = matches.filter(
        (match) => match.stage === "group" && match.group_id === group.id
      );
      const expected = (group.teams.length * (group.teams.length - 1)) / 2;

      if (groupMatches.length < expected) return false;
      if (groupMatches.some((match) => match.status !== "played" || !match.sets)) {
        return false;
      }
    }

    return true;
  }, [groups, matches]);
  const gridData = useMemo(() => {
    const gridMatches = scheduledMatches.filter(
      (match) => match.scheduled_date && match.scheduled_time
    );
    const dates = Array.from(
      new Set(gridMatches.map((match) => match.scheduled_date as string))
    ).sort();
    const times = Array.from(
      new Set(
        gridMatches
          .map((match) => normalizeTime(match.scheduled_time))
          .filter(Boolean)
      )
    ).sort();
    const map = new Map<string, Map<string, Match[]>>();

    gridMatches.forEach((match) => {
      const dateKey = match.scheduled_date as string;
      const timeKey = normalizeTime(match.scheduled_time);
      if (!timeKey) return;
      if (!map.has(dateKey)) {
        map.set(dateKey, new Map());
      }
      const timeMap = map.get(dateKey)!;
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, []);
      }
      timeMap.get(timeKey)!.push(match);
    });

    map.forEach((timeMap) => {
      timeMap.forEach((matchesInCell) => {
        matchesInCell.sort(
          (a, b) => (a.court_number ?? 0) - (b.court_number ?? 0)
        );
      });
    });

    return { dates, times, map };
  }, [scheduledMatches]);
  const matchesForTab =
    activeTab === "unscheduled"
      ? unscheduledMatches
      : activeTab === "scheduled"
        ? scheduledMatches
        : playedMatches;
  const emptyLabel =
    activeTab === "unscheduled"
      ? "No hay partidos para programar."
      : activeTab === "scheduled"
        ? "No hay partidos programados."
        : "No hay partidos jugados.";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Calendario
          </div>
          <h1 className="text-3xl font-semibold">Partidos</h1>
          <p className="text-sm text-zinc-300">Resultados y estado por fase.</p>
        </div>

        <Button variant="secondary" onClick={() => router.push(`/tournaments/${tournamentId}`)}>
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
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={activeTab === "unscheduled" ? "primary" : "secondary"}
                    onClick={() => setActiveTab("unscheduled")}
                  >
                    Faltan programar ({unscheduledMatches.length})
                  </Button>
                  <Button
                    variant={activeTab === "scheduled" ? "primary" : "secondary"}
                    onClick={() => setActiveTab("scheduled")}
                  >
                    Programados ({scheduledMatches.length})
                  </Button>
                  <Button
                    variant={activeTab === "played" ? "primary" : "secondary"}
                    onClick={() => setActiveTab("played")}
                  >
                    Jugados ({playedMatches.length})
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Buscar pareja"
                    className="w-48"
                  />
                  {categories.length > 0 && (
                    <select
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                      value={categoryFilter}
                      onChange={(e) =>
                        setCategoryFilter(
                          e.target.value === "all" ? "all" : e.target.value
                        )
                      }
                    >
                      <option value="all">Todas (categorias)</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  )}
                  {genders.length > 0 && (
                    <select
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                      value={genderFilter}
                      onChange={(e) =>
                        setGenderFilter(
                          e.target.value === "all" ? "all" : e.target.value
                        )
                      }
                    >
                      <option value="all">Todos (genero)</option>
                      {genders.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender === "damas" ? "Damas" : "Masculino"}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button variant="secondary" onClick={() => setGridOpen(true)}>
                    Grilla de partidos
                  </Button>
                  {groupStageComplete && (
                    <Link
                      href={`/tournaments/${tournamentId}/playoffs`}
                      className="inline-flex items-center justify-center rounded-xl border border-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Playoffs
                    </Link>
                  )}
                </div>
              </div>

              {matches.length === 0 ? (
                <div className="text-sm text-zinc-600">No hay partidos cargados.</div>
              ) : matchesForTab.length === 0 ? (
                <div className="text-sm text-zinc-600">{emptyLabel}</div>
              ) : (
                matchesForTab.map((match) => (
                  <div
                    key={match.id}
                    className="rounded-2xl border border-zinc-200 p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs text-zinc-500">
                          {getStageLabel(match)} · Partido {getMatchCode(match)}
                        </div>
                        <div className="text-sm font-medium">
                          {getTeamLabel(match.team_a_id)} vs {getTeamLabel(match.team_b_id)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Estado: {match.status === "played" ? "Jugado" : match.scheduled_time ? "Programado" : "Falta programar"}
                        </div>
                        {match.scheduled_time && (
                          <div className="text-xs text-zinc-500">
                            {match.scheduled_date ? `Fecha: ${match.scheduled_date} · ` : ""}
                            Hora: {normalizeTime(match.scheduled_time)} · Cancha: {match.court_number ?? "—"}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {match.status === "played" ? (
                          <Button onClick={() => openResultModal(match)} disabled={!canResult}>
                            Editar resultado
                          </Button>
                        ) : match.scheduled_time ? (
                          <>
                            <Button onClick={() => openResultModal(match)} disabled={!canResult}>
                              Cargar resultado
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => openScheduleModal(match)}
                              disabled={!canSchedule}
                            >
                              Editar horario
                            </Button>
                          </>
                        ) : (
                          <Button onClick={() => openScheduleModal(match)} disabled={!canSchedule}>
                            Programar partido
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </>
      )}

      <Modal
        open={!!scheduleMatch}
        title="Programar partido"
        onClose={closeScheduleModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (scheduling) return;
            saveSchedule();
          }}
        >
          <div className="text-sm text-zinc-600">
            {scheduleMatch
              ? `Partido ${getMatchCode(scheduleMatch)} · ${getTeamLabel(
                  scheduleMatch.team_a_id
                )} vs ${getTeamLabel(scheduleMatch.team_b_id)}`
              : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                value={scheduleHour}
                onChange={(e) => setScheduleHour(e.target.value)}
              >
                <option value="">Hora</option>
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                value={scheduleMinute}
                onChange={(e) => setScheduleMinute(e.target.value)}
              >
                <option value="">Min</option>
                <option value="00">00</option>
                <option value="30">30</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500">Cancha</label>
            <Input
              type="number"
              min={1}
              placeholder="Numero de cancha"
              value={scheduleCourt}
              onChange={(e) => setScheduleCourt(e.target.value)}
            />
          </div>

          {scheduleError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {scheduleError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeScheduleModal} type="button">
              Cancelar
            </Button>
            <Button type="submit" disabled={scheduling}>
              {scheduling ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selectedMatch}
        title="Cargar resultado"
        onClose={closeResultModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canResult || saving) return;
            saveResult();
          }}
        >
          <div className="text-sm text-zinc-600">
            {selectedMatch
              ? `Partido ${getMatchCode(selectedMatch)} · ${getTeamLabel(
                  selectedMatch.team_a_id
                )} vs ${getTeamLabel(selectedMatch.team_b_id)}`
              : null}
          </div>

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
                  disabled={!canResult}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="B"
                  value={setScore.b}
                  onChange={(e) => updateSet(idx, "b", e.target.value)}
                  disabled={!canResult}
                />
              </div>
            ))}
          </div>

          {formError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}

          {!canResult && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Los resultados solo se pueden editar mientras el torneo esta en curso.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeResultModal} type="button">
              Cancelar
            </Button>
            <Button type="submit" disabled={!canResult || saving}>
              {saving ? "Guardando..." : "Guardar resultado"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={gridOpen}
        title="Grilla de partidos"
        onClose={() => setGridOpen(false)}
        className="max-w-[95vw]"
        closeOnEscape={!gridMatch}
      >
        <div className="space-y-4">
          {gridData.dates.length === 0 ? (
            <div className="text-sm text-zinc-600">
              No hay partidos programados para mostrar.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>
                  {gridData.dates.length} dias · {gridData.times.length} turnos
                </span>
                <span>Click en un partido para ver el detalle.</span>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-2xl border border-zinc-200 bg-white">
                <div
                  className="grid gap-2 p-3"
                  style={{
                    gridTemplateColumns: `110px repeat(${gridData.dates.length}, minmax(240px, 1fr))`,
                  }}
                >
                  <div className="sticky top-0 z-10 rounded-lg bg-white/95 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                    Hora
                  </div>
                  {gridData.dates.map((date) => (
                    <div
                      key={`head-${date}`}
                      className="sticky top-0 z-10 rounded-lg bg-white/95 py-2 text-xs font-semibold text-zinc-700"
                    >
                      {formatShortDate(date)}
                    </div>
                  ))}

                  {gridData.times.map((slotTime, rowIdx) => {
                    const rowClass = rowIdx % 2 === 0 ? "bg-white" : "bg-zinc-100";
                    return (
                    <Fragment key={`row-${slotTime}`}>
                      <div
                        className={`rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 ${rowClass}`}
                      >
                        {slotTime}
                      </div>
                      {gridData.dates.map((date) => {
                        const matchesInCell =
                          gridData.map.get(date)?.get(slotTime) ?? [];
                        return (
                          <div
                            key={`cell-${date}-${slotTime}`}
                            className={`min-h-[92px] rounded-2xl border border-zinc-200 p-2 ${rowClass}`}
                          >
                            {matchesInCell.length === 0 ? (
                              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-400">
                                Sin partidos
                              </div>
                            ) : (
                              <div className="grid gap-2 md:grid-cols-2">
                                {matchesInCell.map((match) => (
                                  <button
                                    key={match.id}
                                    type="button"
                                    onClick={() => setGridMatch(match)}
                                    className="group rounded-xl border border-zinc-200 bg-white p-2 text-left text-xs text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                                      <span
                                        className={`rounded-full px-2 py-0.5 font-semibold ${getCourtBadgeClass(
                                          match.court_number
                                        )}`}
                                      >
                                        Cancha {match.court_number ?? "—"}
                                      </span>
                                      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                                        {getStageLabel(match)} · {getMatchCode(match)}
                                      </span>
                                    </div>
                                    <div className="mt-2 text-sm font-medium text-zinc-900">
                                      {getTeamLabel(match.team_a_id)} vs {getTeamLabel(match.team_b_id)}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!gridMatch}
        title="Detalle del partido"
        onClose={() => setGridMatch(null)}
      >
        <div className="space-y-3">
          {gridMatch && (
            <>
              <div className="text-sm text-zinc-500">
                {getStageLabel(gridMatch)} · Partido {getMatchCode(gridMatch)}
              </div>
              <div className="text-base font-semibold text-zinc-900">
                {getTeamLabel(gridMatch.team_a_id)} vs {getTeamLabel(gridMatch.team_b_id)}
              </div>
              <div className="text-sm text-zinc-600">
                {gridMatch.scheduled_date ? `Fecha: ${gridMatch.scheduled_date} · ` : ""}
                Hora: {normalizeTime(gridMatch.scheduled_time)} · Cancha: {gridMatch.court_number ?? "—"}
              </div>
              <div className="text-sm text-zinc-600">
                Estado: {gridMatch.status === "played" ? "Jugado" : "Programado"}
              </div>
            </>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setGridMatch(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
