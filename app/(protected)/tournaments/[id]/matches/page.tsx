"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ScheduledMatchesGridModal from "@/components/tournaments/ScheduledMatchesGridModal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { genderLabel } from "@/lib/gender";
import { isMatchAllowedByConstraints } from "@/lib/scheduleConstraints";
import type {
  Match,
  MatchAvailableSlot,
  MatchAvailableSlotsResponse,
  MatchSet,
  Tournament,
  TournamentGroupOut,
  TournamentStatusResponse,
  Team,
} from "@/lib/types";

type IdParam = { id: string };
type CompetitionType = "tournament" | "league" | "flash";

type EditableSet = { a: string; b: string };
type ScheduleSuggestion = {
  date: string;
  hour: string;
  minute: string;
  court: string;
  reason: string;
};
type ScheduleSlotOption = {
  date: string;
  hour: string;
  minute: string;
  court: string;
};
type MatchConstraintConflict = {
  teamId: number;
  teamLabel: string;
  constraint: string;
};

const DEFAULT_SETS: EditableSet[] = [
  { a: "", b: "" },
  { a: "", b: "" },
  { a: "", b: "" },
];
const DEFAULT_SCHEDULE_HOUR = "18";
const DEFAULT_SCHEDULE_MINUTE = "00";
const DEFAULT_SCHEDULE_END_HOUR = "23";
const DEFAULT_MATCH_DURATION_MINUTES = 90;
const DEFAULT_COURTS_COUNT = 1;
const SLOT_STEP_MINUTES = 30;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function resolveTeamLabel(teamsById: Map<number, Team>, teamId?: number | null) {
  if (typeof teamId !== "number") return "Por definir";
  const team = teamsById.get(teamId);
  if (!team) return `Team #${teamId}`;

  const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
  if (names.length === 0) return `Team #${teamId}`;
  return names.join(" / ");
}

function resolveMatchCategory(match: Match, teamsById: Map<number, Team>) {
  const teamA = typeof match.team_a_id === "number" ? teamsById.get(match.team_a_id) : null;
  const teamB = typeof match.team_b_id === "number" ? teamsById.get(match.team_b_id) : null;
  return match.category ?? teamA?.players?.[0]?.category ?? teamB?.players?.[0]?.category ?? null;
}

function resolveMatchCategoryLabel(match: Match, teamsById: Map<number, Team>) {
  return resolveMatchCategory(match, teamsById)?.trim() || "Sin categoria";
}

function resolveMatchGender(match: Match, teamsById: Map<number, Team>) {
  const teamA = typeof match.team_a_id === "number" ? teamsById.get(match.team_a_id) : null;
  const teamB = typeof match.team_b_id === "number" ? teamsById.get(match.team_b_id) : null;
  return match.gender ?? teamA?.players?.[0]?.gender ?? teamB?.players?.[0]?.gender ?? null;
}

function isoDateFromParts(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function addDaysToIsoDate(isoDate: string, daysToAdd: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return isoDateFromParts(year, month, day + daysToAdd);
}

function buildIsoDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let current = startDate; current <= endDate; current = addDaysToIsoDate(current, 1)) {
    dates.push(current);
  }
  return dates;
}

function doIntervalsOverlap(
  startMinutesA: number,
  durationMinutes: number,
  startMinutesB: number,
  durationMinutesB: number
) {
  const endA = startMinutesA + durationMinutes;
  const endB = startMinutesB + durationMinutesB;
  return startMinutesA < endB && startMinutesB < endA;
}

function buildTimeSlots(startMinutes: number, endMinutes: number, stepMinutes: number) {
  const slots: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += stepMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    slots.push(`${hour}:${minute}`);
  }
  return slots;
}

export default function TournamentMatchesPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentStatus, setTournamentStatus] = useState<string>("upcoming");
  const [competitionType, setCompetitionType] = useState<CompetitionType>("tournament");

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
  const [scheduleSuggestion, setScheduleSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [availableScheduleSlots, setAvailableScheduleSlots] = useState<ScheduleSlotOption[]>([]);
  const [availableScheduleSlotsLoading, setAvailableScheduleSlotsLoading] = useState(false);
  const [availableScheduleSlotsError, setAvailableScheduleSlotsError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [autoSchedulingFlash, setAutoSchedulingFlash] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [gridMatch, setGridMatch] = useState<Match | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");
  const [nameQuery, setNameQuery] = useState("");
  const [onlyConstraintConflicts, setOnlyConstraintConflicts] = useState(false);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState("");
  const [bulkHour, setBulkHour] = useState(DEFAULT_SCHEDULE_HOUR);
  const [bulkMinute, setBulkMinute] = useState(DEFAULT_SCHEDULE_MINUTE);
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [bulkScheduleError, setBulkScheduleError] = useState<string | null>(null);

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
  const tournamentContextDates = useMemo(() => {
    const dates = new Set<string>();
    for (const match of matches) {
      if (match.scheduled_date) {
        dates.add(match.scheduled_date);
      }
    }
    if (dates.size === 0 && tournament?.start_date) {
      const rangeEnd = tournament.end_date ?? tournament.start_date;
      for (const dateValue of buildIsoDateRange(tournament.start_date, rangeEnd)) {
        dates.add(dateValue);
      }
    }
    return Array.from(dates).sort();
  }, [tournament?.start_date, tournament?.end_date, matches]);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [matchesRes, teamsRes, groupsRes, statusRes, tournamentsRes] = await Promise.all([
          api<Match[]>(`/tournaments/${tournamentId}/matches`),
          api<Team[]>(`/tournaments/${tournamentId}/teams`),
          api<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`),
          api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
          api<Tournament[]>("/tournaments"),
        ]);

        setMatches(matchesRes);
        setTeams(teamsRes);
        setGroups(groupsRes);
        setTournamentStatus(statusRes.status);
        const current = tournamentsRes.find((item) => item.id === tournamentId);
        setTournament(current ?? null);
        setCompetitionType((current?.competition_type ?? "tournament") as CompetitionType);
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

  function getTeamLabel(teamId?: number | null) {
    return resolveTeamLabel(teamsById, teamId);
  }
  function hasDefinedTeams(match: Match): match is Match & { team_a_id: number; team_b_id: number } {
    return typeof match.team_a_id === "number" && typeof match.team_b_id === "number";
  }
  function getMatchCode(match: Match) {
    return match.match_code ?? String(match.id);
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

  async function openResultModal(match: Match) {
    let modalMatch = match;
    if (
      competitionType === "flash"
      && match.status !== "played"
      && hasDefinedTeams(match)
    ) {
      try {
        const autoAssigned = await api<Match>(`/matches/${match.id}/auto-assign-court`, {
          method: "POST",
          body: {},
        });
        modalMatch = autoAssigned;
        const refreshedMatches = await api<Match[]>(`/tournaments/${tournamentId}/matches`);
        setMatches(refreshedMatches);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "No se pudo asignar una cancha libre";
        setError(message);
        return;
      }
    }

    setError(null);
    setSelectedMatch(modalMatch);
    setFormError(null);
    setSuccessMessage(null);

    if (modalMatch.sets && modalMatch.sets.length > 0) {
      const mapped = modalMatch.sets.map((setScore) => ({
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
  function toLocalIsoDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toMinutes(value: string) {
    const [hourRaw, minuteRaw] = value.split(":");
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return hour * 60 + minute;
  }

  function buildScheduleSuggestion(
    match: Match,
    options?: {
      preferScheduledDate?: boolean;
      reason?: string;
    }
  ): ScheduleSuggestion | null {
    const today = toLocalIsoDate(new Date());
    const durationMinutes = tournament?.match_duration_minutes ?? DEFAULT_MATCH_DURATION_MINUTES;
    const configuredCourts = tournament?.courts_count ?? DEFAULT_COURTS_COUNT;
    const scheduledMatches = matches
      .filter((item) => item.id !== match.id && !!item.scheduled_date && !!item.scheduled_time)
      .map((item) => {
        const time = normalizeTime(item.scheduled_time);
        const startMinutes = toMinutes(time);
        return {
          id: item.id,
          date: item.scheduled_date as string,
          time,
          startMinutes,
          court: item.court_number && item.court_number > 0 ? item.court_number : 1,
          teamIds: [item.team_a_id, item.team_b_id].filter(
            (teamId): teamId is number => typeof teamId === "number"
          ),
        };
      })
      .filter((item) => !!item.time && item.startMinutes !== null);

    const maxKnownCourt = Math.max(
      configuredCourts,
      DEFAULT_COURTS_COUNT,
      ...scheduledMatches.map((item) => item.court)
    );
    const startTime = normalizeTime(tournament?.start_time) || `${DEFAULT_SCHEDULE_HOUR}:${DEFAULT_SCHEDULE_MINUTE}`;
    const endTime = normalizeTime(tournament?.end_time) || `${DEFAULT_SCHEDULE_END_HOUR}:${DEFAULT_SCHEDULE_MINUTE}`;
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    if (startMinutes === null || endMinutes === null || startMinutes > endMinutes) {
      return null;
    }

    const configuredStartDate = tournament?.start_date ?? match.scheduled_date ?? today;
    const configuredEndDate =
      tournament?.end_date ?? match.scheduled_date ?? configuredStartDate;
    const rangeStart = configuredStartDate < today ? today : configuredStartDate;
    const rangeEnd = configuredEndDate < rangeStart ? rangeStart : configuredEndDate;
    const dates = buildIsoDateRange(rangeStart, rangeEnd);
    for (const scheduledDate of scheduledMatches.map((item) => item.date)) {
      if (scheduledDate >= today && !dates.includes(scheduledDate)) {
        dates.push(scheduledDate);
      }
    }

    const orderedDates = Array.from(new Set(dates)).sort();
    if (options?.preferScheduledDate && match.scheduled_date && orderedDates.includes(match.scheduled_date)) {
      orderedDates.splice(orderedDates.indexOf(match.scheduled_date), 1);
      orderedDates.unshift(match.scheduled_date);
    }

    const preferredCourts = Array.from({ length: maxKnownCourt }, (_, idx) => idx + 1);
    if (
      match.court_number &&
      match.court_number > 0 &&
      preferredCourts.includes(match.court_number)
    ) {
      preferredCourts.splice(preferredCourts.indexOf(match.court_number), 1);
      preferredCourts.unshift(match.court_number);
    }

    const teamIds = [match.team_a_id, match.team_b_id].filter(
      (teamId): teamId is number => typeof teamId === "number"
    );

    const findSuggestionInSlots = (
      candidateTimes: string[],
      reason: string
    ): ScheduleSuggestion | null => {
      for (const date of orderedDates) {
        for (const time of candidateTimes) {
          if (
            teamIds.some((teamId) => {
            const constraints = teamsById.get(teamId)?.schedule_constraints;
            return !isMatchAllowedByConstraints(
              constraints,
              date,
              time,
              tournamentContextDates
            );
          })
        ) {
          continue;
          }

          const slotStartMinutes = toMinutes(time);
          if (slotStartMinutes === null) continue;

          const hasTeamOverlap = scheduledMatches.some((scheduledMatch) => {
            if (scheduledMatch.date !== date || scheduledMatch.startMinutes === null) return false;
            if (
              !doIntervalsOverlap(
                slotStartMinutes,
                durationMinutes,
                scheduledMatch.startMinutes,
                durationMinutes
              )
            ) {
              return false;
            }
            return teamIds.some((teamId) => scheduledMatch.teamIds.includes(teamId));
          });
          if (hasTeamOverlap) continue;

          for (const court of preferredCourts) {
            const hasCourtOverlap = scheduledMatches.some((scheduledMatch) => {
              if (
                scheduledMatch.date !== date ||
                scheduledMatch.court !== court ||
                scheduledMatch.startMinutes === null
              ) {
                return false;
              }
              return doIntervalsOverlap(
                slotStartMinutes,
                durationMinutes,
                scheduledMatch.startMinutes,
                durationMinutes
              );
            });
            if (hasCourtOverlap) continue;

            const [hour = DEFAULT_SCHEDULE_HOUR, minute = DEFAULT_SCHEDULE_MINUTE] = time.split(":");
            return {
              date,
              hour,
              minute,
              court: String(court),
              reason,
            };
          }
        }
      }

      return null;
    };

    const configuredSlots = buildTimeSlots(startMinutes, endMinutes, SLOT_STEP_MINUTES);
    const configuredSuggestion = findSuggestionInSlots(
      configuredSlots,
      options?.reason ??
        "Primer horario libre que respeta restricciones de parejas y canchas disponibles."
    );
    if (configuredSuggestion) {
      return configuredSuggestion;
    }

    const relaxedStartMinutes = Math.min(
      startMinutes,
      ...scheduledMatches
        .map((scheduledMatch) => scheduledMatch.startMinutes)
        .filter((value): value is number => value !== null),
      8 * 60
    );
    const relaxedEndMinutes = Math.max(
      endMinutes,
      ...scheduledMatches
        .map((scheduledMatch) => scheduledMatch.startMinutes)
        .filter((value): value is number => value !== null),
      23 * 60
    );
    const relaxedSlots = buildTimeSlots(relaxedStartMinutes, relaxedEndMinutes, SLOT_STEP_MINUTES);

    return findSuggestionInSlots(
      relaxedSlots,
      "No encontre un hueco dentro de la ventana base del torneo. Te propongo el primer horario libre compatible con restricciones y sin cruces de parejas o cancha."
    );
  }

  async function loadAvailableScheduleSlots() {
    if (!scheduleMatch) return;

    setAvailableScheduleSlotsLoading(true);
    setAvailableScheduleSlotsError(null);
    try {
      const response = await api<MatchAvailableSlotsResponse>(
        `/matches/${scheduleMatch.id}/available-slots`
      );
      const nextSlots = (response.slots ?? []).map((slot: MatchAvailableSlot) => ({
        date: slot.scheduled_date,
        hour: normalizeTime(slot.scheduled_time).slice(0, 2) || DEFAULT_SCHEDULE_HOUR,
        minute: normalizeTime(slot.scheduled_time).slice(3, 5) || DEFAULT_SCHEDULE_MINUTE,
        court: String(slot.court_number),
      }));
      setAvailableScheduleSlots(nextSlots);
      if (nextSlots.length === 0) {
        setAvailableScheduleSlotsError(
          "No encontre espacios vacios compatibles para este partido con la configuracion actual."
        );
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setAvailableScheduleSlotsError(
        err instanceof Error ? err.message : "No se pudieron buscar espacios disponibles."
      );
    } finally {
      setAvailableScheduleSlotsLoading(false);
    }
  }

  function toggleMatchSelection(matchId: number) {
    if (blockedMatchIds.has(matchId)) return;
    setSelectedMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedMatchIds(new Set());
  }

  function openBulkScheduleModal() {
    setBulkDate(toLocalIsoDate(new Date()));
    setBulkHour(DEFAULT_SCHEDULE_HOUR);
    setBulkMinute(DEFAULT_SCHEDULE_MINUTE);
    setBulkScheduleError(null);
    setBulkScheduleOpen(true);
  }

  function closeBulkScheduleModal() {
    setBulkScheduleOpen(false);
    setBulkScheduleError(null);
  }

  async function saveBulkSchedule() {
    if (!bulkDate || !bulkHour || !bulkMinute) {
      setBulkScheduleError("Selecciona fecha y horario.");
      return;
    }
    if (bulkTeamConflicts.length > 0) {
      setBulkScheduleError("Hay partidos con conflicto de pareja. Deselectionalos o elegí otro horario.");
      return;
    }

    const time = `${bulkHour}:${bulkMinute}`;
    const occupiedCourts = new Set(
      matches
        .filter(
          (m) =>
            (m.scheduled_date ?? "") === bulkDate &&
            normalizeTime(m.scheduled_time) === time &&
            m.court_number && m.court_number > 0
        )
        .map((m) => m.court_number as number)
    );

    const matchIds = Array.from(selectedMatchIds);
    const courtAssignments = new Map<number, number>();
    let court = 1;
    for (const matchId of matchIds) {
      while (occupiedCourts.has(court)) court++;
      courtAssignments.set(matchId, court);
      occupiedCourts.add(court);
      court++;
    }

    setBulkScheduling(true);
    setBulkScheduleError(null);

    try {
      const updatedMatches: Match[] = [];
      for (const matchId of matchIds) {
        const courtNumber = courtAssignments.get(matchId)!;
        const res = await api<{ updated: Match; swapped: Match | null }>(
          `/matches/${matchId}/schedule`,
          {
            method: "POST",
            body: { scheduled_date: bulkDate, scheduled_time: time, court_number: courtNumber },
          }
        );
        updatedMatches.push(res.updated);
        if (res.swapped) updatedMatches.push(res.swapped);
      }
      setMatches((prev) =>
        prev.map((m) => {
          const updated = updatedMatches.find((u) => u.id === m.id);
          return updated ?? m;
        })
      );
      setScheduleMessage(
        `${matchIds.length} partido${matchIds.length !== 1 ? "s" : ""} programado${matchIds.length !== 1 ? "s" : ""} el ${bulkDate} a las ${time}.`
      );
      clearSelection();
      closeBulkScheduleModal();
    } catch (err: any) {
      setBulkScheduleError(err?.message ?? "No se pudieron programar los partidos.");
    } finally {
      setBulkScheduling(false);
    }
  }

  function openScheduleModal(match: Match) {
    const hasConstraintConflict =
      (constraintConflictsByMatchId.get(match.id)?.length ?? 0) > 0;
    const suggestion =
      hasConstraintConflict
        ? null
        : (!match.scheduled_date || !match.scheduled_time || !match.court_number)
        ? buildScheduleSuggestion(match, {
            preferScheduledDate: true,
            reason: "Primer horario libre sugerido automaticamente segun restricciones y canchas disponibles.",
          })
        : null;

    setScheduleMatch(match);
    setAvailableScheduleSlots([]);
    setAvailableScheduleSlotsError(null);
    setAvailableScheduleSlotsLoading(false);
    const normalized = normalizeTime(match.scheduled_time);
    if (match.scheduled_date && normalized && match.court_number) {
      const [hour = "", minute = ""] = normalized.split(":");
      setScheduleDate(match.scheduled_date);
      setScheduleHour(hour);
      setScheduleMinute(MINUTES.includes(minute) ? minute : "");
      setScheduleCourt(String(match.court_number));
      setScheduleSuggestion(suggestion);
    } else {
      setScheduleSuggestion(suggestion);
      if (suggestion) {
        setScheduleDate(suggestion.date);
        setScheduleHour(suggestion.hour);
        setScheduleMinute(suggestion.minute);
        setScheduleCourt(suggestion.court);
      } else {
        setScheduleDate(match.scheduled_date ?? "");
        setScheduleHour(DEFAULT_SCHEDULE_HOUR);
        setScheduleMinute(DEFAULT_SCHEDULE_MINUTE);
        setScheduleCourt(String(match.court_number ?? 1));
      }
    }
    setScheduleError(null);
  }

  function closeScheduleModal() {
    setScheduleMatch(null);
    setScheduleHour("");
    setScheduleMinute("");
    setScheduleSuggestion(null);
    setAvailableScheduleSlots([]);
    setAvailableScheduleSlotsError(null);
    setAvailableScheduleSlotsLoading(false);
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
    const isFlashCompetition = competitionType === "flash";
    const filtered = setsInput.filter((setScore) =>
      setScore.a !== "" || setScore.b !== ""
    );

    if (isFlashCompetition) {
      if (filtered.length !== 1) {
        setFormError("En relámpago tenés que cargar exactamente 1 set.");
        return null;
      }
    } else {
      if (filtered.length < 2) {
        setFormError("Tenes que cargar al menos 2 sets.");
        return null;
      }

      if (filtered.length > 3) {
        setFormError("Maximo 3 sets.");
        return null;
      }
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
    if (!hasDefinedTeams(selectedMatch)) {
      setFormError("Todavia no estan definidas las parejas para este partido.");
      return;
    }

    const payloadSets = buildPayloadSets();
    if (!payloadSets) return;

    setSaving(true);
    setFormError(null);

    try {
      const updated = await api<Match>(`/matches/${selectedMatch.id}/result`, {
        method: "POST",
        body: { sets: payloadSets },
      });
      const [matchesRes, statusRes] = await Promise.all([
        api<Match[]>(`/tournaments/${tournamentId}/matches`),
        api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      ]);

      setMatches(matchesRes);
      setTournamentStatus(statusRes.status);
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

    if (!MINUTES.includes(scheduleMinute)) {
      setScheduleError("Selecciona minutos validos (00-59).");
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
      if (res.swapped) {
        setScheduleMessage(
          `Horario actualizado. El partido ${getMatchCode(res.swapped)} se reubico para evitar conflicto.`
        );
      } else {
        setScheduleMessage(
          `Partido ${getMatchCode(res.updated)} programado para ${scheduleDate} ${scheduleTime} en cancha ${courtNumber}.`
        );
      }
      closeScheduleModal();
    } catch (err: any) {
      setScheduleError(err?.message ?? "No se pudo programar el partido");
    } finally {
      setScheduling(false);
    }
  }

  async function autoScheduleFlashMatches() {
    if (competitionType !== "flash") return;
    setAutoSchedulingFlash(true);
    setError(null);
    try {
      const res = await api<{ message: string }>(
        `/tournaments/${tournamentId}/flash/auto-schedule`,
        {
          method: "POST",
          body: {},
        }
      );
      const [matchesRes, groupsRes, statusRes] = await Promise.all([
        api<Match[]>(`/tournaments/${tournamentId}/matches`),
        api<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`),
        api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      ]);
      setMatches(matchesRes);
      setGroups(groupsRes);
      setTournamentStatus(statusRes.status);
      setActiveTab("scheduled");
      setScheduleMessage(res.message || "Partidos ordenados automaticamente.");
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.message ?? "No se pudo ordenar el relámpago.");
    } finally {
      setAutoSchedulingFlash(false);
    }
  }

  const canSchedule = tournamentStatus !== "finished";
  const canResult = tournamentStatus === "ongoing" || tournamentStatus === "groups_finished";
  const constraintConflictsByMatchId = useMemo(() => {
    const byMatchId = new Map<number, MatchConstraintConflict[]>();
    for (const match of matches) {
      if (!match.scheduled_date || !match.scheduled_time) continue;
      const conflicts: MatchConstraintConflict[] = [];
      const teamsInMatch: Array<number | null | undefined> = [match.team_a_id, match.team_b_id];
      for (const teamId of teamsInMatch) {
        if (typeof teamId !== "number") continue;
        const team = teamsById.get(teamId);
        const constraints = (team?.schedule_constraints ?? "").trim();
        if (!constraints) continue;
        const allowed = isMatchAllowedByConstraints(
          constraints,
          match.scheduled_date,
          normalizeTime(match.scheduled_time),
          tournamentContextDates
        );
        if (!allowed) {
          const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
          conflicts.push({
            teamId,
            teamLabel: names.length > 0 ? names.join(" / ") : `Team #${teamId}`,
            constraint: constraints,
          });
        }
      }
      if (conflicts.length > 0) {
        byMatchId.set(match.id, conflicts);
      }
    }
    return byMatchId;
  }, [matches, teamsById, tournamentContextDates]);
  const scheduleMatchConstraintConflicts = useMemo(
    () => (scheduleMatch ? constraintConflictsByMatchId.get(scheduleMatch.id) ?? [] : []),
    [scheduleMatch, constraintConflictsByMatchId]
  );
  const baseFilteredMatches = useMemo(() => {
    const normalizedQuery = nameQuery.trim().toLowerCase();
    const teamSearchLabel = (teamId?: number | null) => {
      if (typeof teamId !== "number") return "";
      const team = teamsById.get(teamId);
      const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
      if (names.length === 0) return "";
      return names.join(" ").toLowerCase();
    };
    return matches.filter((match) => {
      const category = resolveMatchCategory(match, teamsById);
      const gender = resolveMatchGender(match, teamsById);
      const categoryMatch = categoryFilter === "all" || category === categoryFilter;
      const genderMatch = genderFilter === "all" || gender === genderFilter;
      if (!categoryMatch || !genderMatch) return false;
      if (!normalizedQuery) return true;
      const aLabel = teamSearchLabel(match.team_a_id);
      const bLabel = teamSearchLabel(match.team_b_id);
      return aLabel.includes(normalizedQuery) || bLabel.includes(normalizedQuery);
    });
  }, [matches, categoryFilter, genderFilter, nameQuery, teamsById]);
  const conflictMatchesCount = useMemo(
    () =>
      baseFilteredMatches.filter(
        (match) =>
          match.status !== "played" &&
          !!match.scheduled_time &&
          constraintConflictsByMatchId.has(match.id)
      ).length,
    [baseFilteredMatches, constraintConflictsByMatchId]
  );
  const showConstraintToggle =
    activeTab === "scheduled" && (conflictMatchesCount > 0 || onlyConstraintConflicts);
  const categoryFilteredMatches = useMemo(
    () =>
      onlyConstraintConflicts && activeTab === "scheduled"
        ? baseFilteredMatches.filter((match) => constraintConflictsByMatchId.has(match.id))
        : baseFilteredMatches,
    [onlyConstraintConflicts, activeTab, baseFilteredMatches, constraintConflictsByMatchId]
  );
  const isFlash = competitionType === "flash";
  const unscheduledMatches = useMemo(
    () =>
      categoryFilteredMatches.filter((match) =>
        match.status !== "played" && (isFlash || !match.scheduled_time)
      ),
    [categoryFilteredMatches, isFlash]
  );
  const scheduledMatches = useMemo(
    () =>
      isFlash
        ? []
        : categoryFilteredMatches.filter(
            (match) => match.status !== "played" && !!match.scheduled_time
          ),
    [categoryFilteredMatches, isFlash]
  );
  const playedMatches = useMemo(
    () => categoryFilteredMatches.filter((match) => match.status === "played"),
    [categoryFilteredMatches]
  );
  const canAutoScheduleFlash =
    competitionType === "flash" &&
    tournamentStatus !== "finished" &&
    unscheduledMatches.length > 0;

  const blockedMatchIds = useMemo(() => {
    const blocked = new Set<number>();
    const selectedTeamIds = new Set<number>();
    for (const id of selectedMatchIds) {
      const m = matches.find((x) => x.id === id);
      if (m?.team_a_id) selectedTeamIds.add(m.team_a_id);
      if (m?.team_b_id) selectedTeamIds.add(m.team_b_id);
    }
    for (const m of unscheduledMatches) {
      if (selectedMatchIds.has(m.id)) continue;
      if (
        (typeof m.team_a_id === "number" && selectedTeamIds.has(m.team_a_id)) ||
        (typeof m.team_b_id === "number" && selectedTeamIds.has(m.team_b_id))
      ) {
        blocked.add(m.id);
      }
    }
    return blocked;
  }, [selectedMatchIds, matches, unscheduledMatches]);

  const bulkTimeValue = bulkHour && bulkMinute ? `${bulkHour}:${bulkMinute}` : "";

  const bulkTeamConflicts = useMemo(() => {
    if (!bulkDate || !bulkTimeValue || selectedMatchIds.size === 0) return [];
    const conflicts: { matchId: number; teamLabel: string; conflictMatchCode: string }[] = [];
    for (const matchId of selectedMatchIds) {
      const match = matches.find((m) => m.id === matchId);
      if (!match) continue;
      const teamIds = [match.team_a_id, match.team_b_id].filter(
        (id): id is number => typeof id === "number"
      );
      for (const teamId of teamIds) {
        const conflictMatch = matches.find(
          (m) =>
            !selectedMatchIds.has(m.id) &&
            (m.scheduled_date ?? "") === bulkDate &&
            normalizeTime(m.scheduled_time) === bulkTimeValue &&
            (m.team_a_id === teamId || m.team_b_id === teamId)
        );
        if (conflictMatch) {
          conflicts.push({
            matchId,
            teamLabel: resolveTeamLabel(teamsById, teamId),
            conflictMatchCode: getMatchCode(conflictMatch),
          });
        }
      }
    }
    return conflicts;
  }, [selectedMatchIds, matches, bulkDate, bulkTimeValue, teamsById]);
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
  const scheduleTimeValue =
    scheduleHour && scheduleMinute ? `${scheduleHour}:${scheduleMinute}` : "";
  const scheduleConflictMatch = useMemo(() => {
    if (!scheduleMatch || !scheduleDate || !scheduleTimeValue) return null;
    const courtNumber = Number(scheduleCourt);
    if (!Number.isFinite(courtNumber) || courtNumber <= 0) return null;
    return (
      matches.find(
        (match) =>
          match.id !== scheduleMatch.id &&
          (match.scheduled_date ?? "") === scheduleDate &&
          normalizeTime(match.scheduled_time) === scheduleTimeValue &&
          (match.court_number ?? -1) === courtNumber
      ) ?? null
    );
  }, [matches, scheduleMatch, scheduleDate, scheduleTimeValue, scheduleCourt]);
  const scheduleTeamConflict = useMemo((): { match: Match; teamId: number; teamLabel: string } | null => {
    if (!scheduleMatch || !scheduleDate || !scheduleTimeValue) return null;
    const teamIds = [scheduleMatch.team_a_id, scheduleMatch.team_b_id].filter(
      (id): id is number => typeof id === "number"
    );
    if (teamIds.length === 0) return null;
    for (const match of matches) {
      if (match.id === scheduleMatch.id) continue;
      if ((match.scheduled_date ?? "") !== scheduleDate) continue;
      if (normalizeTime(match.scheduled_time) !== scheduleTimeValue) continue;
      for (const teamId of teamIds) {
        if (match.team_a_id === teamId || match.team_b_id === teamId) {
          const team = teamsById.get(teamId);
          const names = team?.players?.map((p) => p.name).filter(Boolean) ?? [];
          const teamLabel = names.length > 0 ? names.join(" / ") : `Pareja #${teamId}`;
          return { match, teamId, teamLabel };
        }
      }
    }
    return null;
  }, [matches, scheduleMatch, scheduleDate, scheduleTimeValue, teamsById]);
  const scheduleConflictSuggestion = useMemo((): ScheduleSuggestion | null => {
    if (!scheduleMatch) return null;
    if (!scheduleConflictMatch && !scheduleTeamConflict) return null;
    const MATCH_DURATION_MINUTES = 90;
    const otherScheduled = matches
      .filter((m) => m.id !== scheduleMatch.id && !!m.scheduled_date && !!m.scheduled_time)
      .map((m) => ({
        date: m.scheduled_date as string,
        time: normalizeTime(m.scheduled_time),
        court: m.court_number && m.court_number > 0 ? m.court_number : 1,
      }))
      .filter((m) => !!m.time);
    const maxKnownCourt = Math.max(1, ...otherScheduled.map((m) => m.court));
    if (scheduleConflictMatch && scheduleDate && scheduleTimeValue) {
      const occupiedCourtsAtTime = new Set(
        otherScheduled
          .filter((m) => m.date === scheduleDate && m.time === scheduleTimeValue)
          .map((m) => m.court)
      );
      for (let c = 1; c <= maxKnownCourt + 1; c++) {
        if (!occupiedCourtsAtTime.has(c)) {
          return {
            date: scheduleDate,
            hour: scheduleHour,
            minute: scheduleMinute,
            court: String(c),
            reason: "Misma hora, cancha alternativa.",
          };
        }
      }
      const courtNumber = Number(scheduleCourt);
      if (Number.isFinite(courtNumber) && courtNumber > 0) {
        const currentMinutes = toMinutes(scheduleTimeValue);
        if (currentMinutes !== null) {
          const startMinutes = currentMinutes + MATCH_DURATION_MINUTES;
          for (let mins = startMinutes; mins <= 23 * 60; mins += 30) {
            const hh = String(Math.floor(mins / 60)).padStart(2, "0");
            const mm = String(mins % 60).padStart(2, "0");
            const timeStr = `${hh}:${mm}`;
            const isOccupied = otherScheduled.some(
              (m) => m.date === scheduleDate && m.time === timeStr && m.court === courtNumber
            );
            if (!isOccupied) {
              return {
                date: scheduleDate,
                hour: hh,
                minute: mm,
                court: scheduleCourt,
                reason: "Misma cancha, primer horario libre.",
              };
            }
          }
        }
      }
      return null;
    }
    if (scheduleTeamConflict) {
      const { match: conflictMatch, teamLabel } = scheduleTeamConflict;
      const conflictTime = normalizeTime(conflictMatch.scheduled_time);
      const conflictDate = conflictMatch.scheduled_date;
      if (!conflictTime || !conflictDate) return null;
      const conflictMinutes = toMinutes(conflictTime);
      if (conflictMinutes === null) return null;
      const earliestMinutes = conflictMinutes + MATCH_DURATION_MINUTES;
      for (let mins = earliestMinutes; mins <= 23 * 60; mins += 30) {
        const hh = String(Math.floor(mins / 60)).padStart(2, "0");
        const mm = String(mins % 60).padStart(2, "0");
        const timeStr = `${hh}:${mm}`;
        const occupiedCourts = new Set(
          otherScheduled.filter((m) => m.date === conflictDate && m.time === timeStr).map((m) => m.court)
        );
        for (let c = 1; c <= maxKnownCourt + 1; c++) {
          if (!occupiedCourts.has(c)) {
            return {
              date: conflictDate,
              hour: hh,
              minute: mm,
              court: String(c),
              reason: `Primera franja libre para ${teamLabel} después de su partido.`,
            };
          }
        }
      }
      return null;
    }
    return null;
  }, [scheduleMatch, scheduleConflictMatch, scheduleTeamConflict, scheduleDate, scheduleHour, scheduleMinute, scheduleCourt, scheduleTimeValue, matches]);
  const scheduleSuggestionApplied =
    !!scheduleSuggestion &&
    scheduleDate === scheduleSuggestion.date &&
    scheduleHour === scheduleSuggestion.hour &&
    scheduleMinute === scheduleSuggestion.minute &&
    scheduleCourt === scheduleSuggestion.court;
  useEffect(() => {
    if (!scheduleMessage) return;
    const timeoutId = window.setTimeout(() => setScheduleMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [scheduleMessage]);
  useEffect(() => {
    if ((conflictMatchesCount === 0 || activeTab !== "scheduled") && onlyConstraintConflicts) {
      setOnlyConstraintConflicts(false);
    }
  }, [conflictMatchesCount, activeTab, onlyConstraintConflicts]);
  useEffect(() => {
    if (isFlash && activeTab === "scheduled") {
      setActiveTab("unscheduled");
    }
  }, [isFlash, activeTab]);
  useEffect(() => {
    setSelectedMatchIds(new Set());
  }, [activeTab]);
  const matchesForTab =
    activeTab === "unscheduled"
      ? unscheduledMatches
      : activeTab === "scheduled"
        ? scheduledMatches
        : playedMatches;
  const emptyLabel =
    activeTab === "unscheduled"
      ? isFlash
        ? "No hay partidos pendientes."
        : "No hay partidos para programar."
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              onClick={() => router.push(`/tournaments/${tournamentId}`)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Resumen
            </button>
            <button
              type="button"
              aria-current="page"
              disabled
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              Partidos
            </button>
            <button
              type="button"
              onClick={() => router.push(`/tournaments/${tournamentId}/playoffs`)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Playoffs
            </button>
          </div>
          <Button variant="secondary" onClick={() => router.push("/tournaments")}>
            Volver a competencias
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
          {scheduleMessage && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {scheduleMessage}
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
                    {isFlash
                      ? `Pendientes (${unscheduledMatches.length})`
                      : `Faltan programar (${unscheduledMatches.length})`}
                  </Button>
                  {!isFlash && (
                    <Button
                      variant={activeTab === "scheduled" ? "primary" : "secondary"}
                      onClick={() => setActiveTab("scheduled")}
                    >
                      Programados ({scheduledMatches.length})
                    </Button>
                  )}
                  <Button
                    variant={activeTab === "played" ? "primary" : "secondary"}
                    onClick={() => setActiveTab("played")}
                  >
                    Jugados ({playedMatches.length})
                  </Button>
                  {canAutoScheduleFlash && (
                    <Button
                      variant="secondary"
                      onClick={autoScheduleFlashMatches}
                      disabled={autoSchedulingFlash}
                    >
                      {autoSchedulingFlash ? "Ordenando..." : "Ordenar partidos"}
                    </Button>
                  )}
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
                          {genderLabel(gender)}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isFlash && (
                    <Button variant="secondary" onClick={() => setGridOpen(true)}>
                      Grilla de partidos
                    </Button>
                  )}
                  {showConstraintToggle && (
                    <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                      <input
                        type="checkbox"
                        checked={onlyConstraintConflicts}
                        onChange={(event) => setOnlyConstraintConflicts(event.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800/20"
                      />
                      Solo inconsistencias ({conflictMatchesCount})
                    </label>
                  )}
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

              {activeTab === "unscheduled" && !isFlash && unscheduledMatches.length > 0 && canSchedule && (
                <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-600">
                    <input
                      type="checkbox"
                      checked={
                        selectedMatchIds.size > 0 &&
                        unscheduledMatches.every(
                          (m) => selectedMatchIds.has(m.id) || blockedMatchIds.has(m.id)
                        )
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMatchIds(
                            new Set(unscheduledMatches.filter((m) => !blockedMatchIds.has(m.id)).map((m) => m.id))
                          );
                        } else {
                          clearSelection();
                        }
                      }}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    {selectedMatchIds.size > 0
                      ? `${selectedMatchIds.size} seleccionado${selectedMatchIds.size !== 1 ? "s" : ""}`
                      : "Seleccionar todos"}
                  </label>
                  {selectedMatchIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-700"
                      >
                        Limpiar selección
                      </button>
                      <Button onClick={openBulkScheduleModal}>
                        Programar {selectedMatchIds.size} en simultáneo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {matches.length === 0 ? (
                <div className="text-sm text-zinc-600">No hay partidos cargados.</div>
              ) : matchesForTab.length === 0 ? (
                <div className="text-sm text-zinc-600">{emptyLabel}</div>
              ) : (
                matchesForTab.map((match, listIndex) => {
                  const matchConflicts = constraintConflictsByMatchId.get(match.id) ?? [];
                  const isUnscheduledTab = activeTab === "unscheduled" && !isFlash && canSchedule;
                  const isSelected = selectedMatchIds.has(match.id);
                  const isBlocked = blockedMatchIds.has(match.id);
                  return (
                    <div
                      key={match.id}
                      className={`rounded-2xl border p-4 ${isSelected ? "border-zinc-400 bg-zinc-50" : "border-zinc-200"}`}
                    >
                      <div className="flex gap-3">
                        {isUnscheduledTab && (
                          <div className="flex shrink-0 items-start pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isBlocked}
                              onChange={() => toggleMatchSelection(match.id)}
                              title={isBlocked ? "Una pareja de este partido ya está en otra selección" : undefined}
                              className="h-4 w-4 cursor-pointer rounded border-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                            />
                          </div>
                        )}
                      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs text-zinc-500">
                            {getStageLabel(match)} · Partido {getMatchCode(match)}
                          </div>
                          <div className="text-sm font-medium">
                            {getTeamLabel(match.team_a_id)} vs {getTeamLabel(match.team_b_id)}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Estado:{" "}
                            {match.status === "played"
                              ? "Jugado"
                              : match.status === "ongoing"
                              ? "En juego"
                              : isFlash
                              ? "Pendiente"
                              : match.scheduled_time
                              ? "Programado"
                              : "Falta programar"}
                          </div>
                          {isFlash && (
                            <div className="text-xs text-zinc-500">
                              Orden: #{listIndex + 1} · Cancha: {match.court_number ?? "—"}
                            </div>
                          )}
                          {!isFlash && match.scheduled_time && (
                            <div className="text-xs text-zinc-500">
                              {match.scheduled_date ? `Fecha: ${match.scheduled_date} · ` : ""}
                              Hora: {normalizeTime(match.scheduled_time)} · Cancha: {match.court_number ?? "—"}
                            </div>
                          )}
                          {matchConflicts.length > 0 && (
                            <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                              Inconsistencia con restricciones:{" "}
                              {matchConflicts
                                .map(
                                  (conflict) =>
                                    `${conflict.teamLabel} (${conflict.constraint})`
                                )
                                .join(" | ")}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/*
                            Keep scheduling enabled for placeholders; result actions require both teams.
                          */}
                          {(() => {
                            const hasTeamsDefined = hasDefinedTeams(match);
                            const canLoadResult =
                              hasTeamsDefined && (isFlash || !!match.scheduled_time);
                            if (match.status === "played") {
                              return (
                                <Button onClick={() => { void openResultModal(match); }} disabled={!canResult || !hasTeamsDefined}>
                                  Editar resultado
                                </Button>
                              );
                            }
                            return (
                              <>
                                {canLoadResult && (
                                  <Button
                                    onClick={() => { void openResultModal(match); }}
                                    disabled={!canResult}
                                  >
                                    Cargar resultado
                                  </Button>
                                )}
                                {!isFlash && (
                                  <Button
                                    variant="secondary"
                                    onClick={() => openScheduleModal(match)}
                                    disabled={!canSchedule}
                                  >
                                    {match.scheduled_time ? "Editar horario" : "Programar partido"}
                                  </Button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })
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
          {scheduleSuggestion && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              <div className="font-semibold text-zinc-800">
                {scheduleSuggestionApplied ? "Horario sugerido aplicado." : "Queres aplicar este horario?"}
              </div>
              <div className="mt-1">
                {formatShortDate(scheduleSuggestion.date)} {scheduleSuggestion.hour}:{scheduleSuggestion.minute} ·
                Cancha {scheduleSuggestion.court}.
              </div>
              <div className="mt-1">{scheduleSuggestion.reason}</div>
              {!scheduleSuggestionApplied && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleDate(scheduleSuggestion.date);
                    setScheduleHour(scheduleSuggestion.hour);
                    setScheduleMinute(scheduleSuggestion.minute);
                    setScheduleCourt(scheduleSuggestion.court);
                  }}
                  className="mt-2 font-semibold text-zinc-700 underline decoration-dotted hover:text-zinc-900"
                >
                  Aplicar sugerencia
                </button>
              )}
            </div>
          )}
          {scheduleMatchConstraintConflicts.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-3">
              <div className="space-y-1">
                <div className="font-semibold uppercase tracking-wide text-amber-800">
                  Restricciones en conflicto
                </div>
                {scheduleMatchConstraintConflicts.map((conflict) => (
                  <div key={`${conflict.teamId}-${conflict.constraint}`}>
                    <span className="font-semibold">{conflict.teamLabel}:</span> {conflict.constraint}
                  </div>
                ))}
              </div>
              <div>
                Este partido tiene una inconsistencia de restricciones. Podes buscar hasta 3 espacios
                vacios compatibles para reprogramarlo.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void loadAvailableScheduleSlots();
                  }}
                  disabled={availableScheduleSlotsLoading}
                >
                  {availableScheduleSlotsLoading ? "Buscando..." : "Buscar espacios"}
                </Button>
                {availableScheduleSlots.length > 0 && (
                  <span className="text-xs text-amber-800">
                    {availableScheduleSlots.length} opcion{availableScheduleSlots.length !== 1 ? "es" : ""} encontrada{availableScheduleSlots.length !== 1 ? "s" : ""}.
                  </span>
                )}
              </div>
              {availableScheduleSlotsError && (
                <div>{availableScheduleSlotsError}</div>
              )}
              {availableScheduleSlots.length > 0 && (
                <div className="space-y-2">
                  {availableScheduleSlots.map((slot, index) => (
                    <div
                      key={`${slot.date}-${slot.hour}-${slot.minute}-${slot.court}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2"
                    >
                      <div className="text-xs text-zinc-700">
                        Opcion {index + 1}: {formatShortDate(slot.date)} {slot.hour}:{slot.minute} · Cancha {slot.court}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setScheduleDate(slot.date);
                          setScheduleHour(slot.hour);
                          setScheduleMinute(slot.minute);
                          setScheduleCourt(slot.court);
                        }}
                        className="shrink-0 rounded-lg border border-amber-400 bg-transparent px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                      >
                        Aplicar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                {MINUTES.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
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
          {(scheduleConflictMatch || scheduleTeamConflict) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
              {scheduleConflictMatch && (
                <div>
                  <span className="font-semibold">Cancha ocupada:</span> la cancha {scheduleCourt} ya tiene
                  programado el partido {getMatchCode(scheduleConflictMatch)} ({getTeamLabel(scheduleConflictMatch.team_a_id)} vs{" "}
                  {getTeamLabel(scheduleConflictMatch.team_b_id)}) a las {scheduleHour}:{scheduleMinute}.
                </div>
              )}
              {scheduleTeamConflict && (
                <div>
                  <span className="font-semibold">{scheduleTeamConflict.teamLabel}</span> ya tiene partido
                  a las {scheduleHour}:{scheduleMinute} (Partido {getMatchCode(scheduleTeamConflict.match)}).
                </div>
              )}
              {scheduleConflictSuggestion && (
                <div className="pt-2 border-t border-amber-200 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Recomendacion</div>
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="3" width="12" height="11" rx="1.5"/>
                        <path d="M2 6.5h12"/>
                        <path d="M5 2v2M11 2v2"/>
                      </svg>
                      {formatShortDate(scheduleConflictSuggestion.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6"/>
                        <path d="M8 5v3.5l2.5 1.5"/>
                      </svg>
                      {scheduleConflictSuggestion.hour}:{scheduleConflictSuggestion.minute}
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="8" r="6"/>
                        <path d="M3.5 4.5C5 6 5 10 3.5 11.5" strokeLinecap="round"/>
                        <path d="M12.5 4.5C11 6 11 10 12.5 11.5" strokeLinecap="round"/>
                      </svg>
                      Cancha {scheduleConflictSuggestion.court}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleDate(scheduleConflictSuggestion.date);
                      setScheduleHour(scheduleConflictSuggestion.hour);
                      setScheduleMinute(scheduleConflictSuggestion.minute);
                      setScheduleCourt(scheduleConflictSuggestion.court);
                    }}
                    className="shrink-0 rounded-lg border border-amber-400 bg-transparent px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    Aplicar
                  </button>
                  </div>
                </div>
              )}
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
        open={bulkScheduleOpen}
        title={`Programar ${selectedMatchIds.size} partido${selectedMatchIds.size !== 1 ? "s" : ""} en simultáneo`}
        onClose={closeBulkScheduleModal}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                value={bulkHour}
                onChange={(e) => setBulkHour(e.target.value)}
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                value={bulkMinute}
                onChange={(e) => setBulkMinute(e.target.value)}
              >
                {MINUTES.map((minute) => (
                  <option key={minute} value={minute}>
                    {minute}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {bulkDate && bulkTimeValue && bulkTeamConflicts.length === 0 && selectedMatchIds.size > 0 && (() => {
            const time = bulkTimeValue;
            const occupied = new Set(
              matches
                .filter(
                  (m) =>
                    (m.scheduled_date ?? "") === bulkDate &&
                    normalizeTime(m.scheduled_time) === time &&
                    m.court_number && m.court_number > 0
                )
                .map((m) => m.court_number as number)
            );
            const assignments: { matchId: number; court: number }[] = [];
            let c = 1;
            for (const matchId of selectedMatchIds) {
              while (occupied.has(c)) c++;
              assignments.push({ matchId, court: c });
              occupied.add(c);
              c++;
            }
            return (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 space-y-1">
                <div className="font-semibold text-zinc-700">Canchas asignadas automáticamente:</div>
                {assignments.map(({ matchId, court }) => {
                  const match = matches.find((m) => m.id === matchId);
                  if (!match) return null;
                  return (
                    <div key={matchId} className="flex items-center justify-between">
                      <span>{getMatchCode(match)} · {getTeamLabel(match.team_a_id)} vs {getTeamLabel(match.team_b_id)}</span>
                      <span className="ml-2 shrink-0 font-semibold">Cancha {court}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {bulkTeamConflicts.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 space-y-1">
              <div className="font-semibold">Conflictos de horario:</div>
              {bulkTeamConflicts.map((c, i) => (
                <div key={i}>
                  <span className="font-medium">{c.teamLabel}</span> ya tiene el partido {c.conflictMatchCode} programado a esa hora.
                </div>
              ))}
            </div>
          )}

          {bulkScheduleError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {bulkScheduleError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBulkScheduleModal} type="button">
              Cancelar
            </Button>
            <Button
              onClick={() => { void saveBulkSchedule(); }}
              disabled={bulkScheduling || bulkTeamConflicts.length > 0}
            >
              {bulkScheduling
                ? "Guardando..."
                : `Programar ${selectedMatchIds.size} partido${selectedMatchIds.size !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
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
          <div className="space-y-3">
            {competitionType === "flash" ? (
              <div className="grid items-center gap-2 max-w-sm"
                style={{ gridTemplateColumns: "minmax(180px, 1fr) minmax(64px, 80px)" }}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Parejas
                </div>
                <div className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Set 1
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-500">Pareja 1</div>
                  <div className="text-sm text-zinc-700">
                    {selectedMatch ? getTeamLabel(selectedMatch.team_a_id) : "-"}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={setsInput[0]?.a ?? ""}
                  onChange={(e) => updateSet(0, "a", e.target.value)}
                  disabled={!canResult}
                  className="score-input !w-16 h-9 !px-0 justify-self-center text-center tabular-nums"
                />

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-500">Pareja 2</div>
                  <div className="text-sm text-zinc-700">
                    {selectedMatch ? getTeamLabel(selectedMatch.team_b_id) : "-"}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={setsInput[0]?.b ?? ""}
                  onChange={(e) => updateSet(0, "b", e.target.value)}
                  disabled={!canResult}
                  className="score-input !w-16 h-9 !px-0 justify-self-center text-center tabular-nums"
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="grid min-w-[420px] items-center gap-2"
                  style={{
                    gridTemplateColumns: `minmax(180px, 1fr) repeat(${setsInput.length}, minmax(72px, 1fr))`,
                  }}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Parejas
                  </div>
                  {setsInput.map((_, idx) => (
                    <div
                      key={`head-${idx}`}
                      className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    >
                      Set {idx + 1}
                    </div>
                  ))}

                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-zinc-500">Pareja 1</div>
                    <div className="text-sm text-zinc-700">
                      {selectedMatch ? getTeamLabel(selectedMatch.team_a_id) : "-"}
                    </div>
                  </div>
                  {setsInput.map((setScore, idx) => (
                    <Input
                      key={`a-${idx}`}
                      type="number"
                      min={0}
                      placeholder="0"
                      value={setScore.a}
                      onChange={(e) => updateSet(idx, "a", e.target.value)}
                      disabled={!canResult}
                      className="score-input text-center tabular-nums"
                    />
                  ))}

                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-zinc-500">Pareja 2</div>
                    <div className="text-sm text-zinc-700">
                      {selectedMatch ? getTeamLabel(selectedMatch.team_b_id) : "-"}
                    </div>
                  </div>
                  {setsInput.map((setScore, idx) => (
                    <Input
                      key={`b-${idx}`}
                      type="number"
                      min={0}
                      placeholder="0"
                      value={setScore.b}
                      onChange={(e) => updateSet(idx, "b", e.target.value)}
                      disabled={!canResult}
                      className="score-input text-center tabular-nums"
                    />
                  ))}
                </div>
              </div>
            )}
            {competitionType !== "flash" && (
              <div className="text-xs text-zinc-500">
                Carga minima: 2 sets completos, sin empates.
              </div>
            )}
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

      {gridOpen && (
        <ScheduledMatchesGridModal
          open={gridOpen}
          onClose={() => setGridOpen(false)}
          closeOnEscape={!gridMatch}
          scheduledMatches={scheduledMatches}
          onMatchSelect={setGridMatch}
          getStageLabel={getStageLabel}
          getMatchCode={getMatchCode}
          getMatchTeamsLabel={(match) =>
            `${getTeamLabel(match.team_a_id)} vs ${getTeamLabel(match.team_b_id)}`
          }
          getMatchCategoryLabel={(match) => resolveMatchCategoryLabel(match, teamsById)}
          onMatchReschedule={async (matchId, newDate, newTime, newCourt) => {
            const res = await api<{ updated: Match; swapped: Match | null }>(
              `/matches/${matchId}/schedule`,
              {
                method: "POST",
                body: { scheduled_date: newDate, scheduled_time: newTime, court_number: newCourt },
              }
            );
            setMatches((prev) =>
              prev.map((m) => {
                if (m.id === res.updated.id) return res.updated;
                if (res.swapped && m.id === res.swapped.id) return res.swapped;
                return m;
              })
            );
          }}
          getConstraintViolations={(matchId, newDate, newTime) => {
            const match = matches.find((m) => m.id === matchId);
            if (!match) return [];
            const violations: { teamLabel: string; constraint: string }[] = [];
            for (const teamId of [match.team_a_id, match.team_b_id]) {
              if (typeof teamId !== "number") continue;
              const team = teamsById.get(teamId);
              const constraints = (team?.schedule_constraints ?? "").trim();
              if (!constraints) continue;
              if (!isMatchAllowedByConstraints(constraints, newDate, newTime)) {
                const names = team?.players?.map((p) => p.name).filter(Boolean) ?? [];
                violations.push({
                  teamLabel: names.length > 0 ? names.join(" / ") : `Pareja #${teamId}`,
                  constraint: constraints,
                });
              }
            }
            return violations;
          }}
        />
      )}

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
