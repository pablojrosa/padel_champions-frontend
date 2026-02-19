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
  PlayoffGenerateRequest,
  PlayoffManualSeed,
  PlayoffManualSeedsUpsertRequest,
  PlayoffStage,
  Team,
  TournamentGroupOut,
  TournamentStatus,
  TournamentStatusResponse,
} from "@/lib/types";

type IdParam = { id: string };

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

function manualSlotKey(stage: PlayoffStage, matchIndex: number, side: ManualSlotSide) {
  return `${stage}:${matchIndex}:${side}`;
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
  const [gridOpen, setGridOpen] = useState(false);
  const [gridMatch, setGridMatch] = useState<Match | null>(null);

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

  const rankedTeamsByGroup = useMemo(() => {
    if (categoryFilter === "all" || genderFilter === "all") return [];

    const rankEntries: GroupRankingEntry[] = [];
    const labelForTeamId = (teamId: number) => {
      const team = teamsById.get(teamId);
      if (!team) return `Team #${teamId}`;
      const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
      return names.length > 0 ? names.join(" / ") : `Team #${teamId}`;
    };

    filteredGroups.forEach((group) => {
      const groupTeamIds = new Set(group.teams.map((team) => team.id));
      const stats = new Map<
        number,
        { points: number; setsFor: number; setsAgainst: number; gamesFor: number; gamesAgainst: number }
      >();

      group.teams.forEach((team) => {
        stats.set(team.id, {
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
      );

      groupMatches.forEach((match) => {
        if (!groupTeamIds.has(match.team_a_id) || !groupTeamIds.has(match.team_b_id)) {
          return;
        }

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
  }, [filteredGroups, matches, categoryFilter, genderFilter, teamsById]);

  const groupRankingByTeam = useMemo(() => {
    const map = new Map<number, GroupRankingEntry>();
    rankedTeamsByGroup.forEach((entry) => map.set(entry.teamId, entry));
    return map;
  }, [rankedTeamsByGroup]);

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
      const rankOrder = new Map<number, number>();
      rankedTeamsByGroup.forEach((entry, idx) => rankOrder.set(entry.teamId, idx));
      return [...filtered].sort((a, b) => {
        const rankA = rankOrder.get(a.id);
        const rankB = rankOrder.get(b.id);
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
  }, [teams, categoryFilter, genderFilter, rankedTeamsByGroup]);

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
  const hasPlayoffs = useMemo(
    () => Array.from(matchesByStage.values()).some((items) => items.length > 0),
    [matchesByStage]
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
    return matches.filter((match) => {
      const team = teamsById.get(match.team_a_id);
      const category = team?.players?.[0]?.category ?? null;
      const gender = team?.players?.[0]?.gender ?? null;
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
  const gridData = useMemo(() => {
    const dates = Array.from(
      new Set(scheduledMatches.map((match) => match.scheduled_date as string))
    ).sort();
    const times = Array.from(
      new Set(
        scheduledMatches
          .map((match) => normalizeTime(match.scheduled_time))
          .filter(Boolean)
      )
    ).sort();
    const map = new Map<string, Map<string, Match[]>>();

    scheduledMatches.forEach((match) => {
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
    if (categoryFilter === "all" || genderFilter === "all") return [];
    if (!groupStageComplete) return [];
    return PLAYOFF_STAGES;
  }, [groupStageComplete, categoryFilter, genderFilter]);

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

  function getTeamLabel(teamId: number) {
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;

    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }
  function getTeamLabelWithGroupRank(teamId: number) {
    const ranking = groupRankingByTeam.get(teamId);
    if (!ranking) return getTeamLabel(teamId);
    return `${getTeamLabel(teamId)} (${ranking.position}° ${ranking.groupName})`;
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
                className="rounded-xl border border-zinc-500 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-950 shadow-sm focus:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
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
                className="rounded-xl border border-zinc-500 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-950 shadow-sm focus:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
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
            <Button variant="secondary" onClick={() => setGridOpen(true)}>
              Grilla de partidos
            </Button>
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
            <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-semibold text-zinc-800">Instancias disponibles (automatico)</div>
                  {availableStages.length === 0 ? (
                    <div className="text-sm text-zinc-600">
                      {!groupStageComplete && !latestStage
                        ? "Tenes que completar los resultados de grupos para esta categoria y genero."
                        : latestStage && !canGenerateNextStage
                        ? `Completa los resultados de ${STAGE_LABELS[latestStage]} para avanzar.`
                        : "No hay instancias disponibles para generar ahora."}
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
          )}

          <Card className="bg-white/95">
                <div className="p-6 space-y-4">
                  <div className="text-sm font-semibold text-zinc-800">Armado manual por instancia</div>

                  {!groupStageComplete ? (
                    <div className="text-sm text-zinc-600">
                      Completa los resultados de grupos de esta categoria y genero para habilitar el armado manual.
                    </div>
                  ) : manualStageOptions.length === 0 ? (
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
                        Armá el cuadro completo desde esta instancia. Los cupos marcados como
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
                            const manualSeedA = manualPreviewLabelBySlotKey.get(
                              manualSlotKey(stage, idx, "a")
                            );
                            const manualSeedB = manualPreviewLabelBySlotKey.get(
                              manualSlotKey(stage, idx, "b")
                            );
                            return {
                              type: "placeholder",
                              key: `${stage}-${idx}`,
                              seedA: manualSeedA ?? "Por definir",
                              seedB: manualSeedB ?? "Por definir",
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
                        if (match) return { type: "match", match };
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
                                const seedA =
                                  "seedA" in item ? item.seedA : "Por definir";
                                const seedB =
                                  "seedB" in item ? item.seedB : "Por definir";
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
                              const canSchedule = !played;
                              const canLoadResult = !played && !!match.scheduled_time;
                              const scheduleLabel = formatSchedule(
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
                                        {getTeamLabel(match.team_a_id)}
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
                                        {getTeamLabel(match.team_b_id)}
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
                                          {scheduleLabel || "Horario a confirmar"}
                                        </div>
                                      )}
                                      {!played && !hasSchedule && <div>Pendiente</div>}
                                      <div className="flex flex-wrap justify-end gap-2">
                                        {canSchedule && (
                                          <Button
                                            onClick={() => openScheduleModal(match)}
                                            disabled={scheduling}
                                            variant="secondary"
                                          >
                                            {match.scheduled_time
                                              ? "Editar horario"
                                              : "Programar partido"}
                                          </Button>
                                        )}
                                        {played ? (
                                          <Button
                                            onClick={() => openResultModal(match)}
                                            disabled={!canEdit}
                                            variant="secondary"
                                          >
                                            Editar resultado
                                          </Button>
                                        ) : canLoadResult ? (
                                          <Button
                                            onClick={() => openResultModal(match)}
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
          <div className="space-y-3">
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
                    className="score-input text-center tabular-nums"
                  />
                ))}
              </div>
            </div>
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
                                    className={`group rounded-xl border p-2 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow ${
                                      match.status === "played"
                                        ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                                    }`}
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
