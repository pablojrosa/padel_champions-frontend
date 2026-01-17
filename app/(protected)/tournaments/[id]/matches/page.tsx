"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleCourt, setScheduleCourt] = useState("1");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

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

  function openScheduleModal(match: Match) {
    setScheduleMatch(match);
    setScheduleDate(match.scheduled_date ?? "");
    setScheduleTime(normalizeTime(match.scheduled_time));
    setScheduleCourt(match.court_number ? String(match.court_number) : "1");
    setScheduleError(null);
  }

  function closeScheduleModal() {
    setScheduleMatch(null);
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

    if (!scheduleDate || !scheduleTime) {
      setScheduleError("Selecciona fecha y horario.");
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
  const unscheduledMatches = useMemo(
    () => matches.filter((match) => match.status !== "played" && !match.scheduled_time),
    [matches]
  );
  const scheduledMatches = useMemo(
    () => matches.filter((match) => match.status !== "played" && !!match.scheduled_time),
    [matches]
  );
  const playedMatches = useMemo(
    () => matches.filter((match) => match.status === "played"),
    [matches]
  );
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Partidos</h1>
          <p className="text-sm text-zinc-300">Resultados y estado por fase.</p>
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
                        <div className="text-xs text-zinc-500">{getStageLabel(match)}</div>
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

                      <div className="flex items-center gap-2">
                        {match.status === "played" ? (
                          <Button onClick={() => openResultModal(match)} disabled={!canResult}>
                            Editar resultado
                          </Button>
                        ) : match.scheduled_time ? (
                          <Button onClick={() => openResultModal(match)} disabled={!canResult}>
                            Cargar resultado
                          </Button>
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
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            {scheduleMatch
              ? `${getTeamLabel(scheduleMatch.team_a_id)} vs ${getTeamLabel(scheduleMatch.team_b_id)}`
              : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <Input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
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
            <Button variant="secondary" onClick={closeScheduleModal}>
              Cancelar
            </Button>
            <Button onClick={saveSchedule} disabled={scheduling}>
              {scheduling ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!selectedMatch}
        title={selectedMatch ? `Resultado - Match #${selectedMatch.id}` : "Resultado"}
        onClose={closeResultModal}
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            {selectedMatch
              ? `${getTeamLabel(selectedMatch.team_a_id)} vs ${getTeamLabel(selectedMatch.team_b_id)}`
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
            <Button variant="secondary" onClick={closeResultModal}>
              Cancelar
            </Button>
            <Button onClick={saveResult} disabled={!canResult || saving}>
              {saving ? "Guardando..." : "Guardar resultado"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
