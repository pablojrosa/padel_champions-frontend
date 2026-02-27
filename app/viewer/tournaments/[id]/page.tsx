"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
type PlayoffStage = Exclude<Match["stage"], "group">;
type SeedLabel = {
  seedA: string;
  seedB: string;
};
type SeedCandidate = {
  groupName: string;
  groupOrder: number;
  position: number;
};

const STAGE_ORDER: Match["stage"][] = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "final",
];

const PLAYOFF_STAGES: PlayoffStage[] = [
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

const URL_CANDIDATE_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const URL_STRICT_REGEX = /^(?:https?:\/\/|www\.)[^\s<>"']+$/i;

function splitUrlAndTrailingPunctuation(candidate: string) {
  let url = candidate;
  let trailing = "";
  while (url.length > 0 && /[),.;!?]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }
  return { url, trailing };
}

function normalizeHref(candidate: string) {
  if (candidate.startsWith("www.")) return `https://${candidate}`;
  return candidate;
}

function renderTextWithLinks(text: string) {
  const parts = text.split(URL_CANDIDATE_REGEX);
  return parts.map((part, index) => {
    if (!part) return null;
    if (!URL_STRICT_REGEX.test(part)) return <span key={`text-${index}`}>{part}</span>;
    const { url, trailing } = splitUrlAndTrailingPunctuation(part);
    if (!url || !URL_STRICT_REGEX.test(url)) {
      return <span key={`text-${index}`}>{part}</span>;
    }
    const href = normalizeHref(url);
    return (
      <span key={`link-${index}`}>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600"
        >
          {url}
        </a>
        {trailing}
      </span>
    );
  });
}

function renderDescriptionWithLinks(text: string) {
  const lines = text.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  lines.forEach((line, index) => {
    nodes.push(
      <span key={`line-${index}`}>
        {renderTextWithLinks(line)}
      </span>
    );
    if (index < lines.length - 1) nodes.push("\n");
  });
  return nodes;
}

function stageLabel(stage: Match["stage"]) {
  if (stage === "round_of_32") return "16vos";
  if (stage === "round_of_16") return "Octavos";
  if (stage === "quarter") return "Cuartos";
  if (stage === "semi") return "Semis";
  if (stage === "final") return "Final";
  return "Zonas";
}

function formatDiff(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function diffTextColor(value: number) {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-600";
  return "text-zinc-500";
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
  const [activeSection, setActiveSection] = useState<"playoffs" | "groups" | "matches" | "results">(
    "groups"
  );
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [collapsedDivisions, setCollapsedDivisions] = useState<Record<string, boolean>>({});
  const [divisionFilter, setDivisionFilter] = useState<string | "all">("all");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

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

  function getTeamLabel(teamId?: number | null) {
    if (typeof teamId !== "number") return "Por definir";
    const team = teamsById.get(teamId);
    if (!team) return `Team #${teamId}`;
    const names = team.players?.map((player) => player.name).filter(Boolean) ?? [];
    if (names.length === 0) return `Team #${teamId}`;
    return names.join(" / ");
  }
  function getMatchCode(match: Match) {
    return match.match_code ?? String(match.id);
  }

  function getTeamDivision(teamId?: number | null) {
    if (typeof teamId !== "number") return null;
    const team = teamsById.get(teamId);
    const category = team?.players?.[0]?.category ?? null;
    const gender = team?.players?.[0]?.gender ?? null;
    if (!category || !gender) return null;
    return `${category} - ${gender === "damas" ? "Damas" : "Masculino"}`;
  }
  function hasDefinedTeams(match: Match): match is Match & { team_a_id: number; team_b_id: number } {
    return typeof match.team_a_id === "number" && typeof match.team_b_id === "number";
  }
  function getGroupDivision(group: TournamentGroupOut) {
    for (const team of group.teams) {
      const category = team.players?.[0]?.category ?? null;
      const gender = team.players?.[0]?.gender ?? null;
      if (!category || !gender) continue;
      return `${category} - ${gender === "damas" ? "Damas" : "Masculino"}`;
    }
    return null;
  }

  const divisions = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      const category = team.players?.[0]?.category ?? null;
      const gender = team.players?.[0]?.gender ?? null;
      if (!category || !gender) return;
      values.add(`${category} - ${gender === "damas" ? "Damas" : "Masculino"}`);
    });
    return Array.from(values).sort();
  }, [teams]);
  const divisionGroupsForSeeds = useMemo(() => {
    return groups
      .map((group) => {
        const teamCount = group.teams.filter((team) => {
          const fallbackTeam = teamsById.get(team.id);
          const category =
            team.players?.[0]?.category ?? fallbackTeam?.players?.[0]?.category ?? null;
          const gender =
            team.players?.[0]?.gender ?? fallbackTeam?.players?.[0]?.gender ?? null;
          if (!category || !gender) return false;
          if (divisionFilter === "all") return true;
          const label = `${category} - ${gender === "damas" ? "Damas" : "Masculino"}`;
          return label === divisionFilter;
        }).length;
        return {
          name: group.name,
          teamCount,
        };
      })
      .filter((entry) => entry.teamCount > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, divisionFilter, teamsById]);
  const defaultSeedLabelsByStage = useMemo(() => {
    const map = new Map<PlayoffStage, SeedLabel[]>();
    PLAYOFF_STAGES.forEach((stage) => {
      map.set(stage, buildDefaultSeedLabelsForStage(stage, divisionGroupsForSeeds));
    });
    return map;
  }, [divisionGroupsForSeeds]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return groups.filter((group) => {
      const matchesDivision =
        divisionFilter === "all" ||
        group.teams.some((team) => {
          const category = team.players?.[0]?.category ?? null;
          const gender = team.players?.[0]?.gender ?? null;
          if (!category || !gender) return false;
          const label = `${category} - ${gender === "damas" ? "Damas" : "Masculino"}`;
          return label === divisionFilter;
        });
      if (!matchesDivision) return false;
      if (!normalized) return true;
      return group.teams.some((team) =>
        team.players.some((player) => player.name.toLowerCase().includes(normalized))
      );
    });
  }, [groups, query, divisionFilter]);

  const filteredMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matchDivision = (match: Match) => {
      if (match.category && match.gender) {
        return `${match.category} - ${match.gender === "damas" ? "Damas" : "Masculino"}`;
      }
      return getTeamDivision(match.team_a_id) ?? getTeamDivision(match.team_b_id);
    };
    const isVisible = (match: Match) => {
      if (!normalized) return true;
      const aLabel = getTeamLabel(match.team_a_id).toLowerCase();
      const bLabel = getTeamLabel(match.team_b_id).toLowerCase();
      return aLabel.includes(normalized) || bLabel.includes(normalized);
    };
    return matches.filter((match) => {
      if (!isVisible(match)) return false;
      if (divisionFilter === "all") return true;
      return matchDivision(match) === divisionFilter;
    });
  }, [matches, query, divisionFilter, teamsById]);
  const hasActiveFilters = query.trim().length > 0 || divisionFilter !== "all";
  const descriptionText = tournament?.description?.trim() ?? "";
  const descriptionContent = useMemo(
    () => renderDescriptionWithLinks(descriptionText),
    [descriptionText]
  );
  const isLongDescription = useMemo(() => {
    if (!descriptionText) return false;
    const lines = descriptionText.split(/\r?\n/).length;
    return lines > 6 || descriptionText.length > 280;
  }, [descriptionText]);

  useEffect(() => {
    setIsDescriptionExpanded(false);
  }, [descriptionText]);

  const groupedDivisions = useMemo(() => {
    const matchDivision = (match: Match) => {
      if (match.category && match.gender) {
        return `${match.category} - ${match.gender === "damas" ? "Damas" : "Masculino"}`;
      }
      return getTeamDivision(match.team_a_id) ?? getTeamDivision(match.team_b_id);
    };
    const allowedDivisions =
      divisionFilter === "all" ? divisions : divisions.filter((division) => division === divisionFilter);
    const map = new Map<
      string,
      { label: string; groups: TournamentGroupOut[]; matches: Match[] }
    >();
    allowedDivisions.forEach((label) => {
      map.set(label, { label, groups: [], matches: [] });
    });

    filteredGroups.forEach((group) => {
      const label = getGroupDivision(group);
      if (!label) return;
      if (divisionFilter !== "all" && label !== divisionFilter) return;
      const entry = map.get(label) ?? { label, groups: [], matches: [] };
      entry.groups.push(group);
      map.set(label, entry);
    });

    filteredMatches
      .filter((match) => match.stage === "group")
      .forEach((match) => {
        const label = matchDivision(match);
        if (!label) return;
        if (divisionFilter !== "all" && label !== divisionFilter) return;
        const entry = map.get(label) ?? { label, groups: [], matches: [] };
        entry.matches.push(match);
        map.set(label, entry);
      });

    return Array.from(map.values()).filter(
      (entry) => entry.groups.length > 0 || entry.matches.length > 0
    );
  }, [divisions, divisionFilter, filteredGroups, filteredMatches, teamsById]);

  const playoffMatches = useMemo(
    () => matches.filter((match) => match.stage !== "group"),
    [matches]
  );
  const hasPlayoffs = playoffMatches.length > 0;
  const hasAssignedPlayoffs = useMemo(
    () => playoffMatches.some((match) => hasDefinedTeams(match)),
    [playoffMatches]
  );
  const hasOnlyScheduledPlayoffs = hasPlayoffs && !hasAssignedPlayoffs;

  const filteredPlayoffMatches = useMemo(
    () => filteredMatches.filter((match) => match.stage !== "group"),
    [filteredMatches]
  );
  const hasFilteredPlayoffs = filteredPlayoffMatches.length > 0;

  useEffect(() => {
    if (hasPlayoffs) setShowGroups(hasOnlyScheduledPlayoffs);
  }, [hasPlayoffs, hasOnlyScheduledPlayoffs]);

  useEffect(() => {
    if (hasPlayoffs) {
      setActiveSection(hasOnlyScheduledPlayoffs ? "matches" : "playoffs");
      return;
    }
    setActiveSection("groups");
  }, [hasPlayoffs, hasOnlyScheduledPlayoffs]);

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
  const groupStageMatches = useMemo(
    () => sortedMatches.filter((match) => match.stage === "group"),
    [sortedMatches]
  );
  const pendingGroupMatches = useMemo(
    () => groupStageMatches.filter((match) => match.status === "pending"),
    [groupStageMatches]
  );
  const playedGroupMatches = useMemo(
    () => groupStageMatches.filter((match) => match.status === "played"),
    [groupStageMatches]
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
  function formatCourt(courtNumber?: number | null) {
    if (!courtNumber) return "";
    return `Cancha ${courtNumber}`;
  }

  const matchesByStage = useMemo(() => {
    const map = new Map<Match["stage"], Match[]>();
    PLAYOFF_STAGES.forEach((stage) => map.set(stage, []));
    filteredPlayoffMatches.forEach((match) => {
      map.get(match.stage)?.push(match);
    });
    return map;
  }, [filteredPlayoffMatches]);

  const matchesByStageAll = useMemo(() => {
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

  useEffect(() => {
    if (activeStages.length === 0) return;
    setCollapsedStages((prev) => {
      const next: Record<string, boolean> = {};
      activeStages.forEach((stage) => {
        next[stage] = prev[stage] ?? false;
      });
      return next;
    });
  }, [activeStages]);

  useEffect(() => {
    if (groupedDivisions.length === 0) return;
    setCollapsedDivisions((prev) => {
      const next: Record<string, boolean> = {};
      groupedDivisions.forEach((division) => {
        next[division.label] = prev[division.label] ?? false;
      });
      return next;
    });
  }, [groupedDivisions]);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized || activeStages.length === 0) return;
    setCollapsedStages((prev) => {
      const next = { ...prev };
      activeStages.forEach((stage) => {
        const stageMatches = matchesByStage.get(stage) ?? [];
        if (stageMatches.length > 0) next[stage] = false;
      });
      return next;
    });
  }, [query, activeStages, matchesByStage]);
  const playoffSeedLabelByMatchId = useMemo(() => {
    const map = new Map<number, SeedLabel>();
    if (activeStages.length === 0) return map;

    activeStages.forEach((stage, stageIdx) => {
      const stageMatches = [...(matchesByStage.get(stage) ?? [])].sort((a, b) => a.id - b.id);
      const expectedMatches = STAGE_TEAM_COUNTS[stage] / 2;
      const prevStage = stageIdx > 0 ? activeStages[stageIdx - 1] : null;
      const prevStageMatches = prevStage
        ? [...(matchesByStage.get(prevStage) ?? [])].sort((a, b) => a.id - b.id)
        : [];
      const defaultSeedLabels = defaultSeedLabelsByStage.get(stage) ?? [];

      const seededPlaceholders = Array.from({ length: expectedMatches }, (_, idx) => {
        if (!prevStage) {
          const defaultSeed = defaultSeedLabels[idx];
          return {
            seedA: defaultSeed?.seedA ?? "Por definir",
            seedB: defaultSeed?.seedB ?? "Por definir",
          };
        }
        const left = prevStageMatches[idx * 2];
        const right = prevStageMatches[idx * 2 + 1];
        const leftWinner = left?.winner_team_id ?? null;
        const rightWinner = right?.winner_team_id ?? null;
        return {
          seedA: leftWinner ? getTeamLabel(leftWinner) : "Por definir",
          seedB: rightWinner ? getTeamLabel(rightWinner) : "Por definir",
        };
      });

      stageMatches.forEach((match, idx) => {
        const seed = seededPlaceholders[idx];
        if (seed) map.set(match.id, seed);
      });
    });

    return map;
  }, [activeStages, defaultSeedLabelsByStage, matchesByStage]);

  const finalWinner = useMemo(() => {
    const finals = matchesByStageAll.get("final") ?? [];
    const finalMatch = finals.find(
      (match) => match.status === "played" && match.winner_team_id
    );
    if (!finalMatch || !finalMatch.winner_team_id) return null;
    const team = teamsById.get(finalMatch.winner_team_id);
    const names = team?.players?.map((player) => player.name).filter(Boolean) ?? [];
    const name = names.length > 0 ? names.join(" / ") : `Team #${finalMatch.winner_team_id}`;
    return name;
  }, [matchesByStageAll, teamsById]);

  const playoffSectionVisible = hasPlayoffs;
  const showGroupsContent = showGroups || activeSection === "groups";
  const showMatchesTab = true;
  const showResultsTab = true;
  const showGroupMatchesOnly = hasOnlyScheduledPlayoffs;
  const showMatchesSectionDesktop = !hasPlayoffs || hasOnlyScheduledPlayoffs;
  const pendingMatchesForSection = showGroupMatchesOnly ? pendingGroupMatches : pendingMatches;
  const playedMatchesForSection = showGroupMatchesOnly ? playedGroupMatches : playedMatches;

  function getMatchTeamLabel(match: Match, side: "a" | "b") {
    const teamId = side === "a" ? match.team_a_id : match.team_b_id;
    if (typeof teamId === "number") return getTeamLabel(teamId);
    if (match.stage === "group") return "Por definir";
    const seedLabel = playoffSeedLabelByMatchId.get(match.id);
    if (!seedLabel) return "Por definir";
    return side === "a" ? seedLabel.seedA : seedLabel.seedB;
  }

  function renderMatchRow(match: Match) {
    const group = match.group_id ? groupsById.get(match.group_id) : null;
    const stage = match.stage === "group" ? group?.name ?? "Zona" : stageLabel(match.stage);
    const teamALabel = getMatchTeamLabel(match, "a");
    const teamBLabel = getMatchTeamLabel(match, "b");
    const hasTeams = hasDefinedTeams(match);
    const winnerId = match.winner_team_id;
    const schedule = formatSchedule(match.scheduled_date, match.scheduled_time);
    const court = formatCourt(match.court_number);
    const scheduleMeta = [schedule, court].filter(Boolean).join(" · ");

    return (
      <div
        key={match.id}
        className={`rounded-xl p-3 shadow-sm shadow-black/10 ${
          match.status === "played" ? "bg-emerald-100/70" : "bg-zinc-200"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-zinc-700">
            {stage} · {getMatchCode(match)}
          </div>
          {scheduleMeta ? (
            <div className="rounded-full border border-emerald-600/80 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
              {scheduleMeta}
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className={hasTeams && winnerId === match.team_a_id ? "font-semibold text-emerald-700" : ""}>
            {teamALabel}
          </span>
          <span className="text-zinc-600">vs</span>
          <span className={hasTeams && winnerId === match.team_b_id ? "font-semibold text-emerald-700" : ""}>
            {teamBLabel}
          </span>
          <span className="text-zinc-500">|</span>
          <span className="font-semibold text-zinc-700">
            {match.status === "played" && hasTeams ? formatSets(match.sets) : "-"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3 pr-20 sm:gap-4 sm:pr-24 md:pr-0">
          {tournament?.club_logo_url ? (
            <img
              src={tournament.club_logo_url}
              alt={tournament.club_name ?? "Logo del club"}
              className="h-12 w-12 rounded-2xl border border-zinc-800 object-cover sm:h-14 sm:w-14"
            />
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {tournament ? tournament.name : "Torneo"}
            </h1>
            {tournament?.start_date ? (
              <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
                {`Fecha de inicio: ${formatShortDate(tournament.start_date)}`}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              {tournament?.club_name ? tournament.club_name : "Club"}
              {tournament?.location ? (
                <>
                  {" · "}
                  <a
                    href={tournament.location}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-200 hover:text-emerald-100"
                  >
                    Ver ubicacion
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="absolute right-0 top-0 md:static md:ml-auto">
          <StatusBadge status={status} className="text-[10px] sm:text-xs" />
        </div>
      </div>

      {descriptionText ? (
        <Card className="bg-white/95">
          <div className="p-4 sm:p-5">
            <div className={`relative ${isLongDescription && !isDescriptionExpanded ? "max-h-28 overflow-hidden sm:max-h-36" : ""}`}>
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                {descriptionContent}
              </div>
              {isLongDescription && !isDescriptionExpanded ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/95 to-transparent" />
              ) : null}
            </div>
            {isLongDescription ? (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-600"
              >
                {isDescriptionExpanded ? "Ver menos" : "Ver descripcion completa"}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="sticky top-0 z-20 -mx-4 bg-transparent px-4 pb-3 pt-2 backdrop-blur sm:static sm:mx-0 sm:px-0 sm:pb-0 sm:pt-0 sm:backdrop-blur-0">
        <Card className="bg-transparent text-zinc-100 shadow-none ring-0 border-none">
          <div className="p-4 sm:p-5">
            <div className="text-sm font-medium text-zinc-700">Buscar jugador o pareja</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: Juan / Pedro"
              />
              {divisions.length > 0 && (
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 sm:w-auto"
                  value={divisionFilter}
                  onChange={(e) =>
                    setDivisionFilter(e.target.value === "all" ? "all" : e.target.value)
                  }
                >
                  <option value="all">Todas las categorias</option>
                  {divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
              )}
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setDivisionFilter("all");
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 sm:w-auto"
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

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
              <div className="p-4 sm:p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  🏆 Pareja ganadora
                </div>
                <div className="mt-2 rounded-2xl border border-emerald-300 bg-emerald-100/70 px-4 py-3 text-lg font-semibold text-emerald-900">
                  {finalWinner}
                </div>
              </div>
            </Card>
          )}

          <div className="sm:hidden">
            <div className="rounded-2xl border border-zinc-200 bg-white p-2 text-sm text-zinc-600">
              <div
                className={`grid gap-2 ${
                  playoffSectionVisible ? "grid-cols-4" : "grid-cols-3"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSection("groups")}
                  className={`min-h-[44px] rounded-xl border px-3 py-2.5 font-semibold transition ${
                    activeSection === "groups"
                      ? "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-600"
                  }`}
                >
                  Zonas
                </button>
                {showMatchesTab && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("matches")}
                    className={`min-h-[44px] rounded-xl border px-3 py-2.5 font-semibold transition ${
                      activeSection === "matches"
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    Partidos
                  </button>
                )}
                {showResultsTab && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("results")}
                    className={`min-h-[44px] rounded-xl border px-3 py-2.5 font-semibold transition ${
                      activeSection === "results"
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    Resultados
                  </button>
                )}
                {playoffSectionVisible && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("playoffs")}
                    className={`min-h-[44px] rounded-xl border px-3 py-2.5 font-semibold transition ${
                      activeSection === "playoffs"
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm"
                        : "border-zinc-200 bg-white text-zinc-600"
                    }`}
                  >
                    Playoffs
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className={activeSection === "playoffs" ? "block" : "hidden sm:block"}>
            {playoffSectionVisible && (
              <>
                <div className="sm:hidden">
                  <Card className="bg-white/95">
                    <div className="space-y-4 p-4">
                      <div className="text-sm font-semibold text-zinc-800">
                        Playoffs
                      </div>
                      {!hasFilteredPlayoffs ? (
                        <div className="text-sm text-zinc-400">
                          No hay partidos para este filtro.
                        </div>
                      ) : (
                        activeStages.map((stage) => {
                          const stageMatches = [...(matchesByStage.get(stage) ?? [])].sort(
                            (a, b) => a.id - b.id
                          );
                          if (stageMatches.length === 0) return null;
                          const isCollapsed = collapsedStages[stage] ?? false;
                          return (
                            <div key={stage} className="space-y-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedStages((prev) => ({
                                    ...prev,
                                    [stage]: !isCollapsed,
                                  }))
                                }
                                className="flex w-full items-center justify-between rounded-lg bg-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-700"
                              >
                                <span>{stageLabel(stage)}</span>
                                <span
                                  aria-hidden="true"
                                  className={`inline-block transition-transform ${
                                    isCollapsed ? "rotate-90" : "-rotate-90"
                                  }`}
                                >
                                  &gt;
                                </span>
                              </button>
                              <div
                                className={`overflow-hidden transition-all duration-300 ${
                                  isCollapsed ? "max-h-0 opacity-0" : "max-h-[1200px] opacity-100"
                                }`}
                              >
                                <div className="space-y-2 py-2">
                                  {stageMatches.map(renderMatchRow)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </Card>
                </div>
                <Card className="hidden bg-white/95 sm:block">
                  <div className="space-y-4 p-4 sm:p-5">
                    <div className="text-sm font-semibold text-zinc-800">
                      Llaves de playoffs
                    </div>
                    {!hasFilteredPlayoffs || !initialStage ? (
                      <div className="text-sm text-zinc-400">
                        No hay partidos para este filtro.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <div
                          className="grid w-full min-w-max gap-8 pb-2"
                          style={{
                            gridTemplateColumns: `repeat(${activeStages.length}, minmax(220px, 1fr))`,
                          }}
                        >
                          {activeStages.map((stage, stageIdx) => {
                            const stageMatches = [...(matchesByStage.get(stage) ?? [])].sort(
                              (a, b) => a.id - b.id
                            );
                            const expectedMatches = STAGE_TEAM_COUNTS[stage] / 2;
                            const prevStage = stageIdx > 0 ? activeStages[stageIdx - 1] : null;
                            const defaultSeedLabels = defaultSeedLabelsByStage.get(stage) ?? [];
                            const prevStageMatches = prevStage
                              ? [...(matchesByStage.get(prevStage) ?? [])].sort(
                                  (a, b) => a.id - b.id
                                )
                              : [];
                            const seededPlaceholders = Array.from(
                              { length: expectedMatches },
                              (_, idx) => {
                                if (!prevStage) {
                                  const defaultSeed = defaultSeedLabels[idx];
                                  return {
                                    type: "placeholder",
                                    key: `${stage}-${idx}`,
                                    seedA: defaultSeed?.seedA ?? "Por definir",
                                    seedB: defaultSeed?.seedB ?? "Por definir",
                                  };
                                }
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
                              <div
                                key={stage}
                                className="w-full min-w-[220px] space-y-3 sm:min-w-[260px]"
                              >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:text-xs">
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
                                      return (
                                        <div
                                          key={`${stage}-placeholder-${idx}`}
                                          className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-400 sm:text-sm"
                                          style={gridStyle}
                                        >
                                          <div className="text-xs uppercase tracking-[0.12em]">
                                            Por definir
                                          </div>
                                          <div className="mt-2 text-xs text-zinc-600 sm:text-sm">
                                            {item.seedA}
                                          </div>
                                          <div className="text-xs text-zinc-400">vs</div>
                                          <div className="text-xs text-zinc-600 sm:text-sm">
                                            {item.seedB}
                                          </div>
                                        </div>
                                      );
                                    }

                                    if (!("match" in item)) {
                                      return null;
                                    }

                                    const match = item.match;
                                    const played = match.status === "played";
                                    const schedule = formatSchedule(
                                      match.scheduled_date,
                                      match.scheduled_time
                                    );
                                    const court = formatCourt(match.court_number);
                                    const scheduleMeta = [schedule, court].filter(Boolean).join(" · ");
                                    const hasScheduleMeta = !!scheduleMeta;
                                    const scoreA = played ? formatSetLine(match.sets, "a") : "";
                                    const scoreB = played ? formatSetLine(match.sets, "b") : "";
                                    const hasTeams = hasDefinedTeams(match);
                                    const aWinner = hasTeams && match.winner_team_id === match.team_a_id;
                                    const bWinner = hasTeams && match.winner_team_id === match.team_b_id;
                                    const teamALabel = hasTeams
                                      ? getTeamLabel(match.team_a_id)
                                      : item.seedA;
                                    const teamBLabel = hasTeams
                                      ? getTeamLabel(match.team_b_id)
                                      : item.seedB;
                                    return (
                                      <div
                                        key={match.id}
                                        className={`rounded-2xl border px-3 py-2 text-xs shadow-sm sm:text-sm ${
                                          played
                                            ? "border-emerald-300 bg-emerald-100/70"
                                            : "border-zinc-200 bg-white"
                                        }`}
                                        style={gridStyle}
                                      >
                                        <div className="text-xs text-zinc-500">
                                          Partido {getMatchCode(match)}
                                        </div>
                                        <div className="mt-1 space-y-1">
                                          <div className="flex items-center justify-between gap-2">
                                            <div
                                              className={`font-medium text-zinc-900 ${
                                                hasTeams && match.winner_team_id === match.team_a_id
                                                  ? "font-semibold"
                                                  : ""
                                              }`}
                                            >
                                              {teamALabel}
                                            </div>
                                            {played && (
                                              <div
                                                className={`text-xs text-right sm:text-sm ${
                                                  aWinner
                                                    ? "font-semibold text-zinc-900"
                                                    : "font-normal text-zinc-400"
                                                }`}
                                              >
                                                {scoreA}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-between gap-2">
                                            <div
                                              className={`font-medium text-zinc-900 ${
                                                hasTeams && match.winner_team_id === match.team_b_id
                                                  ? "font-semibold"
                                                  : ""
                                              }`}
                                            >
                                              {teamBLabel}
                                            </div>
                                            {played && (
                                              <div
                                                className={`text-xs text-right sm:text-sm ${
                                                  bWinner
                                                    ? "font-semibold text-zinc-900"
                                                    : "font-normal text-zinc-400"
                                                }`}
                                              >
                                                {scoreB}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        {played && (
                                          <div className="mt-1 h-px w-full bg-emerald-400/70" />
                                        )}
                                        {!played && hasScheduleMeta && (
                                          <div className="mt-1 h-px w-full bg-zinc-800" />
                                        )}
                                        {hasScheduleMeta ? (
                                          <div className="mt-1 text-xs text-zinc-500">
                                            {scheduleMeta}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </>
            )}
          </div>

          <div className={activeSection === "groups" ? "space-y-4" : "hidden space-y-4 sm:block"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold sm:text-xl">Zonas y posiciones</h2>
              {hasPlayoffs && (
                <button
                  type="button"
                  onClick={() => setShowGroups((prev) => !prev)}
                  className="hidden text-sm font-semibold text-emerald-200 hover:text-emerald-100 sm:inline-flex"
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
            ) : showGroupsContent ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredGroups.map((group) => {
                  const standings = standingsByGroup[group.id]?.standings ?? [];
                  return (
                    <Card key={group.id}>
                      <div className="space-y-4 p-4 sm:p-5">
                        <div className="text-sm font-semibold text-zinc-800">{group.name}</div>

                        <div className="space-y-2 sm:hidden">
                          {standings.map((row) => {
                            const teamLabel =
                              row.team.players.map((player) => player.name).join(" / ") ||
                              `Team #${row.team.id}`;
                            return (
                              <div
                                key={row.team.id}
                                className="rounded-xl border border-zinc-200 bg-zinc-50 p-3"
                              >
                                <div className="text-sm font-semibold text-zinc-800">
                                  {teamLabel}
                                </div>
                                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px] text-zinc-600">
                                  <div>
                                    <div className="uppercase tracking-[0.12em] text-zinc-400">
                                      PJ
                                    </div>
                                    <div className="font-semibold text-zinc-800">
                                      {row.played}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="uppercase tracking-[0.12em] text-zinc-400">
                                      PG
                                    </div>
                                    <div className="font-semibold text-zinc-800">{row.won}</div>
                                  </div>
                                  <div>
                                    <div className="uppercase tracking-[0.12em] text-zinc-400">
                                      PP
                                    </div>
                                    <div className="font-semibold text-zinc-800">{row.lost}</div>
                                  </div>
                                  <div>
                                    <div className="uppercase tracking-[0.12em] text-zinc-400">
                                      Pts
                                    </div>
                                    <div className="font-semibold text-zinc-800">
                                      {row.points}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 text-[11px]">
                                  <span className="font-semibold text-zinc-500">Dif sets </span>
                                  <span className={`font-semibold ${diffTextColor(row.set_diff)}`}>
                                    {formatDiff(row.set_diff)}
                                  </span>
                                  <span className="text-zinc-400"> · </span>
                                  <span className="font-semibold text-zinc-500">Dif games </span>
                                  <span className={`font-semibold ${diffTextColor(row.game_diff)}`}>
                                    {formatDiff(row.game_diff)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="hidden overflow-x-auto sm:block">
                          <table className="min-w-[520px] text-xs sm:min-w-full sm:text-sm">
                            <thead>
                              <tr className="text-left text-zinc-500">
                                <th className="py-1.5 sm:py-2">Equipo</th>
                                <th className="py-1.5 sm:py-2">PJ</th>
                                <th className="py-1.5 sm:py-2">PG</th>
                                <th className="py-1.5 sm:py-2">PP</th>
                                <th className="py-1.5 sm:py-2">Dif sets</th>
                                <th className="py-1.5 sm:py-2">Dif games</th>
                                <th className="py-1.5 sm:py-2">Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {standings.map((row) => {
                                const teamLabel =
                                  row.team.players.map((player) => player.name).join(" / ") ||
                                  `Team #${row.team.id}`;
                                return (
                                  <tr key={row.team.id} className="border-t border-zinc-800">
                                    <td className="py-1.5 font-medium sm:py-2">{teamLabel}</td>
                                    <td className="py-1.5 sm:py-2">{row.played}</td>
                                    <td className="py-1.5 sm:py-2">{row.won}</td>
                                    <td className="py-1.5 sm:py-2">{row.lost}</td>
                                    <td className="py-1.5 sm:py-2">{formatDiff(row.set_diff)}</td>
                                    <td className="py-1.5 sm:py-2">{formatDiff(row.game_diff)}</td>
                                    <td className="py-1.5 font-semibold sm:py-2">{row.points}</td>
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

          <div
            className={
              activeSection === "matches" || activeSection === "results"
                ? "space-y-4"
                : showMatchesSectionDesktop
                ? "hidden space-y-4 sm:block"
                : "hidden space-y-4 sm:hidden"
            }
          >
            <h2 className="text-lg font-semibold sm:text-xl">
              {activeSection === "results"
                ? "Resultados"
                : showGroupMatchesOnly
                ? "Partidos de zonas"
                : "Partidos"}
            </h2>

            {activeSection === "matches" && (
              <div className="space-y-4 sm:hidden">
                <Card>
                  <div className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-zinc-800">Proximos</div>
                    {pendingMatchesForSection.length === 0 ? (
                      <div className="text-sm text-zinc-400">
                        {showGroupMatchesOnly
                          ? "No hay partidos de zona pendientes."
                          : "No hay partidos pendientes."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pendingMatchesForSection.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {activeSection === "results" && (
              <div className="space-y-4 sm:hidden">
                <Card>
                  <div className="space-y-3 p-4">
                    <div className="text-sm font-semibold text-zinc-800">Resultados</div>
                    {playedMatchesForSection.length === 0 ? (
                      <div className="text-sm text-zinc-400">
                        {showGroupMatchesOnly
                          ? "No hay resultados de zona cargados."
                          : "No hay resultados cargados."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {playedMatchesForSection.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {showMatchesSectionDesktop && (
              <div className="hidden gap-4 lg:grid lg:grid-cols-2 sm:grid">
                <Card>
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="text-sm font-semibold text-zinc-800">Proximos</div>
                    {pendingMatchesForSection.length === 0 ? (
                      <div className="text-sm text-zinc-400">
                        {showGroupMatchesOnly
                          ? "No hay partidos de zona pendientes."
                          : "No hay partidos pendientes."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingMatchesForSection.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
                <Card>
                  <div className="space-y-3 p-4 sm:p-5">
                    <div className="text-sm font-semibold text-zinc-800">Resultados</div>
                    {playedMatchesForSection.length === 0 ? (
                      <div className="text-sm text-zinc-400">
                        {showGroupMatchesOnly
                          ? "No hay resultados de zona cargados."
                          : "No hay resultados cargados."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {playedMatchesForSection.map(renderMatchRow)}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
