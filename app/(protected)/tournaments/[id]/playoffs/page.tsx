"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PlayoffAutoMode,
  PlayoffGenerateRequest,
  PlayoffManualSeed,
  PlayoffManualSeedsUpsertRequest,
  PlayoffStage,
  Team,
  Tournament,
  TournamentGroupOut,
  TournamentStatus,
  TournamentStatusResponse,
} from "@/lib/types";

type IdParam = { id: string };
type CompetitionType = "tournament" | "league" | "flash";

type EditableSet = { a: string; b: string };
type ManualSlotSide = "a" | "b";
type ManualSlotKind = "manual" | "winner";
type ManualSlot = {
  key: string;
  kind: ManualSlotKind;
  sourceStage?: PlayoffStage;
  sourceMatchIndex?: number;
};
type ManualDraftMatch = {
  stage: PlayoffStage;
  matchIndex: number;
  slotA: ManualSlot;
  slotB: ManualSlot;
};
type ManualDraftStage = {
  stage: PlayoffStage;
  matches: ManualDraftMatch[];
};
type GroupRankingEntry = {
  groupId: number;
  groupName: string;
  position: number;
  points: number;
  setDiff: number;
  gameDiff: number;
  teamId: number;
};
type SeedLabel = {
  seedA: string;
  seedB: string;
};
type SeedCandidate = {
  groupName: string;
  groupOrder: number;
  position: number;
};
type AutoModeOption = {
  mode: PlayoffAutoMode;
  label: string;
  description: string;
  enabled: boolean;
};
type BulkScheduleBaseConfig = {
  date: string;
  hour: string;
  minute: string;
  firstCourt: string;
  courtsCount: string;
};
type BulkScheduleStageConfig = {
  enabled: boolean;
  useGlobal: boolean;
  date: string;
  hour: string;
  minute: string;
  firstCourt: string;
  courtsCount: string;
};
type PendingPlayoffStage = {
  stage: PlayoffStage;
  matches: Match[];
};
type BulkScheduleTask = {
  match: Match;
  stage: PlayoffStage;
  scheduledDate: string;
  scheduledTime: string;
  courtNumber: number;
};
type BulkScheduleStageSummary = {
  stage: PlayoffStage;
  matchCount: number;
  slotCount: number;
  configuredStartTime: string;
  firstTime: string;
  lastTime: string;
  firstCourt: number;
  lastCourt: number;
  adjustedByMinutes: number;
};
type BulkSchedulePlanResult = {
  errors: Record<string, string>;
  tasks: BulkScheduleTask[];
  summaries: BulkScheduleStageSummary[];
};

const DEFAULT_SETS: EditableSet[] = [
  { a: "", b: "" },
  { a: "", b: "" },
  { a: "", b: "" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
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

const DEFAULT_AUTO_MODE: PlayoffAutoMode = "balanced";
const DEFAULT_MATCH_DURATION_MINUTES = 90;
const DEFAULT_BULK_STAGE_GAP_MINUTES = "30";
const BULK_MINUTE_OPTIONS = ["00", "15", "30", "45"];

function createBulkScheduleConfigMap(): Record<PlayoffStage, BulkScheduleStageConfig> {
  return {
    round_of_32: {
      enabled: false,
      useGlobal: true,
      date: "",
      hour: "",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    },
    round_of_16: {
      enabled: false,
      useGlobal: true,
      date: "",
      hour: "",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    },
    quarter: {
      enabled: false,
      useGlobal: true,
      date: "",
      hour: "",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    },
    semi: {
      enabled: false,
      useGlobal: true,
      date: "",
      hour: "",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    },
    final: {
      enabled: false,
      useGlobal: true,
      date: "",
      hour: "",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    },
  };
}

function manualSlotKey(stage: PlayoffStage, matchIndex: number, side: ManualSlotSide) {
  return `${stage}:${matchIndex}:${side}`;
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return value;
  }
  return toLocalIsoDate(new Date(year, month - 1, day + days));
}

function resolveGridDefaultDate(startDateRaw: string | null, todayIsoDate: string) {
  const startDate = startDateRaw?.slice(0, 10) ?? "";
  const isValidIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  if (!isValidIsoDate) return todayIsoDate;
  return todayIsoDate < startDate ? startDate : todayIsoDate;
}

function parseManualSlotKey(
  value: string
): { stage: PlayoffStage; matchIndex: number; side: ManualSlotSide } | null {
  const [stageRaw, matchIndexRaw, sideRaw] = value.split(":");
  if (!stageRaw || !matchIndexRaw || !sideRaw) return null;
  if (!PLAYOFF_STAGES.includes(stageRaw as PlayoffStage)) return null;
  if (sideRaw !== "a" && sideRaw !== "b") return null;
  const matchIndex = Number(matchIndexRaw);
  if (!Number.isInteger(matchIndex) || matchIndex < 0) return null;
  return {
    stage: stageRaw as PlayoffStage,
    matchIndex,
    side: sideRaw,
  };
}

function assignWinnerSlotIndexes(
  previousMatchCount: number,
  nextMatchCount: number
): Map<number, number> {
  const slotCount = nextMatchCount * 2;
  const result = new Map<number, number>();

  const assign = (winnerIdx: number, slotIdx: number) => {
    if (slotIdx < 0 || slotIdx >= slotCount) return;
    result.set(slotIdx, winnerIdx);
  };

  if (previousMatchCount >= slotCount) {
    for (let idx = 0; idx < slotCount; idx += 1) {
      assign(idx, idx);
    }
  } else if (previousMatchCount <= nextMatchCount) {
    for (let idx = 0; idx < previousMatchCount; idx += 1) {
      assign(idx, idx * 2 + 1);
    }
  } else {
    for (let idx = 0; idx < nextMatchCount; idx += 1) {
      assign(idx, idx * 2 + 1);
    }
    const remaining = previousMatchCount - nextMatchCount;
    for (let idx = 0; idx < Math.min(remaining, nextMatchCount); idx += 1) {
      assign(nextMatchCount + idx, idx * 2);
    }
  }

  return result;
}

function normalizeGroupSeedLabel(groupName: string) {
  return groupName.replace(/^(group|grupo|zona)\s*/i, "Grupo ");
}

function formatSeedCandidate(seed: SeedCandidate) {
  return `Pareja ${seed.position} ${normalizeGroupSeedLabel(seed.groupName)}`;
}

function rankSeedCandidate(seed: SeedCandidate) {
  return [seed.position, seed.groupOrder] as const;
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function standardBracketSeedOrder(size: number) {
  if (!isPowerOfTwo(size)) return [];
  let order = [1];
  while (order.length < size) {
    const currentSize = order.length * 2;
    const next: number[] = [];
    order.forEach((seed) => {
      next.push(seed);
      next.push(currentSize + 1 - seed);
    });
    order = next;
  }
  return order.map((seed) => seed - 1);
}

function pairSeedCandidatesRanked(seeds: SeedCandidate[]) {
  const ordered = [...seeds].sort((a, b) => {
    const [posA, orderA] = rankSeedCandidate(a);
    const [posB, orderB] = rankSeedCandidate(b);
    if (posA !== posB) return posA - posB;
    return orderA - orderB;
  });
  const remaining = [...ordered];
  const pairs: Array<[SeedCandidate, SeedCandidate]> = [];

  while (remaining.length >= 2) {
    const high = remaining.shift()!;
    let opponentIdx = -1;
    for (let idx = remaining.length - 1; idx >= 0; idx -= 1) {
      if (remaining[idx].groupName !== high.groupName) {
        opponentIdx = idx;
        break;
      }
    }
    if (opponentIdx === -1) opponentIdx = remaining.length - 1;
    const low = remaining.splice(opponentIdx, 1)[0];
    pairs.push([high, low]);
  }

  return pairs;
}

function buildDefaultSeedLabelsForStage(
  stage: PlayoffStage,
  groups: Array<{ name: string; teamCount: number }>
): SeedLabel[] {
  const targetTeamCount = STAGE_TEAM_COUNTS[stage];
  if (targetTeamCount <= 0 || groups.length === 0) return [];

  const allSeeds: SeedCandidate[] = [];
  groups.forEach((group, idx) => {
    if (group.teamCount >= 1) allSeeds.push({ groupName: group.name, groupOrder: idx, position: 1 });
    if (group.teamCount >= 2) allSeeds.push({ groupName: group.name, groupOrder: idx, position: 2 });
    if (group.teamCount >= 3) allSeeds.push({ groupName: group.name, groupOrder: idx, position: 3 });
  });

  const baseSeeds = allSeeds
    .filter((seed) => seed.position <= 2)
    .sort((a, b) => {
      const [posA, orderA] = rankSeedCandidate(a);
      const [posB, orderB] = rankSeedCandidate(b);
      if (posA !== posB) return posA - posB;
      return orderA - orderB;
    });

  let qualified = baseSeeds.slice(0, targetTeamCount);
  if (qualified.length < targetTeamCount) {
    const thirds = allSeeds
      .filter((seed) => seed.position === 3)
      .sort((a, b) => a.groupOrder - b.groupOrder);
    qualified = [...qualified, ...thirds.slice(0, targetTeamCount - qualified.length)];
  }

  const grouped = new Map<string, Map<number, SeedCandidate>>();
  const groupOrder: string[] = [];
  qualified.forEach((seed) => {
    if (!grouped.has(seed.groupName)) {
      grouped.set(seed.groupName, new Map());
      groupOrder.push(seed.groupName);
    }
    grouped.get(seed.groupName)!.set(seed.position, seed);
  });

  const used = new Set<string>();
  const pairs: Array<[SeedCandidate, SeedCandidate]> = [];

  const fullGroupNames = groupOrder.filter((name) => {
    const seedsForGroup = grouped.get(name);
    return !!seedsForGroup?.get(1) && !!seedsForGroup?.get(2);
  });

  if (fullGroupNames.length >= 2 && isPowerOfTwo(fullGroupNames.length)) {
    const bracketOrderIndexes = standardBracketSeedOrder(fullGroupNames.length);
    const firstGroupOrder = bracketOrderIndexes.map((idx) => fullGroupNames[idx]);
    const firstPosition = new Map<string, number>();
    firstGroupOrder.forEach((groupName, idx) => firstPosition.set(groupName, idx));

    let bestShift = 1;
    let bestScore: [number, number] | null = null;
    for (let shift = 1; shift < fullGroupNames.length; shift += 1) {
      const secondGroupOrder = firstGroupOrder.map(
        (_, idx) => fullGroupNames[(idx + shift) % fullGroupNames.length]
      );
      const hasCollision = secondGroupOrder.some(
        (groupName, idx) => groupName === firstGroupOrder[idx]
      );
      if (hasCollision) continue;

      const secondPosition = new Map<string, number>();
      secondGroupOrder.forEach((groupName, idx) => secondPosition.set(groupName, idx));
      const distances = fullGroupNames.map((groupName) =>
        Math.abs((firstPosition.get(groupName) ?? 0) - (secondPosition.get(groupName) ?? 0))
      );
      const score: [number, number] = [
        Math.min(...distances),
        distances.reduce((sum, value) => sum + value, 0),
      ];
      if (
        !bestScore
        || score[0] > bestScore[0]
        || (score[0] === bestScore[0] && score[1] > bestScore[1])
      ) {
        bestScore = score;
        bestShift = shift;
      }
    }

    const secondGroupOrder = firstGroupOrder.map(
      (_, idx) => fullGroupNames[(idx + bestShift) % fullGroupNames.length]
    );
    firstGroupOrder.forEach((groupName, idx) => {
      const firstSeed = grouped.get(groupName)?.get(1);
      const secondSeed = grouped.get(secondGroupOrder[idx])?.get(2);
      if (!firstSeed || !secondSeed) return;
      pairs.push([firstSeed, secondSeed]);
      used.add(`${firstSeed.groupName}:${firstSeed.position}`);
      used.add(`${secondSeed.groupName}:${secondSeed.position}`);
    });
  } else {
    for (let idx = 0; idx < groupOrder.length - 1; idx += 2) {
      const a = grouped.get(groupOrder[idx]);
      const b = grouped.get(groupOrder[idx + 1]);
      const a1 = a?.get(1);
      const a2 = a?.get(2);
      const b1 = b?.get(1);
      const b2 = b?.get(2);
      if (!a1 || !a2 || !b1 || !b2) continue;
      pairs.push([a1, b2]);
      pairs.push([a2, b1]);
      used.add(`${a1.groupName}:${a1.position}`);
      used.add(`${a2.groupName}:${a2.position}`);
      used.add(`${b1.groupName}:${b1.position}`);
      used.add(`${b2.groupName}:${b2.position}`);
    }
  }

  const remaining = qualified.filter(
    (seed) => !used.has(`${seed.groupName}:${seed.position}`)
  );
  if (remaining.length > 0) {
    pairs.push(...pairSeedCandidatesRanked(remaining));
  }

  const maxPairs = Math.floor(targetTeamCount / 2);
  return pairs.slice(0, maxPairs).map(([seedA, seedB]) => ({
    seedA: formatSeedCandidate(seedA),
    seedB: formatSeedCandidate(seedB),
  }));
}

export default function TournamentPlayoffsPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [tournamentMatchDurationMinutes, setTournamentMatchDurationMinutes] = useState(
    DEFAULT_MATCH_DURATION_MINUTES
  );
  const [competitionType, setCompetitionType] = useState<CompetitionType>("tournament");
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmStage, setConfirmStage] = useState<PlayoffStage | null>(null);
  const [confirmAutoMode, setConfirmAutoMode] = useState<PlayoffAutoMode>(DEFAULT_AUTO_MODE);
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
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkScheduleBaseConfig, setBulkScheduleBaseConfig] = useState<BulkScheduleBaseConfig>(
    {
      date: "",
      hour: "13",
      minute: "00",
      firstCourt: "1",
      courtsCount: "1",
    }
  );
  const [bulkStageGapMinutes, setBulkStageGapMinutes] = useState(
    DEFAULT_BULK_STAGE_GAP_MINUTES
  );
  const [bulkScheduleByStage, setBulkScheduleByStage] =
    useState<Record<PlayoffStage, BulkScheduleStageConfig>>(createBulkScheduleConfigMap);
  const [bulkScheduleFieldErrors, setBulkScheduleFieldErrors] = useState<
    Record<string, string>
  >({});
  const [bulkScheduling, setBulkScheduling] = useState(false);
  const [bulkScheduleError, setBulkScheduleError] = useState<string | null>(null);
  const [bulkScheduleMessage, setBulkScheduleMessage] = useState<string | null>(null);
  const [resetPlayoffsOpen, setResetPlayoffsOpen] = useState(false);
  const [resettingPlayoffs, setResettingPlayoffs] = useState(false);
  const [resetPlayoffsError, setResetPlayoffsError] = useState<string | null>(null);
  const [bulkScheduleSuccess, setBulkScheduleSuccess] = useState<{
    scheduledCount: number;
    totalCount: number;
    firstMatchId: number | null;
  } | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [gridMatch, setGridMatch] = useState<Match | null>(null);
  const [gridDateFilter, setGridDateFilter] = useState("");

  const [manualStage, setManualStage] = useState<PlayoffStage | null>(null);
  const [manualSlotValues, setManualSlotValues] = useState<Record<string, number | "">>({});
  const [manualInitialTeamCount, setManualInitialTeamCount] = useState(2);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualStageOpen, setManualStageOpen] = useState(false);
  const [manualStageCandidate, setManualStageCandidate] = useState<PlayoffStage | "">("");
  const hasDefaultedFilters = useRef(false);

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
  const divisionGroups = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];
    return groups
      .map((group) => {
        const teamIds = group.teams
          .filter((team) => {
            const fallbackTeam = teamsById.get(team.id);
            const category =
              team.players?.[0]?.category ?? fallbackTeam?.players?.[0]?.category ?? null;
            const gender =
              team.players?.[0]?.gender ?? fallbackTeam?.players?.[0]?.gender ?? null;
            return category === categoryFilter && gender === genderFilter;
          })
          .map((team) => team.id);
        return { group, teamIds };
      })
      .filter((entry) => entry.teamIds.length > 0);
  }, [groups, categoryFilter, genderFilter, teamsById]);
  const groupSeedCandidates = useMemo(
    () =>
      [...divisionGroups]
        .sort((a, b) => a.group.name.localeCompare(b.group.name))
        .map(({ group, teamIds }) => ({
          name: group.name,
          teamCount: teamIds.length,
        })),
    [divisionGroups]
  );
  const defaultSeedLabelsByStage = useMemo(() => {
    const map = new Map<PlayoffStage, SeedLabel[]>();
    PLAYOFF_STAGES.forEach((stage) => {
      map.set(stage, buildDefaultSeedLabelsForStage(stage, groupSeedCandidates));
    });
    return map;
  }, [groupSeedCandidates]);

  const rankedTeamsByGroup = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];

    const rankEntries: GroupRankingEntry[] = [];
    const labelForTeamId = (teamId: number) => {
      const team = teamsById.get(teamId);
      if (!team) return `Team #${teamId}`;
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${teamId}`;
    };

    divisionGroups.forEach(({ group, teamIds }) => {
      const groupTeamIds = new Set(teamIds);
      const stats = new Map<
        number,
        { points: number; setsFor: number; setsAgainst: number; gamesFor: number; gamesAgainst: number }
      >();

      teamIds.forEach((teamId) => {
        stats.set(teamId, {
          points: 0,
          setsFor: 0,
          setsAgainst: 0,
          gamesFor: 0,
          gamesAgainst: 0,
        });
      });

      const groupMatches = matches.filter(
        (match) =>
          match.stage === "group"
          && match.group_id === group.id
          && match.status === "played"
          && !!match.sets
          && match.team_a_id !== null
          && match.team_b_id !== null
          && groupTeamIds.has(match.team_a_id)
          && groupTeamIds.has(match.team_b_id)
      );

      groupMatches.forEach((match) => {
        if (!hasDefinedTeams(match)) return;
        let setsWonA = 0;
        let setsWonB = 0;
        let gamesA = 0;
        let gamesB = 0;

        (match.sets ?? []).forEach((setScore) => {
          gamesA += setScore.a;
          gamesB += setScore.b;
          if (setScore.a > setScore.b) setsWonA += 1;
          if (setScore.b > setScore.a) setsWonB += 1;
        });

        const pointsA = setsWonA > setsWonB ? (setsWonB === 0 ? 3 : 2) : setsWonA < setsWonB ? (setsWonA === 0 ? 0 : 1) : 0;
        const pointsB = setsWonB > setsWonA ? (setsWonA === 0 ? 3 : 2) : setsWonB < setsWonA ? (setsWonB === 0 ? 0 : 1) : 0;

        const teamAStats = stats.get(match.team_a_id);
        const teamBStats = stats.get(match.team_b_id);
        if (!teamAStats || !teamBStats) return;

        teamAStats.points += pointsA;
        teamAStats.setsFor += setsWonA;
        teamAStats.setsAgainst += setsWonB;
        teamAStats.gamesFor += gamesA;
        teamAStats.gamesAgainst += gamesB;

        teamBStats.points += pointsB;
        teamBStats.setsFor += setsWonB;
        teamBStats.setsAgainst += setsWonA;
        teamBStats.gamesFor += gamesB;
        teamBStats.gamesAgainst += gamesA;
      });

      const rows = Array.from(stats.entries()).map(([teamId, values]) => ({
        teamId,
        points: values.points,
        setDiff: values.setsFor - values.setsAgainst,
        gameDiff: values.gamesFor - values.gamesAgainst,
      }));

      rows.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
        if (a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
        return labelForTeamId(a.teamId).localeCompare(labelForTeamId(b.teamId));
      });

      rows.forEach((row, idx) => {
        rankEntries.push({
          groupId: group.id,
          groupName: group.name.replace(/^(group|grupo)\s*/i, "Zona "),
          position: idx + 1,
          points: row.points,
          setDiff: row.setDiff,
          gameDiff: row.gameDiff,
          teamId: row.teamId,
        });
      });
    });

    rankEntries.sort((a, b) => {
      const groupCmp = a.groupName.localeCompare(b.groupName);
      if (groupCmp !== 0) return groupCmp;
      if (a.position !== b.position) return a.position - b.position;
      if (a.points !== b.points) return b.points - a.points;
      if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
      return b.gameDiff - a.gameDiff;
    });

    return rankEntries;
  }, [divisionGroups, matches, categoryFilter, genderFilter, teamsById]);

  const groupRankingByTeam = useMemo(() => {
    const map = new Map<number, GroupRankingEntry>();
    rankedTeamsByGroup.forEach((entry) => map.set(entry.teamId, entry));
    return map;
  }, [rankedTeamsByGroup]);
  const overallRankingByTeam = useMemo(() => {
    const labelForTeamId = (teamId: number) => {
      const team = teamsById.get(teamId);
      if (!team) return `Team #${teamId}`;
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${teamId}`;
    };
    const global = [...rankedTeamsByGroup].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      if (a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
      if (a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
      return labelForTeamId(a.teamId).localeCompare(labelForTeamId(b.teamId));
    });
    const map = new Map<number, number>();
    global.forEach((entry, idx) => map.set(entry.teamId, idx + 1));
    return map;
  }, [rankedTeamsByGroup, teamsById]);

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

    if (categoryFilter !== "all" && genderFilter !== "all") {
      return [...filtered].sort((a, b) => {
        const rankA = overallRankingByTeam.get(a.id);
        const rankB = overallRankingByTeam.get(b.id);
        if (typeof rankA === "number" && typeof rankB === "number" && rankA !== rankB) {
          return rankA - rankB;
        }
        if (typeof rankA === "number") return -1;
        if (typeof rankB === "number") return 1;
        return labelFor(a).localeCompare(labelFor(b));
      });
    }

    return [...filtered].sort((a, b) => {
      return labelFor(a).localeCompare(labelFor(b));
    });
  }, [teams, categoryFilter, genderFilter, overallRankingByTeam]);

  const matchesByStage = useMemo(() => {
    const matchCategory = (match: Match) => {
      if (match.category) return match.category;
      if (typeof match.team_a_id === "number") {
        const category = teamsById.get(match.team_a_id)?.players?.[0]?.category ?? null;
        if (category) return category;
      }
      if (typeof match.team_b_id === "number") {
        return teamsById.get(match.team_b_id)?.players?.[0]?.category ?? null;
      }
      return null;
    };
    const matchGender = (match: Match) => {
      if (match.gender) return match.gender;
      if (typeof match.team_a_id === "number") {
        const gender = teamsById.get(match.team_a_id)?.players?.[0]?.gender ?? null;
        if (gender) return gender;
      }
      if (typeof match.team_b_id === "number") {
        return teamsById.get(match.team_b_id)?.players?.[0]?.gender ?? null;
      }
      return null;
    };
    const map = new Map<PlayoffStage, Match[]>();
    PLAYOFF_STAGES.forEach((stage) => map.set(stage, []));
    matches.forEach((match) => {
      if (match.stage === "group") return;
      if (categoryFilter !== "all") {
        const category = matchCategory(match);
        if (category !== categoryFilter) return;
      }
      if (genderFilter !== "all") {
        const gender = matchGender(match);
        if (gender !== genderFilter) return;
      }
      map.get(match.stage)?.push(match);
    });
    return map;
  }, [matches, categoryFilter, genderFilter, teamsById]);
  const hasPlayoffs = useMemo(
    () => Array.from(matchesByStage.values()).some((items) => items.length > 0),
    [matchesByStage]
  );
  const hasDefinedPlayoffTeams = useMemo(
    () =>
      Array.from(matchesByStage.values()).some((stageMatches) =>
        stageMatches.some((match) => hasDefinedTeams(match))
      ),
    [matchesByStage]
  );
  const pendingPlayoffStages = useMemo<PendingPlayoffStage[]>(
    () =>
      PLAYOFF_STAGES.map((stage) => ({
        stage,
        matches: [...(matchesByStage.get(stage) ?? [])]
          .filter((match) => match.status === "pending")
          .sort((a, b) => a.id - b.id),
      })).filter((entry) => entry.matches.length > 0),
    [matchesByStage]
  );
  const schedulablePlayoffStages = useMemo<PendingPlayoffStage[]>(
    () =>
      pendingPlayoffStages
        .map(({ stage, matches: stageMatches }) => ({
          stage,
          matches: stageMatches.filter(
            (match) =>
              !match.scheduled_date
              || !match.scheduled_time
              || !match.court_number
              || match.court_number <= 0
          ),
        }))
        .filter((entry) => entry.matches.length > 0),
    [pendingPlayoffStages]
  );
  const winnerByStageIndex = useMemo(() => {
    const map = new Map<PlayoffStage, Map<number, number>>();
    PLAYOFF_STAGES.forEach((stage) => {
      const stageMatches = [...(matchesByStage.get(stage) ?? [])].sort((a, b) => a.id - b.id);
      const winners = new Map<number, number>();
      stageMatches.forEach((match, idx) => {
        if (match.winner_team_id) {
          winners.set(idx, match.winner_team_id);
        }
      });
      map.set(stage, winners);
    });
    return map;
  }, [matchesByStage]);

  const categoryFilteredMatches = useMemo(() => {
    const matchCategory = (match: Match) => {
      if (match.category) return match.category;
      if (typeof match.team_a_id === "number") {
        const category = teamsById.get(match.team_a_id)?.players?.[0]?.category ?? null;
        if (category) return category;
      }
      if (typeof match.team_b_id === "number") {
        return teamsById.get(match.team_b_id)?.players?.[0]?.category ?? null;
      }
      return null;
    };
    const matchGender = (match: Match) => {
      if (match.gender) return match.gender;
      if (typeof match.team_a_id === "number") {
        const gender = teamsById.get(match.team_a_id)?.players?.[0]?.gender ?? null;
        if (gender) return gender;
      }
      if (typeof match.team_b_id === "number") {
        return teamsById.get(match.team_b_id)?.players?.[0]?.gender ?? null;
      }
      return null;
    };
    return matches.filter((match) => {
      const category = matchCategory(match);
      const gender = matchGender(match);
      const categoryMatch = categoryFilter === "all" || category === categoryFilter;
      const genderMatch = genderFilter === "all" || gender === genderFilter;
      return categoryMatch && genderMatch;
    });
  }, [matches, categoryFilter, genderFilter, teamsById]);
  const scheduledMatches = useMemo(
    () =>
      categoryFilteredMatches.filter(
        (match) => !!match.scheduled_time && !!match.scheduled_date
      ),
    [categoryFilteredMatches]
  );
  const gridStartDate = useMemo(() => {
    const dates = Array.from(
      new Set(
        scheduledMatches
          .map((match) => (match.scheduled_date ?? "").slice(0, 10))
          .filter((date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date))
      )
    ).sort();
    return dates[0] ?? null;
  }, [scheduledMatches]);
  const todayIsoDate = useMemo(() => toLocalIsoDate(new Date()), []);
  const defaultGridDate = useMemo(() => {
    return resolveGridDefaultDate(gridStartDate, todayIsoDate);
  }, [gridStartDate, todayIsoDate]);
  const gridAvailableDates = useMemo(() => {
    const dates = Array.from(
      new Set(scheduledMatches.map((match) => match.scheduled_date as string))
    ).sort();
    if (!dates.includes(defaultGridDate)) {
      dates.push(defaultGridDate);
      dates.sort();
    }
    return dates;
  }, [scheduledMatches, defaultGridDate]);
  const gridMatchesForDate = useMemo(
    () =>
      scheduledMatches.filter(
        (match) => (match.scheduled_date ?? "") === gridDateFilter
      ),
    [scheduledMatches, gridDateFilter]
  );
  const gridData = useMemo(() => {
    const times = Array.from(
      new Set(
        gridMatchesForDate
          .map((match) => normalizeTime(match.scheduled_time))
          .filter(Boolean)
      )
    ).sort();
    const courtValues = Array.from(
      new Set(gridMatchesForDate.map((match) => match.court_number ?? -1))
    ).sort((a, b) => {
      if (a === -1 && b === -1) return 0;
      if (a === -1) return 1;
      if (b === -1) return -1;
      return a - b;
    });
    const courts = courtValues.map((court) => ({
      key: String(court),
      label: court === -1 ? "Sin cancha" : `Cancha ${court}`,
    }));
    const map = new Map<string, Map<string, Match[]>>();

    gridMatchesForDate.forEach((match) => {
      const timeKey = normalizeTime(match.scheduled_time);
      const courtKey = String(match.court_number ?? -1);
      if (!timeKey) return;
      if (!map.has(timeKey)) {
        map.set(timeKey, new Map());
      }
      const courtMap = map.get(timeKey)!;
      if (!courtMap.has(courtKey)) {
        courtMap.set(courtKey, []);
      }
      courtMap.get(courtKey)!.push(match);
    });

    map.forEach((courtMap) => {
      courtMap.forEach((matchesInCell) => {
        matchesInCell.sort((a, b) => a.id - b.id);
      });
    });

    return { times, courts, map };
  }, [gridMatchesForDate]);
  useEffect(() => {
    setGridDateFilter((prev) => {
      if (prev && gridAvailableDates.includes(prev)) return prev;
      if (gridAvailableDates.includes(defaultGridDate)) return defaultGridDate;
      return gridAvailableDates[0] ?? defaultGridDate;
    });
  }, [gridAvailableDates, defaultGridDate]);
  useEffect(() => {
    if (!gridOpen) return;
    setGridDateFilter(defaultGridDate);
  }, [gridOpen, defaultGridDate]);
  const shiftGridDate = (days: number) => {
    setGridDateFilter((prev) => {
      const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(prev) ? prev : defaultGridDate;
      return shiftIsoDate(baseDate, days);
    });
  };

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
    if (divisionGroups.length === 0) return false;

    for (const { group, teamIds } of divisionGroups) {
      const divisionTeamIds = new Set(teamIds);
      const groupMatches = matches.filter(
        (match) =>
          match.stage === "group"
          && match.group_id === group.id
          && match.team_a_id !== null
          && match.team_b_id !== null
          && divisionTeamIds.has(match.team_a_id)
          && divisionTeamIds.has(match.team_b_id)
      );
      const expected = (teamIds.length * (teamIds.length - 1)) / 2;

      if (groupMatches.length < expected) return false;
      if (groupMatches.some((match) => match.status !== "played" || !match.sets)) {
        return false;
      }
    }

    return true;
  }, [divisionGroups, matches, categoryFilter, genderFilter]);

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
    return stageMatches.every(
      (match) => match.status === "played" && match.winner_team_id
    );
  }, [latestStage, nextStage, matchesByStage]);
  const stagePendingAutomaticAssignment = useMemo(() => {
    for (const stage of PLAYOFF_STAGES) {
      const stageMatches = matchesByStage.get(stage) ?? [];
      if (stageMatches.length === 0) continue;
      const hasAnyDefined = stageMatches.some((match) => hasDefinedTeams(match));
      const hasPending = stageMatches.some((match) => !hasDefinedTeams(match));
      if (hasPending && !hasAnyDefined) return stage;
    }
    return null;
  }, [matchesByStage]);

  const availableStages = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];
    if (matchesByStage.size === 0) return [];
    if (stagePendingAutomaticAssignment) {
      return groupStageComplete ? [stagePendingAutomaticAssignment] : [];
    }
    if (latestStage) {
      if (!nextStage || !canGenerateNextStage) return [];
      return [nextStage];
    }

    if (divisionGroups.length === 0) return [];

    const baseQualified = divisionGroups.reduce(
      (sum, entry) => sum + Math.min(2, entry.teamIds.length),
      0
    );
    const thirdsAvailable = divisionGroups.reduce(
      (sum, entry) => sum + (entry.teamIds.length >= 3 ? 1 : 0),
      0
    );
    const maxQualified = baseQualified + thirdsAvailable;
    const divisionTeamCount = divisionGroups.reduce(
      (sum, entry) => sum + entry.teamIds.length,
      0
    );
    const allGroupsHaveAtLeastTwo = divisionGroups.every(
      (entry) => entry.teamIds.length >= 2
    );
    const qualifiedTopTwoCount = baseQualified;
    const hasQuarterAlternativeFormat =
      (allGroupsHaveAtLeastTwo && qualifiedTopTwoCount >= 5 && qualifiedTopTwoCount <= 8)
      || divisionTeamCount === 7
      || divisionTeamCount === 9;

    return PLAYOFF_STAGES.filter(
      (stage) =>
        STAGE_TEAM_COUNTS[stage] <= maxQualified
        || (stage === "quarter" && hasQuarterAlternativeFormat)
    );
  }, [
    matchesByStage,
    stagePendingAutomaticAssignment,
    latestStage,
    nextStage,
    canGenerateNextStage,
    groupStageComplete,
    divisionGroups,
    categoryFilter,
    genderFilter,
  ]);
  const divisionTeamCount = useMemo(
    () => divisionGroups.reduce((sum, entry) => sum + entry.teamIds.length, 0),
    [divisionGroups]
  );
  const autoModeOptionsByStage = useMemo(() => {
    const map = new Map<PlayoffStage, AutoModeOption[]>();
    const isFirstAssignmentPhase = !hasDefinedPlayoffTeams;
    const allGroupsHaveAtLeastTwo = divisionGroups.every(
      (entry) => entry.teamIds.length >= 2
    );
    const baseQualified = divisionGroups.reduce(
      (sum, entry) => sum + Math.min(2, entry.teamIds.length),
      0
    );
    const thirdsAvailable = divisionGroups.reduce(
      (sum, entry) => sum + (entry.teamIds.length >= 3 ? 1 : 0),
      0
    );
    const maxQualified = baseQualified + thirdsAvailable;
    const qualifiedTopTwoCount = baseQualified;
    const quarterTopTwoPossible =
      allGroupsHaveAtLeastTwo
      && qualifiedTopTwoCount >= 5
      && qualifiedTopTwoCount <= 8;
    const quarterBestPossible = divisionTeamCount === 7;
    const quarterPlayInPossible = divisionTeamCount === 9;
    const pendingStage = stagePendingAutomaticAssignment;
    const pendingMatchCount = pendingStage
      ? (matchesByStage.get(pendingStage) ?? []).length
      : 0;
    const isStructureOnlyPhase =
      hasPlayoffs && isFirstAssignmentPhase && !!pendingStage;

    const isModeCompatibleForPending = (
      mode: PlayoffAutoMode,
      stage: PlayoffStage
    ) => {
      if (!isStructureOnlyPhase || !pendingStage) return true;
      if (stage !== pendingStage) return false;

      if (mode === "balanced") {
        return pendingMatchCount === Math.max(1, STAGE_TEAM_COUNTS[stage] / 2);
      }

      if (mode === "top_two_per_group") {
        return (
          stage === "quarter"
          && quarterTopTwoPossible
          && pendingMatchCount === Math.max(1, qualifiedTopTwoCount - 4)
        );
      }

      if (mode === "best_to_semi_quarter") {
        return stage === "quarter" && quarterBestPossible && pendingMatchCount === 3;
      }

      if (mode === "play_in_lowest_ranked") {
        return stage === "round_of_16" && quarterPlayInPossible && pendingMatchCount === 1;
      }

      return false;
    };

    availableStages.forEach((stage) => {
      const isQuarterStage = stage === "quarter";
      const balancedEnabled =
        !isFirstAssignmentPhase || STAGE_TEAM_COUNTS[stage] <= maxQualified;

      const options: AutoModeOption[] = [];
      if (balancedEnabled && isModeCompatibleForPending("balanced", stage)) {
        options.push({
          mode: "balanced",
          label: "Clasificacion por tabla general",
          description:
            "Arma el cuadro segun el ranking total: entran 1eros, 2dos y, si faltan cupos, los mejores 3eros.",
          enabled: true,
        });
      }

      if (isQuarterStage) {
        const topTwoEnabled =
          isFirstAssignmentPhase
          && quarterTopTwoPossible
          && isModeCompatibleForPending("top_two_per_group", stage);
        if (topTwoEnabled) {
          options.push({
            mode: "top_two_per_group",
            label: "Solo pasan 2 por zona",
            description:
              "Clasifican solo el 1ero y 2do de cada zona. Si faltan resultados, se crea el cuadro con lugares Por definir.",
            enabled: true,
          });
        }

        const bestToSemiEnabled =
          isFirstAssignmentPhase
          && quarterBestPossible
          && isModeCompatibleForPending("best_to_semi_quarter", stage);
        if (bestToSemiEnabled) {
          options.push({
            mode: "best_to_semi_quarter",
            label: "La mejor pasa directo a semifinal",
            description:
              "La pareja mejor ubicada no juega cuartos y espera en semifinal. El resto arranca en cuartos.",
            enabled: true,
          });
        }

        const playInEnabled =
          isFirstAssignmentPhase
          && quarterPlayInPossible
          && isModeCompatibleForPending("play_in_lowest_ranked", "round_of_16");
        if (playInEnabled) {
          options.push({
            mode: "play_in_lowest_ranked",
            label: "Partido previo entre 8° y 9°",
            description:
              "Se juega un partido previo entre 8° y 9°. El ganador entra a cuartos para jugar contra el 1°.",
            enabled: true,
          });
        }
      }

      if (
        stage === "round_of_16"
        && isFirstAssignmentPhase
        && quarterPlayInPossible
        && isModeCompatibleForPending("play_in_lowest_ranked", stage)
      ) {
        options.push({
          mode: "play_in_lowest_ranked",
          label: "Partido previo entre 8° y 9°",
          description:
            "Primero se programa 8° vs 9°. Cuando se carga ese resultado, se completa automaticamente su cruce de cuartos.",
          enabled: true,
        });
      }

      map.set(stage, options);
    });

    return map;
  }, [
    availableStages,
    hasDefinedPlayoffTeams,
    hasPlayoffs,
    matchesByStage,
    stagePendingAutomaticAssignment,
    divisionTeamCount,
    divisionGroups,
  ]);

  const manualStageOptions = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];
    if (divisionGroups.length === 0) return [];
    return PLAYOFF_STAGES;
  }, [divisionGroups.length, categoryFilter, genderFilter]);

  const manualInitialTeamOptions = useMemo(() => {
    if (!manualStage) return [];
    const maxTeams = STAGE_TEAM_COUNTS[manualStage];
    const values: number[] = [];
    for (let count = 2; count <= maxTeams; count += 2) {
      values.push(count);
    }
    return values;
  }, [manualStage]);

  const manualDraftStages = useMemo(() => {
    if (!manualStage) return [];

    const startIdx = PLAYOFF_STAGES.indexOf(manualStage);
    if (startIdx === -1) return [];

    const stagePath = PLAYOFF_STAGES.slice(startIdx);
    const drafts: ManualDraftStage[] = [];
    let previousStage: PlayoffStage | null = null;
    let previousMatchCount = 0;

    stagePath.forEach((stage, pathIdx) => {
      const standardMatchCount = Math.max(1, STAGE_TEAM_COUNTS[stage] / 2);
      const initialMatchCount = Math.max(1, Math.floor(manualInitialTeamCount / 2));
      const matchCount =
        pathIdx === 0 ? Math.min(initialMatchCount, standardMatchCount) : standardMatchCount;

      const slots: ManualSlot[] = Array.from({ length: matchCount * 2 }, (_, slotIdx) => {
        const side: ManualSlotSide = slotIdx % 2 === 0 ? "a" : "b";
        const matchIndex = Math.floor(slotIdx / 2);
        return {
          key: manualSlotKey(stage, matchIndex, side),
          kind: "manual",
        };
      });

      const assignWinnerSlot = (winnerIdx: number, slotIdx: number) => {
        if (!previousStage || slotIdx < 0 || slotIdx >= slots.length) return;
        const side: ManualSlotSide = slotIdx % 2 === 0 ? "a" : "b";
        const matchIndex = Math.floor(slotIdx / 2);
        slots[slotIdx] = {
          key: manualSlotKey(stage, matchIndex, side),
          kind: "winner",
          sourceStage: previousStage,
          sourceMatchIndex: winnerIdx,
        };
      };

      if (previousStage && previousMatchCount > 0) {
        if (previousMatchCount >= slots.length) {
          for (let i = 0; i < slots.length; i += 1) {
            assignWinnerSlot(i, i);
          }
        } else if (previousMatchCount <= matchCount) {
          for (let i = 0; i < previousMatchCount; i += 1) {
            assignWinnerSlot(i, i * 2 + 1);
          }
        } else {
          for (let i = 0; i < matchCount; i += 1) {
            assignWinnerSlot(i, i * 2 + 1);
          }
          const remaining = previousMatchCount - matchCount;
          for (let i = 0; i < remaining && i < matchCount; i += 1) {
            assignWinnerSlot(matchCount + i, i * 2);
          }
        }
      }

      const matchesDraft: ManualDraftMatch[] = Array.from(
        { length: matchCount },
        (_, matchIdx) => ({
          stage,
          matchIndex: matchIdx,
          slotA: slots[matchIdx * 2],
          slotB: slots[matchIdx * 2 + 1],
        })
      );

      drafts.push({ stage, matches: matchesDraft });
      previousStage = stage;
      previousMatchCount = matchCount;
    });

    return drafts;
  }, [manualStage, manualInitialTeamCount]);

  const manualEditableSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    manualDraftStages.forEach((stageDraft) => {
      stageDraft.matches.forEach((matchDraft) => {
        if (matchDraft.slotA.kind === "manual") keys.add(matchDraft.slotA.key);
        if (matchDraft.slotB.kind === "manual") keys.add(matchDraft.slotB.key);
      });
    });
    return keys;
  }, [manualDraftStages]);

  const manualSelectedIds = useMemo(() => {
    if (!manualStage) return [];
    const ids: number[] = [];
    manualEditableSlotKeys.forEach((slotKey) => {
      const teamId = manualSlotValues[slotKey];
      if (typeof teamId === "number") {
        ids.push(teamId);
      }
    });
    return ids;
  }, [manualSlotValues, manualEditableSlotKeys, manualStage]);
  const manualSelectedIdSet = useMemo(
    () => new Set(manualSelectedIds),
    [manualSelectedIds]
  );
  const manualPreviewLabelBySlotKey = useMemo(() => {
    const labelForTeamId = (teamId: number) => {
      const team = teamsById.get(teamId);
      if (!team) return `Team #${teamId}`;
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${teamId}`;
    };

    const map = new Map<string, string>();
    Object.entries(manualSlotValues).forEach(([slotKey, teamId]) => {
      if (typeof teamId === "number") {
        map.set(slotKey, labelForTeamId(teamId));
      }
    });

    return map;
  }, [manualSlotValues, teamsById]);
  const playoffSeedLabelByMatchId = useMemo(() => {
    const map = new Map<number, SeedLabel>();
    if (activeStages.length === 0) return map;

    activeStages.forEach((stage, stageIdx) => {
      const stageMatchesRaw = [...(matchesByStage.get(stage) ?? [])].sort(
        (a, b) => a.id - b.id
      );
      const nextStageForOrdering =
        stageIdx < activeStages.length - 1 ? activeStages[stageIdx + 1] : null;
      const nextStageMatchCountForOrdering = nextStageForOrdering
        ? Math.max(1, Math.floor(STAGE_TEAM_COUNTS[nextStageForOrdering] / 2))
        : 0;
      const winnerSlotByCurrentStageMatchIdx =
        nextStageMatchCountForOrdering > 0
          ? assignWinnerSlotIndexes(
              stageMatchesRaw.length,
              nextStageMatchCountForOrdering
            )
          : new Map<number, number>();
      const destinationByCurrentStageMatchIdx = new Map<number, number>();
      winnerSlotByCurrentStageMatchIdx.forEach((winnerIdx, slotIdx) => {
        destinationByCurrentStageMatchIdx.set(winnerIdx, Math.floor(slotIdx / 2));
      });
      const stageMatches = stageMatchesRaw
        .map((stageMatch, idx) => ({
          stageMatch,
          idx,
          destination: destinationByCurrentStageMatchIdx.get(idx) ?? idx,
        }))
        .sort((a, b) => a.destination - b.destination || a.idx - b.idx)
        .map((item) => item.stageMatch);

      const defaultSeedLabels = defaultSeedLabelsByStage.get(stage) ?? [];
      const prevStage = stageIdx > 0 ? activeStages[stageIdx - 1] : null;
      const prevStageMatches = prevStage
        ? [...(matchesByStage.get(prevStage) ?? [])].sort((a, b) => a.id - b.id)
        : [];
      const expectedMatches = Math.max(
        stageMatches.length,
        prevStage ? Math.ceil(prevStageMatches.length / 2) : stageMatches.length
      );

      const winnerBySlotIndex = new Map<number, number>();
      if (prevStage) {
        const winnerSlotIndexes = assignWinnerSlotIndexes(
          prevStageMatches.length,
          expectedMatches
        );
        winnerSlotIndexes.forEach((winnerIdx, slotIdx) => {
          const winnerTeamId = prevStageMatches[winnerIdx]?.winner_team_id ?? null;
          if (winnerTeamId) {
            winnerBySlotIndex.set(slotIdx, winnerTeamId);
          }
        });
      }

      const seededPlaceholders = Array.from({ length: expectedMatches }, (_, idx) => {
        const manualSeedA = manualPreviewLabelBySlotKey.get(
          manualSlotKey(stage, idx, "a")
        );
        const manualSeedB = manualPreviewLabelBySlotKey.get(
          manualSlotKey(stage, idx, "b")
        );

        if (!prevStage) {
          const defaultSeed = defaultSeedLabels[idx];
          return {
            seedA: manualSeedA ?? defaultSeed?.seedA ?? "Por definir",
            seedB: manualSeedB ?? defaultSeed?.seedB ?? "Por definir",
          };
        }

        const slotA = idx * 2;
        const slotB = idx * 2 + 1;
        const mappedWinnerA = winnerBySlotIndex.get(slotA) ?? null;
        const mappedWinnerB = winnerBySlotIndex.get(slotB) ?? null;
        return {
          seedA:
            manualSeedA ?? (mappedWinnerA ? getTeamLabel(mappedWinnerA) : "Por definir"),
          seedB:
            manualSeedB ?? (mappedWinnerB ? getTeamLabel(mappedWinnerB) : "Por definir"),
        };
      });

      stageMatches.forEach((match, idx) => {
        const seed = seededPlaceholders[idx];
        if (seed) map.set(match.id, seed);
      });
    });

    return map;
  }, [activeStages, defaultSeedLabelsByStage, manualPreviewLabelBySlotKey, matchesByStage]);

  const loadManualSeeds = useCallback(async () => {
    if (!Number.isFinite(tournamentId)) return;
    if (categoryFilter === "all" || genderFilter === "all") {
      setManualSlotValues({});
      return;
    }

    try {
      const seeds = await api<PlayoffManualSeed[]>(
        `/tournaments/${tournamentId}/playoff-manual-seeds?category=${encodeURIComponent(categoryFilter)}&gender=${encodeURIComponent(genderFilter)}`
      );
      const next: Record<string, number | ""> = {};
      seeds.forEach((seed) => {
        next[manualSlotKey(seed.stage, seed.match_index, seed.side)] = seed.team_id;
      });
      setManualSlotValues(next);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setManualSlotValues({});
    }
  }, [router, tournamentId, categoryFilter, genderFilter]);

  const persistManualSeeds = useCallback(
    async (slotValues: Record<string, number | "">) => {
      if (categoryFilter === "all" || genderFilter === "all") return;

      const seeds: PlayoffManualSeedsUpsertRequest["seeds"] = [];
      Object.entries(slotValues).forEach(([slotKey, teamId]) => {
        if (typeof teamId !== "number") return;
        const parsed = parseManualSlotKey(slotKey);
        if (!parsed) return;
        seeds.push({
          stage: parsed.stage,
          match_index: parsed.matchIndex,
          side: parsed.side,
          team_id: teamId,
        });
      });

      await api<PlayoffManualSeed[]>(`/tournaments/${tournamentId}/playoff-manual-seeds`, {
        method: "PUT",
        body: {
          seeds,
          category: categoryFilter,
          gender: genderFilter,
        } satisfies PlayoffManualSeedsUpsertRequest,
      });
    },
    [tournamentId, categoryFilter, genderFilter]
  );

  const loadPlayoffs = useCallback(async () => {
    if (!Number.isFinite(tournamentId)) return;
    setLoading(true);
    setError(null);

    try {
      const [tournamentRes, matchesRes, teamsRes, groupsRes, statusRes] = await Promise.all([
        api<Tournament>(`/public/tournaments/${tournamentId}`, { auth: false }),
        api<Match[]>(`/tournaments/${tournamentId}/matches`),
        api<Team[]>(`/tournaments/${tournamentId}/teams`),
        api<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`),
        api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      ]);

      setTournamentMatchDurationMinutes(
        Math.max(1, tournamentRes.match_duration_minutes ?? DEFAULT_MATCH_DURATION_MINUTES)
      );
      setCompetitionType((tournamentRes.competition_type ?? "tournament") as CompetitionType);
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
    loadManualSeeds();
  }, [loadManualSeeds]);

  useEffect(() => {
    if (hasDefaultedFilters.current) return;
    if (categories.length === 0 && genders.length === 0) return;

    if (categoryFilter === "all" && categories.length > 0) {
      setCategoryFilter(categories[0]);
    }
    if (genderFilter === "all" && genders.length > 0) {
      setGenderFilter(genders[0]);
    }

    if (
      (categoryFilter === "all" && categories.length > 0)
      || (genderFilter === "all" && genders.length > 0)
    ) {
      hasDefaultedFilters.current = true;
    }
  }, [categories, genders, categoryFilter, genderFilter]);
  useEffect(() => {
    if (!hasPlayoffs) return;
    setManualStage(null);
    setManualError(null);
    setManualStageOpen(false);
  }, [hasPlayoffs]);

  function getTeamLabel(teamId?: number | null) {
    if (typeof teamId !== "number") return "Por definir";
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;

    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }
  function getMatchTeamLabel(match: Match, side: "a" | "b") {
    const teamId = side === "a" ? match.team_a_id : match.team_b_id;
    if (typeof teamId === "number") return getTeamLabel(teamId);
    if (match.stage === "group") return "Por definir";
    const seedLabel = playoffSeedLabelByMatchId.get(match.id);
    if (!seedLabel) return "Por definir";
    return side === "a" ? seedLabel.seedA : seedLabel.seedB;
  }
  function getTeamLabelWithGroupRank(teamId: number) {
    const ranking = groupRankingByTeam.get(teamId);
    const overallRank = overallRankingByTeam.get(teamId);
    if (!ranking) {
      if (overallRank) return `${getTeamLabel(teamId)} (${overallRank}° gral)`;
      return getTeamLabel(teamId);
    }
    if (!overallRank) {
      return `${getTeamLabel(teamId)} (${ranking.position}° ${ranking.groupName})`;
    }
    return `${getTeamLabel(teamId)} (${overallRank}° gral · ${ranking.position}° ${ranking.groupName})`;
  }
  function hasDefinedTeams(match: Match): match is Match & { team_a_id: number; team_b_id: number } {
    return typeof match.team_a_id === "number" && typeof match.team_b_id === "number";
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

  async function openResultModal(match: Match) {
    let modalMatch = match;
    if (
      isFlashCompetition
      && match.status !== "played"
      && hasDefinedTeams(match)
    ) {
      try {
        const autoAssigned = await api<Match>(`/matches/${match.id}/auto-assign-court`, {
          method: "POST",
          body: {},
        });
        modalMatch = autoAssigned;
        setMatches((prev) =>
          prev.map((item) => (item.id === autoAssigned.id ? autoAssigned : item))
        );
      } catch (err: unknown) {
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
  function formatShortDate(value?: string | null) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year.slice(-2)}`;
  }
  function formatSchedule(date?: string | null, time?: string | null) {
    const dateLabel = formatShortDate(date);
    const timeLabel = normalizeTime(time);
    if (dateLabel && timeLabel) return `${dateLabel} - ${timeLabel}`;
    return dateLabel || timeLabel || "";
  }
  function formatSetLine(sets: Match["sets"], side: "a" | "b") {
    if (!sets || sets.length === 0) return "";
    return sets.map((set) => String(set[side] ?? "")).join("  ");
  }

  function openScheduleModal(match: Match) {
    setScheduleMatch(match);
    setScheduleDate(match.scheduled_date ?? "");
    const normalized = normalizeTime(match.scheduled_time);
    const [hour = "", minute = ""] = normalized.split(":");
    setScheduleHour(hour);
    setScheduleMinute(MINUTES.includes(minute) ? minute : "");
    setScheduleCourt(match.court_number ? String(match.court_number) : "1");
    setScheduleError(null);
  }

  function closeScheduleModal() {
    setScheduleMatch(null);
    setScheduleHour("");
    setScheduleMinute("");
    setScheduleError(null);
  }

  function formatClockFromMinutes(totalMinutes: number) {
    const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
    const minute = String(normalized % 60).padStart(2, "0");
    return `${hour}:${minute}`;
  }

  function formatBulkDateLabel(value: string) {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value || "Sin fecha";
    return `${day}/${month}/${year}`;
  }

  function formatBulkCourtRange(firstCourtValue: string, courtsCountValue: string) {
    const firstCourt = Number(firstCourtValue);
    const courtsCount = Number(courtsCountValue);
    if (!Number.isFinite(firstCourt) || firstCourt <= 0) return "—";
    if (!Number.isFinite(courtsCount) || courtsCount <= 1) return String(firstCourt);
    return `${firstCourt} a ${firstCourt + courtsCount - 1}`;
  }

  function clearBulkFieldErrors(keys: string[]) {
    setBulkScheduleFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;
      keys.forEach((key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }

  function updateBulkStageGapMinutes(value: string) {
    setBulkStageGapMinutes(value);
    clearBulkFieldErrors(["base.gapMinutes"]);
  }

  const buildBulkSchedulePlan = useCallback((): BulkSchedulePlanResult => {
    const errors: Record<string, string> = {};
    const tasks: BulkScheduleTask[] = [];
    const summaries: BulkScheduleStageSummary[] = [];
    const durationMinutes = Math.max(1, tournamentMatchDurationMinutes || DEFAULT_MATCH_DURATION_MINUTES);
    const stageGapMinutes = Number(bulkStageGapMinutes);
    if (!Number.isFinite(stageGapMinutes) || stageGapMinutes < 0) {
      errors["base.gapMinutes"] = "Ingresá un descanso válido (0 o mayor).";
    }

    const selectedStages = schedulablePlayoffStages.filter(
      ({ stage }) => bulkScheduleByStage[stage].enabled
    );
    if (selectedStages.length === 0) {
      errors.stages = "Selecciona al menos una instancia para programar.";
    }

    const parseConfig = (
      config: BulkScheduleBaseConfig,
      prefix: string
    ): {
      date: string;
      hour: string;
      minute: string;
      firstCourt: number;
      courtsCount: number;
      startMinutes: number;
    } | null => {
      let hasError = false;
      if (!config.date) {
        errors[`${prefix}.date`] = "Selecciona una fecha.";
        hasError = true;
      }
      if (!config.hour) {
        errors[`${prefix}.hour`] = "Selecciona una hora.";
        hasError = true;
      }
      if (!BULK_MINUTE_OPTIONS.includes(config.minute)) {
        errors[`${prefix}.minute`] = "Elige un minuto valido.";
        hasError = true;
      }
      const firstCourt = Number(config.firstCourt);
      if (!Number.isFinite(firstCourt) || firstCourt <= 0) {
        errors[`${prefix}.firstCourt`] = "Ingresá una cancha inicial válida.";
        hasError = true;
      }
      const courtsCount = Number(config.courtsCount);
      if (!Number.isFinite(courtsCount) || courtsCount <= 0) {
        errors[`${prefix}.courtsCount`] = "Ingresá la cantidad de canchas.";
        hasError = true;
      }

      const startMinutes = Number(config.hour) * 60 + Number(config.minute);
      if (!Number.isFinite(startMinutes) || startMinutes < 0 || startMinutes >= 24 * 60) {
        errors[`${prefix}.hour`] = "La hora no es válida.";
        hasError = true;
      }

      if (hasError) return null;
      return {
        date: config.date,
        hour: config.hour,
        minute: config.minute,
        firstCourt,
        courtsCount,
        startMinutes,
      };
    };

    type OccupiedInterval = { start: number; end: number };
    const intervalsByDateCourt = new Map<string, Map<number, OccupiedInterval[]>>();
    const addOccupiedInterval = (date: string, court: number, start: number, end: number) => {
      if (!intervalsByDateCourt.has(date)) intervalsByDateCourt.set(date, new Map());
      const byCourt = intervalsByDateCourt.get(date)!;
      if (!byCourt.has(court)) byCourt.set(court, []);
      byCourt.get(court)!.push({ start, end });
    };
    const getCourtIntervals = (date: string, court: number): OccupiedInterval[] =>
      intervalsByDateCourt.get(date)?.get(court) ?? [];
    const hasCourtOverlap = (date: string, court: number, start: number, end: number) =>
      getCourtIntervals(date, court).some(
        (interval) => start < interval.end && end > interval.start
      );
    const parseTimeToMinutes = (value?: string | null): number | null => {
      if (!value) return null;
      const normalized = normalizeTime(value);
      const [hoursRaw, minutesRaw] = normalized.split(":");
      if (!hoursRaw || !minutesRaw) return null;
      const hours = Number(hoursRaw);
      const minutes = Number(minutesRaw);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      return hours * 60 + minutes;
    };

    const selectedMatchIds = new Set<number>();
    selectedStages.forEach(({ matches: stageMatches }) => {
      stageMatches.forEach((match) => selectedMatchIds.add(match.id));
    });
    matches.forEach((existingMatch) => {
      if (selectedMatchIds.has(existingMatch.id)) return;
      if (!existingMatch.scheduled_date || !existingMatch.scheduled_time) return;
      if (!existingMatch.court_number || existingMatch.court_number <= 0) return;
      const start = parseTimeToMinutes(existingMatch.scheduled_time);
      if (start === null) return;
      const end = start + durationMinutes;
      if (end > 24 * 60) return;
      addOccupiedInterval(
        existingMatch.scheduled_date,
        existingMatch.court_number,
        start,
        end
      );
    });

    const stageEndByDate = new Map<string, number>();

    selectedStages.forEach(({ stage, matches: stageMatches }) => {
      const config = bulkScheduleByStage[stage];
      const useGlobal = config.useGlobal;
      const sourceConfig = useGlobal ? bulkScheduleBaseConfig : config;
      const configPrefix = useGlobal ? "base" : `stage.${stage}`;
      const parsed = parseConfig(sourceConfig, configPrefix);
      if (!parsed) {
        errors[`stage.${stage}.__stage`] = "Completa la configuracion de esta instancia.";
        return;
      }

      const previousStageEnd = stageEndByDate.get(parsed.date);
      const adjustedStartMinutes =
        previousStageEnd !== undefined && Number.isFinite(stageGapMinutes)
          ? Math.max(parsed.startMinutes, previousStageEnd + stageGapMinutes)
          : parsed.startMinutes;
      const availableCourts = Array.from(
        { length: parsed.courtsCount },
        (_, idx) => parsed.firstCourt + idx
      );
      const stageSlotStarts: number[] = [];
      let cursor = adjustedStartMinutes;
      let matchIndex = 0;

      while (matchIndex < stageMatches.length) {
        const slotEnd = cursor + durationMinutes;
        if (slotEnd > 24 * 60) {
          errors[`stage.${stage}.__stage`] =
            "No hay slots libres suficientes: las canchas pueden estar ocupadas por otras categorías/géneros. Adelantá la hora, usá más canchas o canchas distintas.";
          if (!useGlobal) {
            errors[`stage.${stage}.hour`] = "No hay tiempo suficiente antes de las 00:00 con esta hora de inicio.";
          } else {
            errors["base.hour"] = "Alguna categoría/género no tiene canchas disponibles a tiempo. Verificá que no estén ocupadas por otras ya programadas.";
          }
          return;
        }

        const freeCourts = availableCourts.filter(
          (court) => !hasCourtOverlap(parsed.date, court, cursor, slotEnd)
        );

        if (freeCourts.length === 0) {
          const blockingEnds: number[] = [];
          availableCourts.forEach((court) => {
            getCourtIntervals(parsed.date, court).forEach((interval) => {
              if (cursor < interval.end && slotEnd > interval.start) {
                blockingEnds.push(interval.end);
              }
            });
          });
          if (blockingEnds.length === 0) {
            cursor += 1;
          } else {
            const nextCursor = Math.min(...blockingEnds);
            cursor = nextCursor > cursor ? nextCursor : cursor + 1;
          }
          continue;
        }

        stageSlotStarts.push(cursor);
        const assignCount = Math.min(freeCourts.length, stageMatches.length - matchIndex);
        for (let idx = 0; idx < assignCount; idx += 1) {
          const match = stageMatches[matchIndex];
          const courtNumber = freeCourts[idx];
          tasks.push({
            match,
            stage,
            scheduledDate: parsed.date,
            scheduledTime: formatClockFromMinutes(cursor),
            courtNumber,
          });
          addOccupiedInterval(parsed.date, courtNumber, cursor, slotEnd);
          matchIndex += 1;
        }
        cursor = slotEnd;
      }

      const firstSlotStart = stageSlotStarts[0] ?? adjustedStartMinutes;
      const lastSlotStart = stageSlotStarts[stageSlotStarts.length - 1] ?? adjustedStartMinutes;
      const stageEndMinutes = lastSlotStart + durationMinutes;
      const adjustedByMinutes = firstSlotStart - parsed.startMinutes;

      summaries.push({
        stage,
        matchCount: stageMatches.length,
        slotCount: stageSlotStarts.length,
        configuredStartTime: formatClockFromMinutes(parsed.startMinutes),
        firstTime: formatClockFromMinutes(firstSlotStart),
        lastTime: formatClockFromMinutes(lastSlotStart),
        firstCourt: parsed.firstCourt,
        lastCourt: parsed.firstCourt + parsed.courtsCount - 1,
        adjustedByMinutes,
      });
      stageEndByDate.set(parsed.date, stageEndMinutes);
    });

    return { errors, tasks, summaries };
  }, [
    matches,
    schedulablePlayoffStages,
    bulkScheduleByStage,
    bulkScheduleBaseConfig,
    bulkStageGapMinutes,
    tournamentMatchDurationMinutes,
  ]);

  function validateBulkSchedule() {
    const plan = buildBulkSchedulePlan();
    setBulkScheduleFieldErrors(plan.errors);
    return {
      ok: Object.keys(plan.errors).length === 0,
      plan,
    };
  }

  function openBulkScheduleModal() {
    const baseStartByStage: Record<PlayoffStage, string> = {
      round_of_32: "09",
      round_of_16: "11",
      quarter: "13",
      semi: "15",
      final: "17",
    };
    const next = createBulkScheduleConfigMap();
    const firstPendingStage = schedulablePlayoffStages[0];
    const suggestedHour = firstPendingStage ? baseStartByStage[firstPendingStage.stage] : "13";
    const suggestedCourts = firstPendingStage
      ? String(Math.max(1, Math.min(firstPendingStage.matches.length, 2)))
      : "1";

    schedulablePlayoffStages.forEach(({ stage, matches }) => {
      next[stage] = {
        enabled: true,
        useGlobal: true,
        date: defaultGridDate,
        hour: baseStartByStage[stage],
        minute: "00",
        firstCourt: "1",
        courtsCount: String(Math.max(1, Math.min(matches.length, 2))),
      };
    });
    setBulkScheduleByStage(next);
    setBulkScheduleBaseConfig({
      date: defaultGridDate,
      hour: suggestedHour,
      minute: "00",
      firstCourt: "1",
      courtsCount: suggestedCourts,
    });
    setBulkStageGapMinutes(DEFAULT_BULK_STAGE_GAP_MINUTES);
    setBulkScheduleFieldErrors({});
    setBulkScheduleError(null);
    setBulkScheduleMessage(null);
    setBulkScheduleSuccess(null);
    setBulkScheduleOpen(true);
  }

  function closeBulkScheduleModal() {
    setBulkScheduleOpen(false);
    setBulkScheduleFieldErrors({});
    setBulkScheduleError(null);
  }

  function updateBulkBaseConfig(patch: Partial<BulkScheduleBaseConfig>) {
    setBulkScheduleBaseConfig((prev) => ({
      ...prev,
      ...patch,
    }));

    const patchKeys = Object.keys(patch) as (keyof BulkScheduleBaseConfig)[];
    if (patchKeys.length === 0) return;
    const errorKeys = patchKeys.map((key) => `base.${key}`);
    schedulablePlayoffStages
      .filter(({ stage }) => bulkScheduleByStage[stage].enabled && bulkScheduleByStage[stage].useGlobal)
      .forEach(({ stage }) => errorKeys.push(`stage.${stage}.__stage`));
    clearBulkFieldErrors(errorKeys);
  }

  function updateBulkStageConfig(
    stage: PlayoffStage,
    patch: Partial<BulkScheduleStageConfig>
  ) {
    setBulkScheduleByStage((prev) => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        ...patch,
      },
    }));

    const patchKeys = Object.keys(patch);
    const errorKeys = patchKeys.map((key) => `stage.${stage}.${key}`);
    errorKeys.push(`stage.${stage}.__stage`, "stages");
    clearBulkFieldErrors(errorKeys);
  }

  async function saveBulkSchedule() {
    const validation = validateBulkSchedule();
    if (!validation.ok) {
      return;
    }
    const tasks = validation.plan.tasks;
    if (tasks.length === 0) {
      setBulkScheduleError("No hay partidos pendientes para programar.");
      return;
    }

    setBulkScheduling(true);
    setBulkScheduleError(null);
    setBulkScheduleMessage(null);

    try {
      let okCount = 0;
      const failures: string[] = [];
      const retryQueue: BulkScheduleTask[] = [];
      const scheduleTask = async (task: BulkScheduleTask) => {
        try {
          await api(`/matches/${task.match.id}/schedule`, {
            method: "POST",
            body: {
              scheduled_date: task.scheduledDate,
              scheduled_time: task.scheduledTime,
              court_number: task.courtNumber,
            },
          });
          return null;
        } catch (err: unknown) {
          if (err instanceof ApiError) return err.message;
          if (err instanceof Error) return err.message;
          return "No se pudo programar";
        }
      };
      const isCourtBusyError = (message: string) => {
        const lower = message.toLowerCase();
        return (
          lower.includes("cancha ya esta ocupada")
          || lower.includes("cancha ya está ocupada")
          || lower.includes("ocupada en ese horario")
        );
      };

      for (const task of tasks) {
        const errorMessage = await scheduleTask(task);
        if (!errorMessage) {
          okCount += 1;
          continue;
        }
        if (isCourtBusyError(errorMessage)) {
          retryQueue.push(task);
          continue;
        }
        failures.push(`${STAGE_LABELS[task.stage]} · Partido ${getMatchCode(task.match)}: ${errorMessage}`);
      }

      for (const task of retryQueue) {
        const errorMessage = await scheduleTask(task);
        if (!errorMessage) {
          okCount += 1;
          continue;
        }
        failures.push(`${STAGE_LABELS[task.stage]} · Partido ${getMatchCode(task.match)}: ${errorMessage}`);
      }

      await reloadMatches();

      if (failures.length > 0) {
        setBulkScheduleError(
          `Se programaron ${okCount} de ${tasks.length} partidos. ${failures[0]}${
            failures.length > 1 ? ` (y ${failures.length - 1} error(es) mas)` : ""
          }`
        );
        return;
      }

      setBulkScheduleMessage(`Se programaron ${okCount} partidos de llaves.`);
      setBulkScheduleSuccess({
        scheduledCount: okCount,
        totalCount: tasks.length,
        firstMatchId: tasks[0]?.match.id ?? null,
      });
      closeBulkScheduleModal();
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "No se pudo completar la programacion masiva";
      setBulkScheduleError(message);
    } finally {
      setBulkScheduling(false);
    }
  }

  const bulkSchedulePlanPreview = useMemo(() => buildBulkSchedulePlan(), [buildBulkSchedulePlan]);
  const bulkSummaryByStage = useMemo(() => {
    const map = new Map<PlayoffStage, BulkScheduleStageSummary>();
    bulkSchedulePlanPreview.summaries.forEach((summary) => {
      map.set(summary.stage, summary);
    });
    return map;
  }, [bulkSchedulePlanPreview]);
  const enabledBulkStages = useMemo(
    () => schedulablePlayoffStages.filter(({ stage }) => bulkScheduleByStage[stage].enabled),
    [schedulablePlayoffStages, bulkScheduleByStage]
  );

  async function saveSchedule() {
    if (!scheduleMatch) return;

    const courtNumber = Number(scheduleCourt);
    if (!Number.isFinite(courtNumber) || courtNumber <= 0) {
      setScheduleError("La cancha debe ser un numero valido.");
      return;
    }

    if (!isFlashCompetition) {
      if (!scheduleDate || !scheduleHour || !scheduleMinute) {
        setScheduleError("Selecciona fecha y horario.");
        return;
      }

      if (!MINUTES.includes(scheduleMinute)) {
        setScheduleError("Selecciona minutos validos (00-59).");
        return;
      }
    }

    setScheduling(true);
    setScheduleError(null);

    try {
      if (isFlashCompetition) {
        await api(`/matches/${scheduleMatch.id}/assign-court`, {
          method: "POST",
          body: {
            court_number: courtNumber,
          },
        });
      } else {
        const scheduleTime = `${scheduleHour}:${scheduleMinute}`;
        await api(`/matches/${scheduleMatch.id}/schedule`, {
          method: "POST",
          body: {
            scheduled_date: scheduleDate,
            scheduled_time: scheduleTime,
            court_number: courtNumber,
          },
        });
      }
      await reloadMatches();
      closeScheduleModal();
    } catch (err: any) {
      setScheduleError(
        err?.message
          ?? (isFlashCompetition
            ? "No se pudo asignar la cancha"
            : "No se pudo programar el partido")
      );
    } finally {
      setScheduling(false);
    }
  }

  function buildPayloadSets(): MatchSet[] | null {
    const isFlash = isFlashCompetition;
    const filtered = setsInput.filter(
      (setScore) => setScore.a !== "" || setScore.b !== ""
    );

    if (isFlash) {
      if (filtered.length !== 1) {
        setFormError("En relampago tenes que cargar exactamente 1 set.");
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
    setManualStage(stage);
    setManualInitialTeamCount(STAGE_TEAM_COUNTS[stage]);
    setManualError(null);
    setManualStageOpen(false);
    setManualStageCandidate("");
  }

  function updateManualSlotValue(slotKey: string, value: string) {
    const parsed = value === "" ? "" : Number(value);
    setManualSlotValues((prev) => ({
      ...prev,
      [slotKey]: parsed,
    }));
    setManualError(null);
  }

  function getWinnerTeamFromSlot(slot: ManualSlot): number | "" {
    if (slot.kind !== "winner" || !slot.sourceStage) return "";
    const winnerIdx = slot.sourceMatchIndex ?? -1;
    return winnerByStageIndex.get(slot.sourceStage)?.get(winnerIdx) ?? "";
  }

  function getManualSlotValue(slot: ManualSlot): number | "" {
    if (slot.kind === "winner") return getWinnerTeamFromSlot(slot);
    return manualSlotValues[slot.key] ?? "";
  }

  function getManualSlotPlaceholder(slot: ManualSlot): string {
    if (slot.kind !== "winner") return "Seleccionar pareja";
    if (!slot.sourceStage) return "Ganador partido previo";
    const sourceMatch = (slot.sourceMatchIndex ?? 0) + 1;
    return `Ganador ${STAGE_LABELS[slot.sourceStage]} · Partido ${sourceMatch}`;
  }

  function getManualWinnerSlotLabel(slot: ManualSlot): string {
    const winnerTeamId = getWinnerTeamFromSlot(slot);
    if (typeof winnerTeamId === "number") {
      return getTeamLabelWithGroupRank(winnerTeamId);
    }
    return getManualSlotPlaceholder(slot);
  }

  function validateManualBracket() {
    if (!manualStage) return "Selecciona una instancia para armar.";
    if (categoryFilter === "all" || genderFilter === "all") {
      return "Selecciona categoria y genero antes de generar playoffs.";
    }
    return null;
  }

  async function submitManualPairs() {
    if (!manualStage) return;

    const validation = validateManualBracket();
    if (validation) {
      setManualError(validation);
      return;
    }

    const stagePayloads: Array<{
      stage: PlayoffStage;
      manual_pairs: { team_a_id: number; team_b_id: number }[];
    }> = [];
    const generatedSlotKeys = new Set<string>();

    for (const stageDraft of manualDraftStages) {
      const existingStageMatches = matchesByStage.get(stageDraft.stage) ?? [];
      const occupiedTeamIds = new Set<number>();
      const existingPairs = new Set<string>();

      existingStageMatches.forEach((match) => {
        if (!hasDefinedTeams(match)) return;
        occupiedTeamIds.add(match.team_a_id);
        occupiedTeamIds.add(match.team_b_id);
        const key = [match.team_a_id, match.team_b_id].sort((a, b) => a - b).join("-");
        existingPairs.add(key);
      });

      const pairsForStage: { team_a_id: number; team_b_id: number }[] = [];

      for (const matchDraft of stageDraft.matches) {
        const teamA = getManualSlotValue(matchDraft.slotA);
        const teamB = getManualSlotValue(matchDraft.slotB);
        const editableSides =
          Number(matchDraft.slotA.kind === "manual")
          + Number(matchDraft.slotB.kind === "manual");
        const hasTeamA = typeof teamA === "number";
        const hasTeamB = typeof teamB === "number";

        if (editableSides === 0) {
          continue;
        }

        if (!hasTeamA && !hasTeamB) {
          continue;
        }

        if (!hasTeamA || !hasTeamB) {
          if (editableSides === 2) {
            setManualError(
              `${STAGE_LABELS[stageDraft.stage]} · Partido ${matchDraft.matchIndex + 1}: completa ambos equipos o deja el partido vacio.`
            );
            return;
          }
          continue;
        }

        if (teamA === teamB) {
          setManualError(
            `${STAGE_LABELS[stageDraft.stage]} · Partido ${matchDraft.matchIndex + 1}: no podes enfrentar la misma pareja.`
          );
          return;
        }

        if (occupiedTeamIds.has(teamA) || occupiedTeamIds.has(teamB)) {
          setManualError(
            `${STAGE_LABELS[stageDraft.stage]}: una de las parejas ya tiene partido en esta instancia.`
          );
          return;
        }

        const pairKey = [teamA, teamB].sort((a, b) => a - b).join("-");
        if (existingPairs.has(pairKey)) {
          setManualError(
            `${STAGE_LABELS[stageDraft.stage]}: el cruce ${getTeamLabel(teamA)} vs ${getTeamLabel(teamB)} ya existe.`
          );
          return;
        }

        existingPairs.add(pairKey);
        occupiedTeamIds.add(teamA);
        occupiedTeamIds.add(teamB);
        if (matchDraft.slotA.kind === "manual") generatedSlotKeys.add(matchDraft.slotA.key);
        if (matchDraft.slotB.kind === "manual") generatedSlotKeys.add(matchDraft.slotB.key);
        pairsForStage.push({ team_a_id: teamA, team_b_id: teamB });
      }

      if (pairsForStage.length > 0) {
        stagePayloads.push({
          stage: stageDraft.stage,
          manual_pairs: pairsForStage,
        });
      }
    }

    setGenerating(true);
    setManualError(null);

    let runningStage: PlayoffStage | null = null;
    const createdAll: Match[] = [];

    try {
      if (stagePayloads.length === 0) {
        await persistManualSeeds(manualSlotValues);
        setManualError(null);
        return;
      }

      for (const stagePayload of stagePayloads) {
        runningStage = stagePayload.stage;
        const payload: PlayoffGenerateRequest = {
          stage: stagePayload.stage,
          manual_pairs: stagePayload.manual_pairs,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          gender: genderFilter === "all" ? undefined : genderFilter,
        };
        const created = await api<Match[]>(`/tournaments/${tournamentId}/generate-playoffs`, {
          method: "POST",
          body: payload,
        });
        createdAll.push(...created);
      }

      if (createdAll.length > 0) {
        setMatches((prev) => [...prev, ...createdAll]);
      }
      const remainingSlotValues: Record<string, number | ""> = { ...manualSlotValues };
      generatedSlotKeys.forEach((key) => {
        delete remainingSlotValues[key];
      });
      await persistManualSeeds(remainingSlotValues);
      setManualSlotValues(remainingSlotValues);
      setManualError(null);
    } catch (err: any) {
      await reloadMatches();
      const stageLabel = runningStage
        ? STAGE_LABELS[runningStage]
        : stagePayloads.length === 0
        ? "guardado de semillas"
        : "la instancia seleccionada";
      setManualError(
        `${stageLabel}: ${err?.message ?? "No se pudieron generar los cruces"}`
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate(stage: PlayoffStage, autoMode: PlayoffAutoMode) {
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
        auto_mode: autoMode,
        category: categoryFilter,
        gender: genderFilter,
      };
      const created = await api<Match[]>(`/tournaments/${tournamentId}/generate-playoffs`, {
        method: "POST",
        body: payload,
      });
      setMatches((prev) => [...prev, ...created]);
      setConfirmStage(null);
      setConfirmAutoMode(DEFAULT_AUTO_MODE);
    } catch (err: any) {
      setActionError(err?.message ?? "No se pudieron generar los cruces");
    } finally {
      setGenerating(false);
    }
  }

  async function handleResetPlayoffs() {
    setResettingPlayoffs(true);
    setResetPlayoffsError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (genderFilter !== "all") params.set("gender", genderFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      await api(`/tournaments/${tournamentId}/reset-playoffs${query}`, { method: "DELETE" });
      setMatches((prev) => prev.filter((m) => m.stage === "group"));
      setStatus("groups_finished");
      setResetPlayoffsOpen(false);
    } catch (err: any) {
      setResetPlayoffsError(err?.message ?? "No se pudieron eliminar los playoffs.");
    } finally {
      setResettingPlayoffs(false);
    }
  }

  const canEdit = status === "ongoing" || status === "groups_finished";
  const isFlashCompetition = competitionType === "flash";
  const confirmStageAutoOptions = useMemo(() => {
    if (!confirmStage) return [];
    return autoModeOptionsByStage.get(confirmStage) ?? [];
  }, [confirmStage, autoModeOptionsByStage]);
  useEffect(() => {
    if (!confirmStage) return;
    const enabledOptions = confirmStageAutoOptions.filter((option) => option.enabled);
    if (enabledOptions.length === 0) {
      setConfirmAutoMode(DEFAULT_AUTO_MODE);
      return;
    }
    if (
      !enabledOptions.some((option) => option.mode === confirmAutoMode)
    ) {
      setConfirmAutoMode(enabledOptions[0].mode);
    }
  }, [confirmStage, confirmAutoMode, confirmStageAutoOptions]);
  useEffect(() => {
    if (hasPlayoffs && actionError) {
      setActionError(null);
    }
  }, [hasPlayoffs, actionError]);
  const showPlayoffSetupCard =
    !hasPlayoffs ||
    pendingPlayoffStages.length > 0 ||
    !!bulkScheduleMessage ||
    (!hasPlayoffs && !!actionError) ||
    (hasPlayoffs && canEdit);
  const hasPlayoffBracket = PLAYOFF_STAGES.some(
    (stage) => (matchesByStage.get(stage) ?? []).length > 0
  );
  const hasActivePlayoffFilters = categoryFilter !== "all" || genderFilter !== "all";
  const playoffFiltersToolbar = (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Filtros
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {categories.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Categoria</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-40"
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value === "all" ? "all" : e.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {genders.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Genero</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm sm:w-40"
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
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            onClick={() => setGridOpen(true)}
            className="w-full sm:w-auto"
          >
            Grilla de partidos
          </Button>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("all");
              setGenderFilter("all");
            }}
            disabled={!hasActivePlayoffFilters}
            className="text-xs font-semibold text-zinc-600 underline decoration-dotted hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );

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
              onClick={() => router.push(`/tournaments/${tournamentId}/matches`)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Partidos
            </button>
            <button
              type="button"
              aria-current="page"
              disabled
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
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

          {showPlayoffSetupCard && (
            <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                {playoffFiltersToolbar}
                {!hasPlayoffs && (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-semibold text-zinc-800">Instancias disponibles (automatico)</div>
                      {availableStages.length === 0 ? (
                        <div className="text-sm text-zinc-600">
                          {!groupStageComplete && !latestStage
                            ? isFlashCompetition
                              ? "Podes crear el cuadro vacio para asignar canchas sobre la marcha. Las parejas se completan cuando terminen grupos."
                              : "Podes crear el cuadro vacio para programar horarios. Las parejas se completan cuando terminen grupos."
                            : latestStage && !canGenerateNextStage
                            ? `Completa los resultados de ${STAGE_LABELS[latestStage]} para avanzar.`
                            : "No hay instancias disponibles para generar ahora."}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availableStages.map((stage) => (
                            <Button
                              key={stage}
                              onClick={() => {
                                const options = autoModeOptionsByStage.get(stage) ?? [];
                                const firstEnabled = options.find((option) => option.enabled);
                                setConfirmAutoMode(firstEnabled?.mode ?? DEFAULT_AUTO_MODE);
                                setConfirmStage(stage);
                              }}
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
                  </>
                )}

                {bulkScheduleMessage && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-800">
                    {bulkScheduleMessage}
                  </div>
                )}

                {!isFlashCompetition && hasPlayoffs && schedulablePlayoffStages.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={openBulkScheduleModal}
                      disabled={generating || bulkScheduling}
                    >
                      Programar horarios de llaves
                    </Button>
                    <div className="text-xs text-zinc-500">
                      Carga en bloque 8vos, cuartos, semis y final.
                    </div>
                  </div>
                )}

                {hasPlayoffs && canEdit && (
                  <div className="flex items-center gap-3 border-t border-zinc-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setResetPlayoffsError(null);
                        setResetPlayoffsOpen(true);
                      }}
                      disabled={generating || bulkScheduling || resettingPlayoffs}
                      className="text-xs text-red-500 hover:text-red-700 underline decoration-dotted disabled:opacity-40"
                    >
                      Regenerar playoffs
                    </button>
                    <span className="text-xs text-zinc-400">Elimina las llaves actuales y vuelve al estado de grupos terminados.</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {!hasPlayoffs && (
            <Card className="bg-white/95">
                <div className="p-6 space-y-4">
                  <div className="text-sm font-semibold text-zinc-800">Armado manual por instancia</div>
                  <div className="text-xs text-zinc-500">
                    {isFlashCompetition
                      ? "Podes armar playoffs sin resultados de grupos y asignar canchas sin horarios."
                      : "Podes armar y programar playoffs aun sin resultados de grupos."}
                  </div>

                  {manualStageOptions.length === 0 ? (
                    <div className="text-sm text-zinc-600">
                      No hay instancias habilitadas para armar manualmente.
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
                      <div className="text-xs text-zinc-500">
                        Arma el cuadro completo desde esta instancia. Los cupos marcados como
                        ganador se completan cuando exista ese resultado.
                      </div>
                      {manualInitialTeamOptions.length > 0 && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs font-semibold text-zinc-500">
                            Parejas que juegan {STAGE_LABELS[manualStage]}
                          </label>
                          <select
                            className="rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                            value={manualInitialTeamCount}
                            onChange={(e) => setManualInitialTeamCount(Number(e.target.value))}
                          >
                            {manualInitialTeamOptions.map((count) => (
                              <option key={count} value={count}>
                                {count}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-3">
                        {manualDraftStages.map((stageDraft) => (
                          <div
                            key={stageDraft.stage}
                            className="rounded-2xl border border-zinc-200 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
                                {STAGE_LABELS[stageDraft.stage]}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {stageDraft.matches.length} partidos
                              </div>
                            </div>
                            {stageDraft.matches.map((matchDraft) => {
                              const teamA = getManualSlotValue(matchDraft.slotA);
                              const teamB = getManualSlotValue(matchDraft.slotB);
                              return (
                                <div
                                  key={`${stageDraft.stage}-${matchDraft.matchIndex}`}
                                  className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 text-sm md:flex-row md:items-center"
                                >
                                  <div className="w-24 text-xs font-semibold text-zinc-500">
                                    Partido {matchDraft.matchIndex + 1}
                                  </div>

                                  {matchDraft.slotA.kind === "manual" ? (
                                    <select
                                      className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 md:w-[28rem]"
                                      value={teamA}
                                      onChange={(e) =>
                                        updateManualSlotValue(matchDraft.slotA.key, e.target.value)
                                      }
                                    >
                                      <option value="">Seleccionar pareja</option>
                                      {sortedTeams.map((team) => {
                                        const disabled =
                                          manualSelectedIdSet.has(team.id) && team.id !== teamA;
                                        return (
                                          <option key={team.id} value={team.id} disabled={disabled}>
                                            {getTeamLabelWithGroupRank(team.id)}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : (
                                    <div
                                      className={`w-full rounded-xl px-3 py-2 text-xs font-semibold md:w-[28rem] ${
                                        typeof getManualSlotValue(matchDraft.slotA) === "number"
                                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500"
                                      }`}
                                    >
                                      {getManualWinnerSlotLabel(matchDraft.slotA)}
                                    </div>
                                  )}

                                  <span className="text-xs text-zinc-500">vs</span>

                                  {matchDraft.slotB.kind === "manual" ? (
                                    <select
                                      className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 md:w-[28rem]"
                                      value={teamB}
                                      onChange={(e) =>
                                        updateManualSlotValue(matchDraft.slotB.key, e.target.value)
                                      }
                                    >
                                      <option value="">Seleccionar pareja</option>
                                      {sortedTeams.map((team) => {
                                        const disabled =
                                          manualSelectedIdSet.has(team.id) && team.id !== teamB;
                                        return (
                                          <option key={team.id} value={team.id} disabled={disabled}>
                                            {getTeamLabelWithGroupRank(team.id)}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : (
                                    <div
                                      className={`w-full rounded-xl px-3 py-2 text-xs font-semibold md:w-[28rem] ${
                                        typeof getManualSlotValue(matchDraft.slotB) === "number"
                                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500"
                                      }`}
                                    >
                                      {getManualWinnerSlotLabel(matchDraft.slotB)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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

          {hasPlayoffBracket && (
            <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                <div className="text-sm font-semibold text-zinc-800">
                  Cuadro de playoffs
                </div>
                {!showPlayoffSetupCard && playoffFiltersToolbar}
                <div className="overflow-x-auto">
                  <div
                    className="grid w-full min-w-max gap-8 pb-2"
                    style={{
                      gridTemplateColumns: `repeat(${activeStages.length}, minmax(260px, 1fr))`,
                    }}
                  >
                    {activeStages.map((stage, stageIdx) => {
                      const stageMatchesRaw = [...(matchesByStage.get(stage) ?? [])].sort(
                        (a, b) => a.id - b.id
                      );
                      const nextStageForOrdering =
                        stageIdx < activeStages.length - 1 ? activeStages[stageIdx + 1] : null;
                      const nextStageMatchCountForOrdering = nextStageForOrdering
                        ? Math.max(1, Math.floor(STAGE_TEAM_COUNTS[nextStageForOrdering] / 2))
                        : 0;
                      const winnerSlotByCurrentStageMatchIdx =
                        nextStageMatchCountForOrdering > 0
                          ? assignWinnerSlotIndexes(
                              stageMatchesRaw.length,
                              nextStageMatchCountForOrdering
                            )
                          : new Map<number, number>();
                      const destinationByCurrentStageMatchIdx = new Map<number, number>();
                      winnerSlotByCurrentStageMatchIdx.forEach((winnerIdx, slotIdx) => {
                        destinationByCurrentStageMatchIdx.set(
                          winnerIdx,
                          Math.floor(slotIdx / 2)
                        );
                      });
                      const stageMatches = stageMatchesRaw
                        .map((stageMatch, idx) => ({
                          stageMatch,
                          idx,
                          destination: destinationByCurrentStageMatchIdx.get(idx) ?? idx,
                        }))
                        .sort(
                          (a, b) => a.destination - b.destination || a.idx - b.idx
                        )
                        .map((item) => item.stageMatch);
                      const prevStage = stageIdx > 0 ? activeStages[stageIdx - 1] : null;
                      const defaultSeedLabels = defaultSeedLabelsByStage.get(stage) ?? [];
                      const prevStageMatches = prevStage
                        ? [...(matchesByStage.get(prevStage) ?? [])].sort(
                            (a, b) => a.id - b.id
                          )
                        : [];
                      const expectedMatches = Math.max(
                        stageMatches.length,
                        prevStage ? Math.ceil(prevStageMatches.length / 2) : stageMatches.length
                      );
                      const winnerBySlotIndex = new Map<number, number>();
                      if (prevStage) {
                        const winnerSlotIndexes = assignWinnerSlotIndexes(
                          prevStageMatches.length,
                          expectedMatches
                        );
                        winnerSlotIndexes.forEach((winnerIdx, slotIdx) => {
                          const winnerTeamId =
                            prevStageMatches[winnerIdx]?.winner_team_id ?? null;
                          if (winnerTeamId) {
                            winnerBySlotIndex.set(slotIdx, winnerTeamId);
                          }
                        });
                      }
                      const seededPlaceholders = Array.from(
                        { length: expectedMatches },
                        (_, idx) => {
                          if (!prevStage) {
                            const defaultSeed = defaultSeedLabels[idx];
                            const manualSeedA = manualPreviewLabelBySlotKey.get(
                              manualSlotKey(stage, idx, "a")
                            );
                            const manualSeedB = manualPreviewLabelBySlotKey.get(
                              manualSlotKey(stage, idx, "b")
                            );
                            return {
                              type: "placeholder",
                              key: `${stage}-${idx}`,
                              seedA: manualSeedA ?? defaultSeed?.seedA ?? "Por definir",
                              seedB: manualSeedB ?? defaultSeed?.seedB ?? "Por definir",
                            };
                          }
                          const slotA = idx * 2;
                          const slotB = idx * 2 + 1;
                          const mappedWinnerA = winnerBySlotIndex.get(slotA) ?? null;
                          const mappedWinnerB = winnerBySlotIndex.get(slotB) ?? null;
                          const manualSeedA = manualPreviewLabelBySlotKey.get(
                            manualSlotKey(stage, idx, "a")
                          );
                          const manualSeedB = manualPreviewLabelBySlotKey.get(
                            manualSlotKey(stage, idx, "b")
                          );
                          return {
                            type: "placeholder",
                            key: `${stage}-placeholder-${idx}`,
                            seedA: manualSeedA ?? (mappedWinnerA ? getTeamLabel(mappedWinnerA) : "Por definir"),
                            seedB: manualSeedB ?? (mappedWinnerB ? getTeamLabel(mappedWinnerB) : "Por definir"),
                          };
                        }
                      );
                      const items = Array.from({ length: expectedMatches }, (_, idx) => {
                        const match = stageMatches[idx];
                        if (match) {
                          const seeded = seededPlaceholders[idx];
                          return {
                            type: "match",
                            match,
                            seedA: seeded?.seedA ?? "Por definir",
                            seedB: seeded?.seedB ?? "Por definir",
                          };
                        }
                        return seededPlaceholders[idx];
                      });
                      const baseMatches = initialStage
                        ? Math.max(matchesByStage.get(initialStage)?.length ?? 0, 1)
                        : 0;
                      const rowHeight = 18;
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
                        <div key={stage} className="w-full min-w-[260px] space-y-3">
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
                                return (
                                  <div
                                    key={`${stage}-placeholder-${idx}`}
                                    className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
                                    style={gridStyle}
                                  >
                                    <div className="text-xs uppercase tracking-[0.12em]">
                                      Por definir
                                    </div>
                                    <div className="mt-2 text-sm text-zinc-600">
                                      {item.seedA}
                                    </div>
                                    <div className="text-xs text-zinc-400">vs</div>
                                    <div className="text-sm text-zinc-600">
                                      {item.seedB}
                                    </div>
                                  </div>
                                );
                              }

                              const match = item.match;
                              const played = match.status === "played";
                              const hasTeams = hasDefinedTeams(match);
                              const teamALabel = hasTeams
                                ? getTeamLabel(match.team_a_id)
                                : item.seedA;
                              const teamBLabel = hasTeams
                                ? getTeamLabel(match.team_b_id)
                                : item.seedB;
                              const canSchedule = !played && !isFlashCompetition;
                              const canLoadResult =
                                !played
                                && hasTeams
                                && (isFlashCompetition || !!match.scheduled_time);
                              const scheduleLabel = isFlashCompetition
                                ? match.court_number
                                  ? `Cancha ${match.court_number}`
                                  : ""
                                : formatSchedule(
                                    match.scheduled_date,
                                    match.scheduled_time
                                  );
                              const hasSchedule = !!scheduleLabel;
                              return (
                                <div
                                  key={match.id}
                                  className={`h-full rounded-2xl border px-3 py-2 text-sm shadow-sm ${
                                    played
                                      ? "border-emerald-300 bg-emerald-100/70"
                                      : "border-zinc-200 bg-white"
                                  }`}
                                  style={gridStyle}
                                >
                                  <div className="flex h-full flex-col">
                                    <div className="text-xs text-zinc-500">
                                      Partido {getMatchCode(match)}
                                    </div>
                                  <div className="mt-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className={`font-medium text-zinc-900 ${
                                          match.winner_team_id === match.team_a_id
                                            ? "font-semibold"
                                            : ""
                                        }`}
                                      >
                                        {teamALabel}
                                      </div>
                                      {played && (
                                        <div
                                          className={`text-xs text-right ${
                                            match.winner_team_id === match.team_a_id
                                              ? "font-semibold text-zinc-900"
                                              : "font-normal text-zinc-400"
                                          }`}
                                        >
                                          {formatSetLine(match.sets, "a")}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <div
                                        className={`font-medium text-zinc-900 ${
                                          match.winner_team_id === match.team_b_id
                                            ? "font-semibold"
                                            : ""
                                        }`}
                                      >
                                        {teamBLabel}
                                      </div>
                                      {played && (
                                        <div
                                          className={`text-xs text-right ${
                                            match.winner_team_id === match.team_b_id
                                              ? "font-semibold text-zinc-900"
                                              : "font-normal text-zinc-400"
                                          }`}
                                        >
                                          {formatSetLine(match.sets, "b")}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                    <div className="mt-auto space-y-1 text-xs text-zinc-500">
                                      {played && (
                                        <div className="h-px w-full bg-emerald-400/70" />
                                      )}
                                      {!played && hasSchedule && (
                                        <div className="h-px w-full bg-zinc-300" />
                                      )}
                                      {(played || hasSchedule) && (
                                        <div className="text-xs text-zinc-600">
                                          {scheduleLabel
                                            || (isFlashCompetition
                                              ? "Cancha no asignada"
                                              : "Horario a confirmar")}
                                        </div>
                                      )}
                                      {!played && !hasSchedule && (
                                        <div>{isFlashCompetition ? "Sin cancha asignada" : "Pendiente"}</div>
                                      )}
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {canSchedule && (
                                          <Button
                                            onClick={() => openScheduleModal(match)}
                                            disabled={scheduling}
                                            variant="secondary"
                                          >
                                            {isFlashCompetition
                                              ? match.court_number
                                                ? "Editar cancha"
                                                : "Asignar cancha"
                                              : match.scheduled_time
                                              ? "Editar horario"
                                              : "Programar partido"}
                                          </Button>
                                        )}
                                        {played ? (
                                          <Button
                                            onClick={() => {
                                              void openResultModal(match);
                                            }}
                                            disabled={!canEdit}
                                            variant="secondary"
                                          >
                                            Editar resultado
                                          </Button>
                                        ) : canLoadResult ? (
                                          <Button
                                            onClick={() => {
                                              void openResultModal(match);
                                            }}
                                            disabled={!canEdit}
                                            variant="primary"
                                          >
                                            Cargar resultado
                                          </Button>
                                        ) : null}
                                      </div>
                                    </div>
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
        open={resetPlayoffsOpen}
        title="Regenerar playoffs"
        onClose={() => {
          if (!resettingPlayoffs) setResetPlayoffsOpen(false);
        }}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Esto eliminará todos los partidos de playoffs actuales. Esta acción no se puede deshacer. ¿Confirmas?
          </div>
          {resetPlayoffsError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {resetPlayoffsError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setResetPlayoffsOpen(false)}
              disabled={resettingPlayoffs}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetPlayoffs}
              disabled={resettingPlayoffs}
            >
              {resettingPlayoffs ? "Eliminando..." : "Confirmar y regenerar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmStage}
        title={confirmStage ? `Generar ${STAGE_LABELS[confirmStage]}` : "Generar playoffs"}
        onClose={() => {
          setConfirmStage(null);
          setConfirmAutoMode(DEFAULT_AUTO_MODE);
        }}
      >
        <div className="space-y-4">
          {confirmStageAutoOptions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Formato automatico
              </div>
              <div className="space-y-2">
                {confirmStageAutoOptions.map((option) => (
                  <label
                    key={option.mode}
                    className={`block rounded-xl border px-3 py-2 text-sm ${
                      confirmAutoMode === option.mode
                        ? "border-zinc-700 bg-zinc-100 text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700"
                    } ${option.enabled ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="auto-mode"
                        className="mt-1"
                        checked={confirmAutoMode === option.mode}
                        disabled={!option.enabled}
                        onChange={() => {
                          if (!option.enabled) return;
                          setConfirmAutoMode(option.mode);
                        }}
                      />
                      <div>
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-xs text-zinc-500">{option.description}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Esta accion no se puede deshacer. ¿Confirmas generar los cruces?
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmStage(null);
                setConfirmAutoMode(DEFAULT_AUTO_MODE);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() =>
                confirmStage && handleGenerate(confirmStage, confirmAutoMode)
              }
              disabled={
                generating
                || !confirmStageAutoOptions.some(
                  (option) => option.mode === confirmAutoMode && option.enabled
                )
              }
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
            className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
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
        open={bulkScheduleOpen}
        title="Programar horarios de llaves"
        onClose={closeBulkScheduleModal}
        className="max-w-6xl"
      >
        <form
          className="space-y-5 max-h-[80vh] overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (bulkScheduling) return;
            saveBulkSchedule();
          }}
        >
          <div className="space-y-4">
            <div className="text-sm text-zinc-600">
              Elegí el arranque general. Si una instancia necesita algo distinto, la ajustás abajo.
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.05fr_1fr_0.8fr_0.8fr_0.9fr]">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-500">Fecha</div>
                  <Input
                    type="date"
                    value={bulkScheduleBaseConfig.date}
                    onChange={(e) => updateBulkBaseConfig({ date: e.target.value })}
                    disabled={bulkScheduling}
                  />
                  {bulkScheduleFieldErrors["base.date"] && (
                    <div className="text-xs text-red-600">{bulkScheduleFieldErrors["base.date"]}</div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-500">Hora de inicio</div>
                  <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                    <select
                      className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                      value={bulkScheduleBaseConfig.hour}
                      onChange={(e) => updateBulkBaseConfig({ hour: e.target.value })}
                      disabled={bulkScheduling}
                    >
                      <option value="">Hora</option>
                      {HOURS.map((hour) => (
                        <option key={`bulk-base-hour-${hour}`} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                      value={bulkScheduleBaseConfig.minute}
                      onChange={(e) => updateBulkBaseConfig({ minute: e.target.value })}
                      disabled={bulkScheduling}
                    >
                      {BULK_MINUTE_OPTIONS.map((minute) => (
                        <option key={`bulk-base-minute-${minute}`} value={minute}>
                          :{minute}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(bulkScheduleFieldErrors["base.hour"] || bulkScheduleFieldErrors["base.minute"]) && (
                    <div className="text-xs text-red-600">
                      {bulkScheduleFieldErrors["base.hour"] || bulkScheduleFieldErrors["base.minute"]}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-500">Cancha inicial</div>
                  <Input
                    type="number"
                    min={1}
                    value={bulkScheduleBaseConfig.firstCourt}
                    onChange={(e) => updateBulkBaseConfig({ firstCourt: e.target.value })}
                    disabled={bulkScheduling}
                  />
                  {bulkScheduleFieldErrors["base.firstCourt"] && (
                    <div className="text-xs text-red-600">
                      {bulkScheduleFieldErrors["base.firstCourt"]}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-500">Canchas</div>
                  <Input
                    type="number"
                    min={1}
                    value={bulkScheduleBaseConfig.courtsCount}
                    onChange={(e) => updateBulkBaseConfig({ courtsCount: e.target.value })}
                    disabled={bulkScheduling}
                  />
                  {bulkScheduleFieldErrors["base.courtsCount"] && (
                    <div className="text-xs text-red-600">
                      {bulkScheduleFieldErrors["base.courtsCount"]}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold text-zinc-500">Descanso (min)</div>
                  <Input
                    type="number"
                    min={0}
                    value={bulkStageGapMinutes}
                    onChange={(e) => updateBulkStageGapMinutes(e.target.value)}
                    disabled={bulkScheduling}
                  />
                  {bulkScheduleFieldErrors["base.gapMinutes"] && (
                    <div className="text-xs text-red-600">
                      {bulkScheduleFieldErrors["base.gapMinutes"]}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Duración por partido: {tournamentMatchDurationMinutes} min. Canchas usadas:{" "}
                {formatBulkCourtRange(
                  bulkScheduleBaseConfig.firstCourt,
                  bulkScheduleBaseConfig.courtsCount
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-zinc-900">Instancias</div>
              {bulkScheduleFieldErrors.stages && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {bulkScheduleFieldErrors.stages}
                </div>
              )}

              {schedulablePlayoffStages.map(({ stage, matches }) => {
                const config = bulkScheduleByStage[stage];
                const summary = bulkSummaryByStage.get(stage);
                const effectiveCourts = config.useGlobal
                  ? Number(bulkScheduleBaseConfig.courtsCount)
                  : Number(config.courtsCount);
                const slotsCount = Math.ceil(matches.length / Math.max(1, effectiveCourts || 1));
                const sourceDate = config.useGlobal ? bulkScheduleBaseConfig.date : config.date;
                const liveStageError = bulkSchedulePlanPreview.errors[`stage.${stage}.__stage`];

                return (
                  <div key={stage} className="rounded-xl border border-zinc-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => updateBulkStageConfig(stage, { enabled: e.target.checked })}
                          disabled={bulkScheduling}
                          className="mt-1"
                        />
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-zinc-900">
                            {STAGE_LABELS[stage]}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {matches.length} partido(s) · {slotsCount} bloque(s)
                            {summary ? ` · ${summary.firstTime}` : ""}
                          </div>
                        </div>
                      </label>

                      {config.enabled && (
                        <button
                          type="button"
                          onClick={() =>
                            updateBulkStageConfig(stage, { useGlobal: !config.useGlobal })
                          }
                          disabled={bulkScheduling}
                          className="text-xs font-medium text-zinc-600 underline underline-offset-2 disabled:opacity-50"
                        >
                          {config.useGlobal ? "Ajustar esta instancia" : "Usar configuración general"}
                        </button>
                      )}
                    </div>

                    {config.enabled && (
                      <div className="mt-3 space-y-3">
                        <div className="text-xs text-zinc-600">
                          {summary ? (
                            <>
                              {formatBulkDateLabel(sourceDate)} · {summary.firstTime} a{" "}
                              {summary.lastTime} · canchas {summary.firstCourt} a{" "}
                              {summary.lastCourt}
                              {summary.adjustedByMinutes > 0
                                ? ` · ajustado +${summary.adjustedByMinutes} min`
                                : ""}
                            </>
                          ) : (
                            "Completá los datos para ver el horario final de esta instancia."
                          )}
                        </div>

                        {!config.useGlobal && (
                          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] rounded-xl bg-zinc-50 p-3">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-zinc-500">Fecha</div>
                              <Input
                                type="date"
                                value={config.date}
                                onChange={(e) => updateBulkStageConfig(stage, { date: e.target.value })}
                                disabled={bulkScheduling}
                              />
                              {bulkScheduleFieldErrors[`stage.${stage}.date`] && (
                                <div className="text-xs text-red-600">
                                  {bulkScheduleFieldErrors[`stage.${stage}.date`]}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-zinc-500">Hora</div>
                              <select
                                className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                                value={config.hour}
                                onChange={(e) => updateBulkStageConfig(stage, { hour: e.target.value })}
                                disabled={bulkScheduling}
                              >
                                <option value="">Hora</option>
                                {HOURS.map((hour) => (
                                  <option key={`${stage}-hour-${hour}`} value={hour}>
                                    {hour}
                                  </option>
                                ))}
                              </select>
                              {bulkScheduleFieldErrors[`stage.${stage}.hour`] && (
                                <div className="text-xs text-red-600">
                                  {bulkScheduleFieldErrors[`stage.${stage}.hour`]}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-zinc-500">Minuto</div>
                              <select
                                className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
                                value={config.minute}
                                onChange={(e) => updateBulkStageConfig(stage, { minute: e.target.value })}
                                disabled={bulkScheduling}
                              >
                                {BULK_MINUTE_OPTIONS.map((minute) => (
                                  <option key={`${stage}-minute-${minute}`} value={minute}>
                                    {minute}
                                  </option>
                                ))}
                              </select>
                              {bulkScheduleFieldErrors[`stage.${stage}.minute`] && (
                                <div className="text-xs text-red-600">
                                  {bulkScheduleFieldErrors[`stage.${stage}.minute`]}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-zinc-500">Cancha inicial</div>
                              <Input
                                type="number"
                                min={1}
                                value={config.firstCourt}
                                onChange={(e) =>
                                  updateBulkStageConfig(stage, { firstCourt: e.target.value })
                                }
                                disabled={bulkScheduling}
                              />
                              {bulkScheduleFieldErrors[`stage.${stage}.firstCourt`] && (
                                <div className="text-xs text-red-600">
                                  {bulkScheduleFieldErrors[`stage.${stage}.firstCourt`]}
                                </div>
                              )}
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-zinc-500">Canchas</div>
                              <Input
                                type="number"
                                min={1}
                                value={config.courtsCount}
                                onChange={(e) =>
                                  updateBulkStageConfig(stage, { courtsCount: e.target.value })
                                }
                                disabled={bulkScheduling}
                              />
                              {bulkScheduleFieldErrors[`stage.${stage}.courtsCount`] && (
                                <div className="text-xs text-red-600">
                                  {bulkScheduleFieldErrors[`stage.${stage}.courtsCount`]}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {(bulkScheduleFieldErrors[`stage.${stage}.__stage`] || liveStageError) && (
                          <div className="rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-xs text-red-800">
                            {bulkScheduleFieldErrors[`stage.${stage}.__stage`] || liveStageError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Vista previa</div>
              <div className="mt-1 text-xs text-zinc-500">
                Se programarán {bulkSchedulePlanPreview.tasks.length} partido(s) en{" "}
                {enabledBulkStages.length} instancia(s).
              </div>

              <div className="mt-3 space-y-2">
                {enabledBulkStages.length === 0 ? (
                  <div className="text-sm text-zinc-500">
                    Seleccioná al menos una instancia para ver el resumen.
                  </div>
                ) : (
                  enabledBulkStages.map(({ stage }) => {
                    const config = bulkScheduleByStage[stage];
                    const summary = bulkSummaryByStage.get(stage);
                    const sourceDate = config.useGlobal ? bulkScheduleBaseConfig.date : config.date;
                    const liveStageError = bulkSchedulePlanPreview.errors[`stage.${stage}.__stage`];

                    return (
                      <div key={`preview-${stage}`} className="text-sm text-zinc-700">
                        <span className="font-semibold text-zinc-900">{STAGE_LABELS[stage]}</span>
                        {" · "}
                        {summary
                          ? `${formatBulkDateLabel(sourceDate)} · ${summary.firstTime} a ${summary.lastTime} · canchas ${summary.firstCourt}-${summary.lastCourt}`
                          : liveStageError || "Faltan datos para calcular esta instancia."}
                      </div>
                    );
                  })
                )}
              </div>

              {Object.keys(bulkSchedulePlanPreview.errors).length > 0 && (
                <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-xs text-red-800">
                  Ajustá los campos marcados antes de programar.
                </div>
              )}
            </div>
          </div>

          {bulkScheduleError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {bulkScheduleError}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-500">
              Revisá el preview. Si algo cambia por disponibilidad de canchas, lo vas a ver acá
              mismo antes de aplicar.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeBulkScheduleModal} type="button">
                Cancelar
              </Button>
              <Button type="submit" disabled={bulkScheduling}>
                {bulkScheduling
                  ? "Programando..."
                  : `Programar ${bulkSchedulePlanPreview.tasks.length} partidos`}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!bulkScheduleSuccess}
        title="Programación aplicada"
        onClose={() => setBulkScheduleSuccess(null)}
        className="max-w-md"
      >
        {bulkScheduleSuccess && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
                ✓
              </div>
              <div className="text-sm text-emerald-900">
                Se programaron {bulkScheduleSuccess.scheduledCount} de{" "}
                {bulkScheduleSuccess.totalCount} partidos de llaves.
              </div>
            </div>

            <div className="text-sm text-zinc-600">
              Quieres revisar la grilla o ajustar un partido puntual?
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setBulkScheduleSuccess(null)}>
                Cerrar
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setGridOpen(true);
                  setBulkScheduleSuccess(null);
                }}
              >
                Ver grilla
              </Button>
              <Button
                onClick={() => {
                  if (bulkScheduleSuccess.firstMatchId) {
                    const targetMatch = matches.find(
                      (match) => match.id === bulkScheduleSuccess.firstMatchId
                    );
                    if (targetMatch) {
                      openScheduleModal(targetMatch);
                    } else {
                      setGridOpen(true);
                    }
                  } else {
                    setGridOpen(true);
                  }
                  setBulkScheduleSuccess(null);
                }}
              >
                Ajustar partido puntual
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!scheduleMatch}
        title={isFlashCompetition ? "Asignar cancha" : "Programar partido"}
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
              ? `Partido ${getMatchCode(scheduleMatch)} · ${getMatchTeamLabel(
                  scheduleMatch,
                  "a"
                )} vs ${getMatchTeamLabel(scheduleMatch, "b")}`
              : null}
          </div>
          {isFlashCompetition && (
            <div className="text-xs text-zinc-500">
              En relámpago solo asignás cancha. No hace falta fecha ni horario.
            </div>
          )}

          {!isFlashCompetition && (
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
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
                  className="w-full rounded-xl border border-zinc-400 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
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
          )}

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
              {scheduling
                ? "Guardando..."
                : isFlashCompetition
                ? "Guardar cancha"
                : "Guardar"}
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
            if (!canEdit || saving) return;
            saveResult();
          }}
        >
          <div className="space-y-3">
            {competitionType === "flash" ? (
              <div
                className="grid items-center gap-2 max-w-sm"
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
                    {selectedMatch ? getMatchTeamLabel(selectedMatch, "a") : "-"}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={setsInput[0]?.a ?? ""}
                  onChange={(e) => updateSet(0, "a", e.target.value)}
                  disabled={!canEdit}
                  className="score-input !w-16 h-9 !px-0 justify-self-center text-center tabular-nums"
                />

                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-500">Pareja 2</div>
                  <div className="text-sm text-zinc-700">
                    {selectedMatch ? getMatchTeamLabel(selectedMatch, "b") : "-"}
                  </div>
                </div>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={setsInput[0]?.b ?? ""}
                  onChange={(e) => updateSet(0, "b", e.target.value)}
                  disabled={!canEdit}
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
                      {selectedMatch ? getMatchTeamLabel(selectedMatch, "a") : "-"}
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
                      disabled={!canEdit}
                      className="score-input text-center tabular-nums"
                    />
                  ))}

                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-zinc-500">Pareja 2</div>
                    <div className="text-sm text-zinc-700">
                      {selectedMatch ? getMatchTeamLabel(selectedMatch, "b") : "-"}
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
                      disabled={!canEdit}
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

      <Modal
        open={gridOpen}
        title="Grilla de partidos"
        onClose={() => setGridOpen(false)}
        className="max-w-[95vw]"
        closeOnEscape={!gridMatch}
      >
        <div className="space-y-4">
          {scheduledMatches.length === 0 ? (
            <div className="text-sm text-zinc-600">
              No hay partidos programados para mostrar.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3 text-xs text-zinc-500">
                <div className="space-y-1">
                  <div>
                    {gridData.courts.length} canchas · {gridData.times.length} turnos
                  </div>
                  <div>Click en un partido para ver el detalle.</div>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="grid-date-filter" className="font-semibold text-zinc-600">
                    Fecha
                  </label>
                  <button
                    type="button"
                    onClick={() => shiftGridDate(-1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                    aria-label="Ir al dia anterior"
                  >
                    {"<"}
                  </button>
                  <input
                    id="grid-date-filter"
                    type="date"
                    value={gridDateFilter}
                    onChange={(event) => setGridDateFilter(event.target.value)}
                    className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-800/15"
                  />
                  <button
                    type="button"
                    onClick={() => shiftGridDate(1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                    aria-label="Ir al dia siguiente"
                  >
                    {">"}
                  </button>
                </div>
              </div>
              {gridData.times.length === 0 || gridData.courts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                  No hay partidos programados para la fecha {formatShortDate(gridDateFilter)}.
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-auto rounded-2xl border border-zinc-200 bg-white">
                  <div
                    className="grid gap-2 p-3"
                    style={{
                      gridTemplateColumns: `110px repeat(${gridData.courts.length}, minmax(240px, 1fr))`,
                    }}
                  >
                    <div className="sticky top-0 z-10 rounded-lg bg-white/95 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      Hora
                    </div>
                    {gridData.courts.map((court) => (
                      <div
                        key={`head-${court.key}`}
                        className="sticky top-0 z-10 rounded-lg bg-white/95 py-2 text-xs font-semibold text-zinc-700"
                      >
                        {court.label}
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
                          {gridData.courts.map((court) => {
                            const matchesInCell =
                              gridData.map.get(slotTime)?.get(court.key) ?? [];
                            return (
                              <div
                                key={`cell-${slotTime}-${court.key}`}
                                className={`min-h-[92px] rounded-2xl border border-zinc-200 p-2 ${rowClass}`}
                              >
                                {matchesInCell.length === 0 ? (
                                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-400">
                                    Sin partidos
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {matchesInCell.map((match) => (
                                      <button
                                        key={match.id}
                                        type="button"
                                        onClick={() => setGridMatch(match)}
                                        className={`group w-full rounded-xl border p-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                                          match.status === "played"
                                            ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                                        }`}
                                      >
                                        <div className="text-[10px] uppercase tracking-wide text-zinc-400">
                                          {getStageLabel(match)} · {getMatchCode(match)}
                                        </div>
                                        <div className="mt-2 text-sm font-medium text-zinc-900">
                                          {getMatchTeamLabel(match, "a")} vs {getMatchTeamLabel(match, "b")}
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
              )}
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
                {getMatchTeamLabel(gridMatch, "a")} vs {getMatchTeamLabel(gridMatch, "b")}
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
