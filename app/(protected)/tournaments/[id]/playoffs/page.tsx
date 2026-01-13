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
  PlayoffGenerateRequest,
  PlayoffStage,
  Team,
  TournamentGroupOut,
  TournamentStatus,
  TournamentStatusResponse,
} from "@/lib/types";

type IdParam = { id: string };

type EditableSet = { a: string; b: string };
type ManualPairDraft = { team_a_id: number | ""; team_b_id: number | "" };

const DEFAULT_SETS: EditableSet[] = [
  { a: "", b: "" },
  { a: "", b: "" },
  { a: "", b: "" },
];

const PLAYOFF_STAGES: PlayoffStage[] = [
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "final",
];

const STAGE_TEAM_COUNTS: Record<PlayoffStage, number> = {
  round_of_32: 32,
  round_of_16: 16,
  quarter: 8,
  semi: 4,
  final: 2,
};

const STAGE_LABELS: Record<PlayoffStage, string> = {
  round_of_32: "16vos de final",
  round_of_16: "8vos de final",
  quarter: "Cuartos de final",
  semi: "Semifinal",
  final: "Final",
};

export default function TournamentPlayoffsPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [status, setStatus] = useState<TournamentStatus>("upcoming");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmStage, setConfirmStage] = useState<PlayoffStage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [setsInput, setSetsInput] = useState<EditableSet[]>(DEFAULT_SETS);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [manualStage, setManualStage] = useState<PlayoffStage | null>(null);
  const [manualPairs, setManualPairs] = useState<ManualPairDraft[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualStageOpen, setManualStageOpen] = useState(false);
  const [manualStageCandidate, setManualStageCandidate] = useState<PlayoffStage | "">("");

  const teamsById = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((team) => map.set(team.id, team));
    return map;
  }, [teams]);

  const sortedTeams = useMemo(() => {
    const labelFor = (team: Team) => {
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${team.id}`;
    };
    return [...teams].sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [teams]);

  const matchesByStage = useMemo(() => {
    const map = new Map<PlayoffStage, Match[]>();
    PLAYOFF_STAGES.forEach((stage) => map.set(stage, []));
    matches.forEach((match) => {
      if (match.stage === "group") return;
      map.get(match.stage)?.push(match);
    });
    return map;
  }, [matches]);

  const finalWinner = useMemo(() => {
    const finals = matchesByStage.get("final") ?? [];
    const finalMatch = finals.find(
      (match) => match.status === "played" && match.winner_team_id
    );
    if (!finalMatch || !finalMatch.winner_team_id) return null;
    const team = teamsById.get(finalMatch.winner_team_id);
    const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
    const name = names.length > 0 ? names.join(" / ") : `Team #${finalMatch.winner_team_id}`;
    return {
      match: finalMatch,
      name,
    };
  }, [matchesByStage, teamsById]);

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

  const latestStage = useMemo(() => {
    let latest: PlayoffStage | null = null;
    PLAYOFF_STAGES.forEach((stage) => {
      const stageMatches = matchesByStage.get(stage) ?? [];
      if (stageMatches.length > 0) {
        latest = stage;
      }
    });
    return latest;
  }, [matchesByStage]);

  const nextStage = useMemo(() => {
    if (!latestStage) return null;
    const idx = PLAYOFF_STAGES.indexOf(latestStage);
    if (idx === -1 || idx === PLAYOFF_STAGES.length - 1) return null;
    return PLAYOFF_STAGES[idx + 1];
  }, [latestStage]);

  const canGenerateNextStage = useMemo(() => {
    if (!latestStage || !nextStage) return false;
    const stageMatches = matchesByStage.get(latestStage) ?? [];
    if (stageMatches.length === 0) return false;
    return stageMatches.every(
      (match) => match.status === "played" && match.winner_team_id
    );
  }, [latestStage, nextStage, matchesByStage]);

  const availableStages = useMemo(() => {
    if (matchesByStage.size === 0) return [];
    if (latestStage) {
      if (!nextStage || !canGenerateNextStage) return [];
      return [nextStage];
    }

    if (!groupStageComplete) return [];

    const groupCount = groups.length;
    if (groupCount === 0) return [];

    return PLAYOFF_STAGES.filter((stage) => {
      const required = STAGE_TEAM_COUNTS[stage];
      if (required % groupCount !== 0) return false;
      const perGroup = required / groupCount;
      if (groupCount > 1 && perGroup < 2) return false;
      return groups.every((group) => group.teams.length >= perGroup);
    });
  }, [
    matchesByStage,
    latestStage,
    nextStage,
    canGenerateNextStage,
    groupStageComplete,
    groups,
  ]);

  const manualStageOptions = useMemo(() => {
    if (latestStage) return [];
    if (!groupStageComplete) return [];
    return PLAYOFF_STAGES.filter(
      (stage) => teams.length >= STAGE_TEAM_COUNTS[stage]
    );
  }, [latestStage, groupStageComplete, teams.length]);

  const manualSelectedIds = useMemo(() => {
    return manualPairs.flatMap((pair) => [pair.team_a_id, pair.team_b_id]);
  }, [manualPairs]);

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
        setStatus(statusRes.status);
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudieron cargar los playoffs");
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

  function updateSet(idx: number, key: "a" | "b", value: string) {
    setSetsInput((prev) =>
      prev.map((setScore, i) =>
        i === idx ? { ...setScore, [key]: value } : setScore
      )
    );
  }

  function buildPayloadSets(): MatchSet[] | null {
    const filtered = setsInput.filter(
      (setScore) => setScore.a !== "" || setScore.b !== ""
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
      const statusRes = await api<TournamentStatusResponse>(
        `/tournaments/${tournamentId}/status`
      );
      setStatus(statusRes.status);
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

  function startManualStage(stage: PlayoffStage) {
    const matchesCount = STAGE_TEAM_COUNTS[stage] / 2;
    setManualStage(stage);
    setManualPairs(
      Array.from({ length: matchesCount }, () => ({
        team_a_id: "",
        team_b_id: "",
      }))
    );
    setManualError(null);
    setManualStageOpen(false);
    setManualStageCandidate("");
  }

  function updateManualPair(idx: number, key: "team_a_id" | "team_b_id", value: string) {
    const parsed = value === "" ? "" : Number(value);
    setManualPairs((prev) =>
      prev.map((pair, i) => (i === idx ? { ...pair, [key]: parsed } : pair))
    );
  }

  function validateManualPairs(): string | null {
    if (!manualStage) return "Selecciona una instancia para armar.";

    for (let i = 0; i < manualPairs.length; i += 1) {
      const pair = manualPairs[i];
      if (pair.team_a_id === "" || pair.team_b_id === "") {
        return "Completa todas las parejas.";
      }
      if (pair.team_a_id === pair.team_b_id) {
        return `Partido ${i + 1} tiene el mismo equipo en ambos lados.`;
      }
    }

    const ids = manualPairs.flatMap((pair) => [
      pair.team_a_id,
      pair.team_b_id,
    ]);
    const normalized = ids.filter((id): id is number => typeof id === "number");

    if (new Set(normalized).size !== normalized.length) {
      return "No podes repetir parejas en la misma instancia.";
    }

    return null;
  }

  async function submitManualPairs() {
    if (!manualStage) return;

    const validation = validateManualPairs();
    if (validation) {
      setManualError(validation);
      return;
    }

    setGenerating(true);
    setManualError(null);

    try {
      const payload: PlayoffGenerateRequest = {
        stage: manualStage,
        manual_pairs: manualPairs.map((pair) => ({
          team_a_id: pair.team_a_id as number,
          team_b_id: pair.team_b_id as number,
        })),
      };
      const created = await api<Match[]>(`/tournaments/${tournamentId}/generate-playoffs`, {
        method: "POST",
        body: payload,
      });
      setMatches((prev) => [...prev, ...created]);
      setManualStage(null);
      setManualPairs([]);
    } catch (err: any) {
      setManualError(err?.message ?? "No se pudieron generar los cruces");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate(stage: PlayoffStage) {
    setGenerating(true);
    setActionError(null);

    try {
      const payload: PlayoffGenerateRequest = { stage };
      const created = await api<Match[]>(`/tournaments/${tournamentId}/generate-playoffs`, {
        method: "POST",
        body: payload,
      });
      setMatches((prev) => [...prev, ...created]);
      setConfirmStage(null);
    } catch (err: any) {
      setActionError(err?.message ?? "No se pudieron generar los cruces");
    } finally {
      setGenerating(false);
    }
  }

  const canEdit = status === "ongoing" || status === "groups_finished";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Playoffs</h1>
          <p className="text-sm text-zinc-300">Generacion y cruces por instancia.</p>
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
            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-2">
                <div className="text-sm font-semibold text-zinc-800">Instancias disponibles</div>
                {availableStages.length === 0 ? (
                  <div className="text-sm text-zinc-600">
                    {groupStageComplete
                      ? "No hay instancias disponibles para generar ahora."
                      : "Tenes que completar los resultados de la fase de grupos."}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableStages.map((stage) => (
                      <Button
                        key={stage}
                        onClick={() => setConfirmStage(stage)}
                        disabled={generating}
                      >
                        Generar {STAGE_LABELS[stage]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {actionError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {actionError}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="p-5 space-y-4">
              <div className="text-sm font-semibold text-zinc-800">Armado manual (primera ronda)</div>

              {latestStage ? (
                <div className="text-sm text-zinc-600">
                  Ya hay playoffs generados. El armado manual solo aplica a la primera ronda.
                </div>
              ) : !groupStageComplete ? (
                <div className="text-sm text-zinc-600">
                  Tenes que completar los resultados de la fase de grupos.
                </div>
              ) : manualStageOptions.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  No hay suficientes equipos para iniciar una instancia.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setManualStageCandidate(manualStageOptions[0] ?? "");
                      setManualStageOpen(true);
                    }}
                    disabled={generating}
                  >
                    Elegir instancia para armar
                  </Button>
                </div>
              )}

              {manualStage && (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-zinc-700">
                    {STAGE_LABELS[manualStage]}
                  </div>
                  <div className="space-y-2">
                    {manualPairs.map((pair, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-3 text-sm md:flex-row md:items-center"
                      >
                        <div className="w-24 text-xs font-semibold text-zinc-500">
                          Partido {idx + 1}
                        </div>
                        <select
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:w-64"
                          value={pair.team_a_id}
                          onChange={(e) => updateManualPair(idx, "team_a_id", e.target.value)}
                        >
                          <option value="">Seleccionar pareja</option>
                          {sortedTeams.map((team) => {
                            const disabled =
                              manualSelectedIds.includes(team.id) &&
                              team.id !== pair.team_a_id;
                            return (
                              <option key={team.id} value={team.id} disabled={disabled}>
                                {getTeamLabel(team.id)}
                              </option>
                            );
                          })}
                        </select>
                        <span className="text-xs text-zinc-500">vs</span>
                        <select
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm md:w-64"
                          value={pair.team_b_id}
                          onChange={(e) => updateManualPair(idx, "team_b_id", e.target.value)}
                        >
                          <option value="">Seleccionar pareja</option>
                          {sortedTeams.map((team) => {
                            const disabled =
                              manualSelectedIds.includes(team.id) &&
                              team.id !== pair.team_b_id;
                            return (
                              <option key={team.id} value={team.id} disabled={disabled}>
                                {getTeamLabel(team.id)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ))}
                  </div>

                  {manualError && (
                    <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                      {manualError}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setManualStage(null);
                        setManualPairs([]);
                        setManualError(null);
                      }}
                    >
                      Cancelar armado
                    </Button>
                    <Button onClick={submitManualPairs} disabled={generating}>
                      {generating ? "Generando..." : "Generar llaves manuales"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {finalWinner && (
            <Card>
              <div className="p-5 space-y-3">
                <div className="text-sm font-semibold text-zinc-800">Campeones</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">
                    Pareja ganadora
                  </div>
                  <div className="text-lg font-semibold">{finalWinner.name}</div>
                </div>
              </div>
            </Card>
          )}

          {PLAYOFF_STAGES.map((stage) => {
            const stageMatches = matchesByStage.get(stage) ?? [];
            if (stageMatches.length === 0) return null;

            return (
              <Card key={stage}>
                <div className="p-5 space-y-3">
                  <div className="text-sm font-semibold text-zinc-800">
                    {STAGE_LABELS[stage].toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    {stageMatches.map((match) => (
                      <div
                        key={match.id}
                        className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-3 text-sm"
                      >
                        <div className="font-medium">
                          {getTeamLabel(match.team_a_id)} vs {getTeamLabel(match.team_b_id)}
                        </div>
                        <div className="flex flex-col gap-2 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
                          <span>
                            Estado: {match.status === "played" ? "Jugado" : "Pendiente"}
                          </span>
                          <Button onClick={() => openResultModal(match)} disabled={!canEdit}>
                            {match.status === "played" ? "Editar resultado" : "Cargar resultado"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}

      <Modal
        open={!!confirmStage}
        title={confirmStage ? `Generar ${STAGE_LABELS[confirmStage]}` : "Generar playoffs"}
        onClose={() => setConfirmStage(null)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Esta accion no se puede deshacer. ¿Confirmas generar los cruces?
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmStage(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => confirmStage && handleGenerate(confirmStage)}
              disabled={generating}
            >
              {generating ? "Generando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={manualStageOpen}
        title="Elegir instancia"
        onClose={() => setManualStageOpen(false)}
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            ¿Desde que instancia queres empezar los playoffs?
          </div>
          <select
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={manualStageCandidate}
            onChange={(e) => setManualStageCandidate(e.target.value as PlayoffStage)}
          >
            {manualStageOptions.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setManualStageOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (manualStageCandidate) startManualStage(manualStageCandidate);
              }}
              disabled={!manualStageCandidate}
            >
              Continuar
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
                  disabled={!canEdit}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="B"
                  value={setScore.b}
                  onChange={(e) => updateSet(idx, "b", e.target.value)}
                  disabled={!canEdit}
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

          {!canEdit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Los resultados solo se pueden editar mientras el torneo esta en curso.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeResultModal}>
              Cancelar
            </Button>
            <Button onClick={saveResult} disabled={!canEdit || saving}>
              {saving ? "Guardando..." : "Guardar resultado"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
