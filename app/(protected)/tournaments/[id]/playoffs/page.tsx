"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

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
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");

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

  const [scheduleMatch, setScheduleMatch] = useState<Match | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleHour, setScheduleHour] = useState("");
  const [scheduleMinute, setScheduleMinute] = useState("");
  const [scheduleCourt, setScheduleCourt] = useState("1");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);

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
  const filteredGroups = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return groups;
    return groups.filter((group) =>
      group.teams.some((team) => {
        const category = team.players?.[0]?.category ?? null;
        const gender = team.players?.[0]?.gender ?? null;
        return category === categoryFilter && gender === genderFilter;
      })
    );
  }, [groups, categoryFilter, genderFilter]);

  const sortedTeams = useMemo(() => {
    const labelFor = (team: Team) => {
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${team.id}`;
    };
    const filtered =
      categoryFilter === "all" && genderFilter === "all"
        ? teams
        : teams.filter((team) => {
            const category = team.players?.[0]?.category ?? null;
            const gender = team.players?.[0]?.gender ?? null;
            const categoryMatch = categoryFilter === "all" || category === categoryFilter;
            const genderMatch = genderFilter === "all" || gender === genderFilter;
            return categoryMatch && genderMatch;
          });
    return [...filtered].sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
  }, [teams, categoryFilter, genderFilter]);

  const matchesByStage = useMemo(() => {
    const map = new Map<PlayoffStage, Match[]>();
    PLAYOFF_STAGES.forEach((stage) => map.set(stage, []));
    matches.forEach((match) => {
      if (match.stage === "group") return;
      if (categoryFilter !== "all") {
        const category = teamsById.get(match.team_a_id)?.players?.[0]?.category ?? null;
        if (category !== categoryFilter) return;
      }
      if (genderFilter !== "all") {
        const gender = teamsById.get(match.team_a_id)?.players?.[0]?.gender ?? null;
        if (gender !== genderFilter) return;
      }
      map.get(match.stage)?.push(match);
    });
    return map;
  }, [matches, categoryFilter, genderFilter, teamsById]);

  const hasPlayoffs = useMemo(() => {
    return Array.from(matchesByStage.values()).some((items) => items.length > 0);
  }, [matchesByStage]);

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
    if (categoryFilter === "all" || genderFilter === "all") return false;
    if (filteredGroups.length === 0) return false;

    for (const group of filteredGroups) {
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
  }, [filteredGroups, matches, categoryFilter, genderFilter]);

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
      (stage) =>
        PLAYOFF_STAGES.indexOf(stage) >= PLAYOFF_STAGES.indexOf(initialStage)
    );
  }, [initialStage]);

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
    const expectedMatches = STAGE_TEAM_COUNTS[latestStage] / 2;
    if (stageMatches.length < expectedMatches) return false;
    return stageMatches.every(
      (match) => match.status === "played" && match.winner_team_id
    );
  }, [latestStage, nextStage, matchesByStage]);

  const availableStages = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];
    if (matchesByStage.size === 0) return [];
    if (latestStage) {
      if (!nextStage || !canGenerateNextStage) return [];
      return [nextStage];
    }

    if (!groupStageComplete) return [];

    if (filteredGroups.length === 0) return [];

    const baseQualified = filteredGroups.reduce(
      (sum, group) => sum + Math.min(2, group.teams.length),
      0
    );
    const thirdsAvailable = filteredGroups.reduce(
      (sum, group) => sum + (group.teams.length >= 3 ? 1 : 0),
      0
    );
    const maxQualified = baseQualified + thirdsAvailable;

    return PLAYOFF_STAGES.filter(
      (stage) => STAGE_TEAM_COUNTS[stage] <= maxQualified
    );
  }, [
    matchesByStage,
    latestStage,
    nextStage,
    canGenerateNextStage,
    groupStageComplete,
    filteredGroups,
    categoryFilter,
    genderFilter,
  ]);

  const manualStageOptions = useMemo(() => {
    if (latestStage) return [];
    if (categoryFilter === "all" || genderFilter === "all") return [];
    if (!groupStageComplete) return [];
    return PLAYOFF_STAGES.filter(
      (stage) => sortedTeams.length >= STAGE_TEAM_COUNTS[stage]
    );
  }, [latestStage, groupStageComplete, sortedTeams.length, categoryFilter, genderFilter]);

  const manualSelectedIds = useMemo(() => {
    return manualPairs.flatMap((pair) => [pair.team_a_id, pair.team_b_id]);
  }, [manualPairs]);

  const autoGeneratedRef = useRef<Set<string>>(new Set());
  const autoAdvanceRef = useRef<Set<string>>(new Set());

  const loadPlayoffs = useCallback(async () => {
    if (!Number.isFinite(tournamentId)) return;
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
  }, [router, tournamentId]);

  const reloadMatches = useCallback(async () => {
    if (!Number.isFinite(tournamentId)) return;
    try {
      const [matchesRes, statusRes] = await Promise.all([
        api<Match[]>(`/tournaments/${tournamentId}/matches`),
        api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      ]);
      setMatches(matchesRes);
      setStatus(statusRes.status);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.message ?? "No se pudieron actualizar los partidos");
    }
  }, [router, tournamentId]);

  useEffect(() => {
    loadPlayoffs();
  }, [loadPlayoffs]);

  useEffect(() => {
    if (loading || generating) return;
    if (categoryFilter === "all" || genderFilter === "all") return;
    if (!groupStageComplete || hasPlayoffs) return;
    if (availableStages.length === 0) return;

    const key = `${tournamentId}:${categoryFilter}:${genderFilter}`;
    if (autoGeneratedRef.current.has(key)) return;
    autoGeneratedRef.current.add(key);
    handleGenerate(availableStages[0]);
  }, [
    availableStages,
    generating,
    groupStageComplete,
    hasPlayoffs,
    loading,
    categoryFilter,
    genderFilter,
    tournamentId,
  ]);

  useEffect(() => {
    if (loading || generating) return;
    if (categoryFilter === "all" || genderFilter === "all") return;
    if (!latestStage || !nextStage) return;
    if (!canGenerateNextStage) return;

    const key = `${tournamentId}:${categoryFilter}:${genderFilter}:${nextStage}`;
    if (autoAdvanceRef.current.has(key)) return;
    autoAdvanceRef.current.add(key);
    handleGenerate(nextStage);
  }, [
    canGenerateNextStage,
    generating,
    latestStage,
    loading,
    nextStage,
    tournamentId,
    categoryFilter,
    genderFilter,
  ]);

  function getTeamLabel(teamId: number) {
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;

    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }
  function getMatchCode(match: Match) {
    return match.match_code ?? String(match.id);
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

  function normalizeTime(value?: string | null) {
    if (!value) return "";
    return value.slice(0, 5);
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
      await api(`/matches/${scheduleMatch.id}/schedule`, {
        method: "POST",
        body: {
          scheduled_date: scheduleDate,
          scheduled_time: scheduleTime,
          court_number: courtNumber,
        },
      });
      await reloadMatches();
      closeScheduleModal();
    } catch (err: any) {
      setScheduleError(err?.message ?? "No se pudo programar el partido");
    } finally {
      setScheduling(false);
    }
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
      await reloadMatches();
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
    if (categoryFilter === "all" || genderFilter === "all") {
      return "Selecciona categoria y genero antes de generar playoffs.";
    }

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
        category: categoryFilter === "all" ? undefined : categoryFilter,
        gender: genderFilter === "all" ? undefined : genderFilter,
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
      if (categoryFilter === "all" || genderFilter === "all") {
        setActionError("Selecciona categoria y genero antes de generar playoffs.");
        setConfirmStage(null);
        return;
      }
      const payload: PlayoffGenerateRequest = {
        stage,
        category: categoryFilter,
        gender: genderFilter,
      };
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Etapas finales
          </div>
          <h1 className="text-3xl font-semibold">Playoffs</h1>
          <p className="text-sm text-zinc-300">Generacion y cruces por instancia.</p>
        </div>

          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <select
                className="rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value === "all" ? "all" : e.target.value
                )
              }
            >
              <option value="all">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
                ))}
              </select>
            )}
            {genders.length > 0 && (
              <select
                className="rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                value={genderFilter}
                onChange={(e) =>
                  setGenderFilter(e.target.value === "all" ? "all" : e.target.value)
                }
              >
                <option value="all">Todos</option>
                {genders.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender === "damas" ? "Damas" : "Masculino"}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="secondary"
              onClick={() => router.push(`/tournaments/${tournamentId}`)}
            >
            Volver
          </Button>
        </div>
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

          {!hasPlayoffs && (
            <>
              <Card className="bg-white/95">
                <div className="p-6 space-y-4">
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

              <Card className="bg-white/95">
                <div className="p-6 space-y-4">
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
            </>
          )}

          {finalWinner && (
            <Card className="bg-white/95">
              <div className="p-6 space-y-3">
                <div className="text-sm font-semibold text-zinc-800">Campeones</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">
                   🏆 Pareja ganadora
                  </div>
                  <div className="text-lg font-semibold">{finalWinner.name}</div>
                </div>
              </div>
            </Card>
          )}

          {PLAYOFF_STAGES.some((stage) => (matchesByStage.get(stage) ?? []).length > 0) && (
            <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                <div className="text-sm font-semibold text-zinc-800">
                  Cuadro de playoffs
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
                      const baseMatches =
                        initialStage ? STAGE_TEAM_COUNTS[initialStage] / 2 : 0;
                      const rowHeight = 20;
                      const cardSpan = 6;
                      const gapSpan = 2;
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
                            {STAGE_LABELS[stage]}
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

                              if (!("match" in item)) {
                                const seedA =
                                  "seedA" in item ? item.seedA : "Por definir";
                                const seedB =
                                  "seedB" in item ? item.seedB : "Por definir";
                                return (
                                  <div
                                    key={`${stage}-placeholder-${idx}`}
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
                              const canSchedule = !match.scheduled_time && !played;
                              return (
                                <div
                                  key={match.id}
                                  className={`rounded-2xl border p-3 text-sm shadow-sm ${
                                    played
                                      ? "border-emerald-300 bg-emerald-100/70"
                                      : "border-zinc-200 bg-white"
                                  }`}
                                  style={gridStyle}
                                >
                                  <div className="text-xs text-zinc-500">
                                    Partido {getMatchCode(match)}
                                  </div>
                                  <div
                                    className={`mt-1 font-medium text-zinc-900 ${
                                      match.winner_team_id === match.team_a_id
                                        ? "font-semibold"
                                        : ""
                                    }`}
                                  >
                                    {getTeamLabel(match.team_a_id)}
                                  </div>
                                  <div className="text-xs text-zinc-400">vs</div>
                                  <div
                                    className={`font-medium text-zinc-900 ${
                                      match.winner_team_id === match.team_b_id
                                        ? "font-semibold"
                                        : ""
                                    }`}
                                  >
                                    {getTeamLabel(match.team_b_id)}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                                    {match.status !== "played" && <span>Pendiente</span>}
                                    {canSchedule ? (
                                      <Button
                                        onClick={() => openScheduleModal(match)}
                                        disabled={scheduling}
                                        variant="secondary"
                                        className="ml-auto"
                                      >
                                        Programar partido
                                      </Button>
                                    ) : (
                                      <Button
                                        onClick={() => openResultModal(match)}
                                        disabled={!canEdit}
                                        variant={played ? "secondary" : "primary"}
                                        className="ml-auto"
                                      >
                                        {match.status === "played"
                                          ? "Editar resultado"
                                          : "Cargar resultado"}
                                      </Button>
                                    )}
                                  </div>
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
        title={
          selectedMatch
            ? `Resultado - Partido ${getMatchCode(selectedMatch)}`
            : "Resultado"
        }
        onClose={closeResultModal}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canEdit || saving) return;
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
            <Button variant="secondary" onClick={closeResultModal} type="button">
              Cancelar
            </Button>
            <Button type="submit" disabled={!canEdit || saving}>
              {saving ? "Guardando..." : "Guardar resultado"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
