"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { api } from "@/lib/api";
import type {
  GenerateGroupsResponse,
  Team,
  TournamentGroupOut,
  TournamentStatus,
} from "@/lib/types";

type ManualZone = {
  id: string;
  name: string;
  teamIds: number[];
};

const TEAM_SIZE_OPTIONS = [3, 4, 5, 6] as const;

function getTeamCategory(team: Team) {
  return team.players[0]?.category ?? null;
}

function getTeamGender(team: Team) {
  return team.players[0]?.gender ?? null;
}

function getDivisionLabel(team: Team) {
  const category = getTeamCategory(team) ?? "Sin categoria";
  const gender = getTeamGender(team);
  const genderLabel =
    gender === "damas"
      ? "Damas"
      : gender === "masculino"
      ? "Masculino"
      : gender ?? "Sin genero";
  return `${category} - ${genderLabel}`;
}

function getGenderLabel(gender: string | null) {
  if (gender === "damas") return "Damas";
  if (gender === "masculino") return "Masculino";
  return gender ?? "Sin genero";
}

function getTeamDivisionKey(team: Team) {
  return `${getTeamCategory(team) ?? ""}::${getTeamGender(team) ?? ""}`;
}

type Props = {
  tournamentId: number;
  competitionType: "tournament" | "league" | "flash";
  status: TournamentStatus;
  groups: TournamentGroupOut[];
  teams: Team[];
  setGroups: React.Dispatch<React.SetStateAction<TournamentGroupOut[]>>;
  teamsPerGroup: number;
  setTeamsPerGroup: (n: number) => void;
  generating: boolean;
  onGenerateWithAi: (payload: {
    teams_per_group: number;
    schedule_windows: {
      date: string;
      start_time: string;
      end_time: string;
    }[];
    match_duration_minutes: number;
    courts_count: number;
  }) => Promise<GenerateGroupsResponse>;
  onCancelGenerateWithAi: () => void;
  onGenerateManual: (payload: {
    teams_per_group: number;
    groups: { name?: string; team_ids: number[] }[];
  }) => Promise<void>;
  defaultStartDate: string;
  defaultStartTime: string;
  defaultEndTime: string;
  defaultMatchDurationMinutes: number;
  defaultCourtsCount: number;
  onAllGroupsGenerated?: () => void;
};

export type GroupsPanelHandle = {
  openGenerateModal: () => void;
};

const GroupsPanel = forwardRef<GroupsPanelHandle, Props>(function GroupsPanel({
  tournamentId,
  competitionType,
  status,
  groups,
  teams,
  setGroups,
  teamsPerGroup,
  setTeamsPerGroup,
  generating,
  onGenerateWithAi,
  onCancelGenerateWithAi,
  onGenerateManual,
  defaultStartDate,
  defaultStartTime,
  defaultEndTime,
  defaultMatchDurationMinutes,
  defaultCourtsCount,
  onAllGroupsGenerated,
}: Props, ref) {
  const disabled = status !== "upcoming";
  const aiEnabled = competitionType === "tournament";

  const [removing, setRemoving] = useState<{
    groupId: number;
    teamId: number;
  } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTeamId, setMoveTeamId] = useState<number | "">("");
  const [moveSourceGroupId, setMoveSourceGroupId] = useState<number | null>(null);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<number | "">("");
  const [moveSwapTeamId, setMoveSwapTeamId] = useState<number | "">("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateScheduleWindows, setGenerateScheduleWindows] = useState<
    { date: string; start_time: string; end_time: string }[]
  >([{ date: defaultStartDate, start_time: defaultStartTime, end_time: defaultEndTime }]);
  const [generateMatchDuration, setGenerateMatchDuration] = useState(
    defaultMatchDurationMinutes
  );
  const [generateCourtsCount, setGenerateCourtsCount] = useState(defaultCourtsCount);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [showAllGeneratedNotice, setShowAllGeneratedNotice] = useState(false);
  const [activeGeneration, setActiveGeneration] = useState<"ai" | "manual" | null>(null);
  const [aiDots, setAiDots] = useState(".");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualZones, setManualZones] = useState<ManualZone[]>([
    { id: "manual-zone-1", name: "Grupo 1", teamIds: [] },
  ]);
  const [manualSelectedZoneId, setManualSelectedZoneId] = useState("manual-zone-1");
  const [manualCategory, setManualCategory] = useState<string | "all">("all");
  const [manualGender, setManualGender] = useState<string | "all">("all");
  const [manualSelectedTeamIds, setManualSelectedTeamIds] = useState<number[]>([]);
  const [manualError, setManualError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");

  function isAbortError(err: unknown) {
    return err instanceof Error && err.name === "AbortError";
  }

  const categories = useMemo(() => {
    const values = new Set<string>();
    groups.forEach((group) => {
      group.teams.forEach((team) => {
        team.players.forEach((player) => {
          if (player.category) values.add(player.category);
        });
      });
    });
    return Array.from(values).sort();
  }, [groups]);
  const genders = useMemo(() => {
    const values = new Set<string>();
    groups.forEach((group) => {
      group.teams.forEach((team) => {
        team.players.forEach((player) => {
          if (player.gender) values.add(player.gender);
        });
      });
    });
    return Array.from(values).sort();
  }, [groups]);
  const manualCategories = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      const category = getTeamCategory(team);
      if (category) values.add(category);
    });
    return Array.from(values).sort();
  }, [teams]);
  const manualGenders = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      const gender = getTeamGender(team);
      if (gender) values.add(gender);
    });
    return Array.from(values).sort();
  }, [teams]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const categoryMatch =
        categoryFilter === "all" ||
        group.teams.some((team) =>
          team.players.some((player) => player.category === categoryFilter)
        );
      const genderMatch =
        genderFilter === "all" ||
        group.teams.some((team) =>
          team.players.some((player) => player.gender === genderFilter)
        );
      return categoryMatch && genderMatch;
    });
  }, [groups, categoryFilter, genderFilter]);
  const persistedAssignedTeamIds = useMemo(() => {
    return new Set(groups.flatMap((group) => group.teams.map((team) => team.id)));
  }, [groups]);
  const assignedManualTeamIds = useMemo(() => {
    return new Set(manualZones.flatMap((zone) => zone.teamIds));
  }, [manualZones]);
  const combinedAssignedTeamIds = useMemo(() => {
    const values = new Set<number>(persistedAssignedTeamIds);
    assignedManualTeamIds.forEach((id) => values.add(id));
    return values;
  }, [persistedAssignedTeamIds, assignedManualTeamIds]);
  const availableManualTeams = useMemo(() => {
    return teams.filter((team) => !combinedAssignedTeamIds.has(team.id));
  }, [teams, combinedAssignedTeamIds]);
  const filteredManualTeams = useMemo(() => {
    return availableManualTeams.filter((team) => {
      const categoryMatch =
        manualCategory === "all" || getTeamCategory(team) === manualCategory;
      const genderMatch = manualGender === "all" || getTeamGender(team) === manualGender;
      return categoryMatch && genderMatch;
    });
  }, [availableManualTeams, manualCategory, manualGender]);

  useEffect(() => {
    if (!generating) {
      setActiveGeneration(null);
      return;
    }
    if (activeGeneration !== "ai") {
      setAiDots(".");
      return;
    }
    const frames = [".", "..", "..."];
    let frameIndex = 0;
    const intervalId = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      setAiDots(frames[frameIndex]);
    }, 350);
    return () => window.clearInterval(intervalId);
  }, [generating, activeGeneration]);

  function getAiGeneratingLabel() {
    return (
      <span className="inline-flex items-center">
        <span>Generando con IA</span>
        <span className="inline-block w-6 text-left font-mono">{aiDots}</span>
      </span>
    );
  }

  function closeGenerateModal() {
    if (generating && activeGeneration === "ai") {
      onCancelGenerateWithAi();
      setGenerateError("Generacion cancelada por el usuario.");
    }
    setGenerateOpen(false);
  }
  const manualMissingByDivision = useMemo(() => {
    const counts = new Map<string, { category: string | null; gender: string | null; count: number }>();
    teams.forEach((team) => {
      if (combinedAssignedTeamIds.has(team.id)) return;
      const category = getTeamCategory(team);
      const gender = getTeamGender(team);
      const key = `${category ?? ""}::${gender ?? ""}`;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, { category, gender, count: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => {
      const aCategory = a.category ?? "";
      const bCategory = b.category ?? "";
      if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
      return (a.gender ?? "").localeCompare(b.gender ?? "");
    });
  }, [teams, combinedAssignedTeamIds]);
  const persistedMissingByDivision = useMemo(() => {
    const counts = new Map<string, { category: string | null; gender: string | null; count: number }>();
    teams.forEach((team) => {
      if (persistedAssignedTeamIds.has(team.id)) return;
      const category = getTeamCategory(team);
      const gender = getTeamGender(team);
      const key = `${category ?? ""}::${gender ?? ""}`;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, { category, gender, count: 1 });
      }
    });
    return Array.from(counts.values()).sort((a, b) => {
      const aCategory = a.category ?? "";
      const bCategory = b.category ?? "";
      if (aCategory !== bCategory) return aCategory.localeCompare(bCategory);
      return (a.gender ?? "").localeCompare(b.gender ?? "");
    });
  }, [teams, persistedAssignedTeamIds]);
  const allDivisionsGenerated =
    teams.length > 0 && groups.length > 0 && persistedMissingByDivision.length === 0;
  const prevAllDivisionsGeneratedRef = useRef(allDivisionsGenerated);
  const generationLockedMessage =
    "Ya generaste el 100% de las zonas posibles. Si queres ajustar, move parejas entre zonas.";
  const firstPendingDivision = manualMissingByDivision[0] ?? null;
  const filteredManualTeamIds = useMemo(() => {
    return new Set(filteredManualTeams.map((team) => team.id));
  }, [filteredManualTeams]);
  const selectedManualZone = useMemo(() => {
    return manualZones.find((zone) => zone.id === manualSelectedZoneId) ?? null;
  }, [manualZones, manualSelectedZoneId]);
  const manualTeamsById = useMemo(() => {
    return new Map(teams.map((team) => [team.id, team]));
  }, [teams]);
  const manualAssignedCount = useMemo(() => {
    return manualZones.reduce((acc, zone) => acc + zone.teamIds.length, 0);
  }, [manualZones]);
  const manualPoolTotal = manualAssignedCount + availableManualTeams.length;
  const manualProgressPercent =
    manualPoolTotal > 0 ? Math.round((manualAssignedCount / manualPoolTotal) * 100) : 0;
  const manualReadyZonesCount = useMemo(() => {
    return manualZones.filter((zone) => zone.teamIds.length >= 2).length;
  }, [manualZones]);
  const selectedZoneDivisionKey = useMemo(() => {
    if (!selectedManualZone || selectedManualZone.teamIds.length === 0) return null;
    const team = manualTeamsById.get(selectedManualZone.teamIds[0]);
    return team ? getTeamDivisionKey(team) : null;
  }, [selectedManualZone, manualTeamsById]);
  const selectedZoneDivisionLabel = useMemo(() => {
    if (!selectedZoneDivisionKey) return null;
    const team = selectedManualZone?.teamIds.length
      ? manualTeamsById.get(selectedManualZone.teamIds[0])
      : null;
    return team ? getDivisionLabel(team) : null;
  }, [selectedZoneDivisionKey, selectedManualZone, manualTeamsById]);
  const selectedManualDivisionKeys = useMemo(() => {
    const values = new Set<string>();
    manualSelectedTeamIds.forEach((teamId) => {
      const team = manualTeamsById.get(teamId);
      if (!team) return;
      values.add(getTeamDivisionKey(team));
    });
    return values;
  }, [manualSelectedTeamIds, manualTeamsById]);
  const selectedTeamsMixDivisions = selectedManualDivisionKeys.size > 1;
  const selectedTeamsInvalidForZone = useMemo(() => {
    if (!selectedZoneDivisionKey) return [];
    return manualSelectedTeamIds.filter((teamId) => {
      const team = manualTeamsById.get(teamId);
      if (!team) return false;
      return getTeamDivisionKey(team) !== selectedZoneDivisionKey;
    });
  }, [manualSelectedTeamIds, manualTeamsById, selectedZoneDivisionKey]);
  const canAddSelectedTeamsToZone =
    !!selectedManualZone &&
    manualSelectedTeamIds.length > 0 &&
    !selectedTeamsMixDivisions &&
    selectedTeamsInvalidForZone.length === 0;
  const canSubmitManualGenerate = useMemo(() => {
    const nonEmptyZones = manualZones.filter((zone) => zone.teamIds.length > 0);
    if (nonEmptyZones.length === 0) return false;
    for (const zone of nonEmptyZones) {
      if (zone.teamIds.length < 2) return false;
      const divisions = new Set(
        zone.teamIds.map((teamId) => {
          const team = manualTeamsById.get(teamId);
          return team ? getTeamDivisionKey(team) : "";
        })
      );
      if (divisions.size > 1) return false;
    }
    return true;
  }, [manualZones, manualTeamsById]);

  useImperativeHandle(
    ref,
    () => ({
      openGenerateModal: () => {
        if (disabled || generating || allDivisionsGenerated) return;
        setManualOpen(true);
      },
    }),
    [disabled, generating, allDivisionsGenerated]
  );

  useEffect(() => {
    if (!generateOpen) return;
    setGenerateScheduleWindows([
      { date: defaultStartDate, start_time: defaultStartTime, end_time: defaultEndTime },
    ]);
    setGenerateMatchDuration(defaultMatchDurationMinutes);
    setGenerateCourtsCount(defaultCourtsCount);
    setGenerateError(null);
    setGenerateSuccess(null);
  }, [
    generateOpen,
    defaultStartDate,
    defaultStartTime,
    defaultEndTime,
    defaultMatchDurationMinutes,
    defaultCourtsCount,
  ]);
  useEffect(() => {
    if (TEAM_SIZE_OPTIONS.some((value) => value === teamsPerGroup)) {
      return;
    }
    setTeamsPerGroup(TEAM_SIZE_OPTIONS[0]);
  }, [teamsPerGroup, setTeamsPerGroup]);
  useEffect(() => {
    if (!manualOpen) return;
    setManualZones([{ id: "manual-zone-1", name: "Grupo 1", teamIds: [] }]);
    setManualSelectedZoneId("manual-zone-1");
    setManualCategory(firstPendingDivision?.category ?? "all");
    setManualGender(firstPendingDivision?.gender ?? "all");
    setManualSelectedTeamIds([]);
    setManualError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualOpen]);
  useEffect(() => {
    setManualSelectedTeamIds((prev) =>
      prev.filter((teamId) => filteredManualTeamIds.has(teamId))
    );
  }, [filteredManualTeamIds]);
  useEffect(() => {
    if (!manualOpen || !allDivisionsGenerated || !generateSuccess) return;
    const timeoutId = window.setTimeout(() => {
      setManualOpen(false);
    }, 1500);
    return () => window.clearTimeout(timeoutId);
  }, [manualOpen, allDivisionsGenerated, generateSuccess]);
  useEffect(() => {
    if (!allDivisionsGenerated || !generateSuccess) return;
    onAllGroupsGenerated?.();
  }, [allDivisionsGenerated, generateSuccess, onAllGroupsGenerated]);
  useEffect(() => {
    if (!prevAllDivisionsGeneratedRef.current && allDivisionsGenerated) {
      setShowAllGeneratedNotice(true);
    }
    prevAllDivisionsGeneratedRef.current = allDivisionsGenerated;
  }, [allDivisionsGenerated]);
  useEffect(() => {
    if (!showAllGeneratedNotice) return;
    const timeoutId = window.setTimeout(() => {
      setShowAllGeneratedNotice(false);
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [showAllGeneratedNotice]);

  function updateScheduleWindow(
    index: number,
    key: "date" | "start_time" | "end_time",
    value: string
  ) {
    setGenerateScheduleWindows((prev) =>
      prev.map((window, idx) =>
        idx === index ? { ...window, [key]: value } : window
      )
    );
  }

  function addScheduleWindow() {
    setGenerateScheduleWindows((prev) => {
      const last = prev[prev.length - 1];
      if (!last?.date) {
        return [...prev, { date: "", start_time: defaultStartTime, end_time: defaultEndTime }];
      }
      const base = new Date(`${last.date}T00:00:00`);
      base.setDate(base.getDate() + 1);
      const nextDate = base.toISOString().slice(0, 10);
      return [
        ...prev,
        { date: nextDate, start_time: defaultStartTime, end_time: defaultEndTime },
      ];
    });
  }

  function removeScheduleWindow(index: number) {
    setGenerateScheduleWindows((prev) => prev.filter((_, idx) => idx !== index));
  }

  function parseTimeToMinutes(value: string) {
    const parts = value.split(":");
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  }

  const requiredMatches = useMemo(() => {
    if (teamsPerGroup <= 1) return 0;
    const counts = new Map<string, number>();
    teams.forEach((team) => {
      const first = team.players[0];
      const category = first?.category ?? "sin_categoria";
      const gender = first?.gender ?? "sin_genero";
      const key = `${category}::${gender}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let total = 0;
    counts.forEach((count) => {
      const fullGroups = Math.floor(count / teamsPerGroup);
      const remainder = count % teamsPerGroup;
      total += (fullGroups * teamsPerGroup * (teamsPerGroup - 1)) / 2;
      if (remainder > 1) {
        total += (remainder * (remainder - 1)) / 2;
      }
    });
    return total;
  }, [teams, teamsPerGroup]);

  const availableSlots = useMemo(() => {
    if (generateMatchDuration <= 0 || generateCourtsCount <= 0) return 0;
    let total = 0;
    for (const window of generateScheduleWindows) {
      if (!window.start_time || !window.end_time) return 0;
      const start = parseTimeToMinutes(window.start_time);
      const end = parseTimeToMinutes(window.end_time);
      if (start === null || end === null) return 0;
      if (end < start) return 0;
      const slotsPerCourt =
        Math.floor((end - start) / generateMatchDuration) + 1;
      total += slotsPerCourt * generateCourtsCount;
    }
    return total;
  }, [generateScheduleWindows, generateMatchDuration, generateCourtsCount]);
  const generateValidation = useMemo(() => {
    const perWindowErrors: string[][] = generateScheduleWindows.map(() => []);

    if (generateScheduleWindows.length === 0) {
      return {
        perWindowErrors,
        issues: ["Agrega al menos un dia para armar las zonas."],
        canSubmit: false,
      };
    }

    const dateIndexes = new Map<string, number[]>();
    for (let index = 0; index < generateScheduleWindows.length; index += 1) {
      const window = generateScheduleWindows[index];
      if (!window.date) {
        perWindowErrors[index].push("Completa la fecha.");
      } else {
        const current = dateIndexes.get(window.date) ?? [];
        current.push(index);
        dateIndexes.set(window.date, current);
      }

      if (!window.start_time || !window.end_time) {
        perWindowErrors[index].push("Completa horario de inicio y fin.");
      } else {
        const [startHour, startMinute] = window.start_time.split(":").map(Number);
        const [endHour, endMinute] = window.end_time.split(":").map(Number);
        const start = startHour * 60 + startMinute;
        const end = endHour * 60 + endMinute;
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          perWindowErrors[index].push("El horario ingresado no es valido.");
        } else if (end < start) {
          perWindowErrors[index].push(
            "El horario de fin no puede ser menor al horario de inicio."
          );
        }
      }
    }

    dateIndexes.forEach((indexes) => {
      if (indexes.length < 2) return;
      indexes.forEach((index) => {
        perWindowErrors[index].push("La fecha esta repetida.");
      });
    });

    const issues = perWindowErrors.flatMap((errors, index) =>
      errors.map((error) => `Dia ${index + 1}: ${error}`)
    );

    if (generateMatchDuration <= 0 || generateCourtsCount <= 0) {
      issues.push("Duracion y canchas deben ser mayores a 0.");
    }

    if (
      issues.length === 0 &&
      requiredMatches > 0 &&
      availableSlots < requiredMatches
    ) {
      issues.push(
        `No hay slots suficientes. Requeridos: ${requiredMatches}. Disponibles: ${availableSlots}.`
      );
    }

    return {
      perWindowErrors,
      issues,
      canSubmit: issues.length === 0,
    };
  }, [
    generateScheduleWindows,
    generateMatchDuration,
    generateCourtsCount,
    requiredMatches,
    availableSlots,
  ]);
  const generateFeasibility = useMemo(() => {
    if (requiredMatches <= 0) {
      return {
        tone: "neutral" as const,
        label: "Sin demanda",
        detail: "Todavia no hay partidos calculados para programar.",
      };
    }
    const extraSlots = availableSlots - requiredMatches;
    if (extraSlots < 0) {
      return {
        tone: "bad" as const,
        label: "Insuficiente",
        detail: `Faltan ${Math.abs(extraSlots)} slots para cubrir los partidos.`,
      };
    }
    const tightMargin = Math.max(2, Math.ceil(requiredMatches * 0.1));
    if (extraSlots <= tightMargin) {
      return {
        tone: "warn" as const,
        label: "Justo",
        detail: "La programacion entra con poco margen ante cambios o reprogramaciones.",
      };
    }
    return {
      tone: "good" as const,
      label: "OK",
      detail: `Hay margen de ${extraSlots} slots sobre los partidos requeridos.`,
    };
  }, [requiredMatches, availableSlots]);

  const allTeams = useMemo(() => {
    return groups.flatMap((group) =>
      group.teams.map((team) => ({
        ...team,
        group_id: group.id,
        group_name: group.name,
      }))
    );
  }, [groups]);

  const capacity = useMemo(() => {
    if (teamsPerGroup) return teamsPerGroup;
    return Math.max(1, ...groups.map((group) => group.teams.length));
  }, [teamsPerGroup, groups]);

  const selectedTargetGroup = useMemo(() => {
    if (moveTargetGroupId === "") return null;
    return groups.find((group) => group.id === moveTargetGroupId) ?? null;
  }, [groups, moveTargetGroupId]);

  const targetIsFull = selectedTargetGroup
    ? selectedTargetGroup.teams.length >= capacity
    : false;

  function getTeamLabel(team: { id: number; players: { name: string }[] }) {
    return team.players.map((p) => p.name).join(" / ") || `Team #${team.id}`;
  }

  async function removeTeamFromGroup(
    groupId: number,
    team: { id: number; players: { name: string }[] },
    groupName: string
  ) {
    if (status !== "upcoming") return;

    const teamLabel = team.players.map((p) => p.name).join(" / ");

    const confirmed = window.confirm(
      `Estás por eliminar la pareja:\n\n${teamLabel}\n\n` +
        `de la zona ${groupName}.\n\n¿Deseás continuar?`
    );

    if (!confirmed) return;

    setRemoving({ groupId, teamId: team.id });

    try {
      await api(
        `/tournaments/${tournamentId}/groups/${groupId}/teams/${team.id}`,
        { method: "DELETE" }
      );

      const updatedGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(updatedGroups);
    } catch (err: any) {
      alert(err?.message ?? "No se pudo quitar el equipo de la zona");
    } finally {
      setRemoving(null);
    }
  }

  async function removeEmptyGroup(groupId: number, groupName: string) {
    if (status !== "upcoming") return;

    const confirmed = window.confirm(
      `Vas a eliminar la zona ${groupName}.\n\n¿Deseás continuar?`
    );

    if (!confirmed) return;

    try {
      await api(`/tournaments/${tournamentId}/groups/${groupId}`, {
        method: "DELETE",
      });

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err: any) {
      alert(err?.message ?? "No se pudo eliminar la zona");
    }
  }

  function openMoveModal(teamId: number, sourceGroupId: number, targetGroupId?: number) {
    setMoveTeamId(teamId);
    setMoveSourceGroupId(sourceGroupId);
    setMoveTargetGroupId(targetGroupId ?? "");
    setMoveSwapTeamId("");
    setMoveError(null);
    setMoveOpen(true);
  }

  function updateMoveTeam(teamId: number | "") {
    setMoveTeamId(teamId);
    if (teamId === "") {
      setMoveSourceGroupId(null);
      return;
    }
    const team = allTeams.find((t) => t.id === teamId);
    setMoveSourceGroupId(team?.group_id ?? null);
  }

  function applyMoveLocally(
    teamId: number,
    sourceGroupId: number,
    targetGroupId: number,
    swapTeamId: number | null
  ) {
    setGroups((prev) => {
      const source = prev.find((g) => g.id === sourceGroupId);
      const target = prev.find((g) => g.id === targetGroupId);
      if (!source || !target) return prev;

      const teamToMove = source.teams.find((t) => t.id === teamId);
      if (!teamToMove) return prev;

      const swapTeam = swapTeamId
        ? target.teams.find((t) => t.id === swapTeamId)
        : null;

      return prev.map((group) => {
        if (group.id === sourceGroupId) {
          const remaining = group.teams.filter((t) => t.id !== teamId);
          return {
            ...group,
            teams: swapTeam ? [swapTeam, ...remaining] : remaining,
          };
        }
        if (group.id === targetGroupId) {
          const remaining = group.teams.filter((t) => t.id !== swapTeamId);
          return {
            ...group,
            teams: [teamToMove, ...remaining],
          };
        }
        return group;
      });
    });
  }

  async function submitMove() {
    if (moveTeamId === "" || moveTargetGroupId === "" || moveSourceGroupId === null) {
      setMoveError("Selecciona equipo y zona destino.");
      return;
    }

    if (moveSourceGroupId === moveTargetGroupId) {
      setMoveError("La zona destino debe ser distinta.");
      return;
    }

    const targetGroup = groups.find((group) => group.id === moveTargetGroupId);
    if (!targetGroup) {
      setMoveError("Zona destino invalida.");
      return;
    }

    const targetIsFull = targetGroup.teams.length >= capacity;
    if (targetIsFull && moveSwapTeamId === "") {
      setMoveError("La zona destino esta completa. Selecciona una pareja para intercambiar.");
      return;
    }

    setMoving(true);
    setMoveError(null);
    const swapId = moveSwapTeamId === "" ? null : moveSwapTeamId;
    const prevGroups = groups;
    applyMoveLocally(moveTeamId, moveSourceGroupId, moveTargetGroupId, swapId);
    setMoveOpen(false);

    try {
      await api(
        `/tournaments/${tournamentId}/groups/${moveSourceGroupId}/teams/${moveTeamId}/move`,
        {
          method: "POST",
          body: {
            target_group_id: moveTargetGroupId,
            swap_team_id: swapId,
          },
        }
      );
      const updatedGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(updatedGroups);
    } catch (err: any) {
      setGroups(prevGroups);
      setMoveError(err?.message ?? "No se pudo mover el equipo");
    } finally {
      setMoving(false);
    }
  }

  async function submitGenerate() {
    if (!aiEnabled) {
      setGenerateError("La generación con IA está disponible solo para competencias tipo torneo.");
      return;
    }
    if (allDivisionsGenerated) {
      setGenerateError(generationLockedMessage);
      return;
    }
    if (!generateValidation.canSubmit) {
      setGenerateError(generateValidation.issues[0] ?? "Revisa la configuracion.");
      return;
    }

    setGenerateError(null);
    setGenerateSuccess(null);
    setActiveGeneration("ai");
    try {
      await onGenerateWithAi({
        teams_per_group: teamsPerGroup,
        schedule_windows: generateScheduleWindows,
        match_duration_minutes: generateMatchDuration,
        courts_count: generateCourtsCount,
      });
      setGenerateSuccess("Zonas generadas con exito.");
      setGenerateOpen(false);
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setGenerateError("Generacion cancelada por el usuario.");
        return;
      }
      setGenerateError(err instanceof Error ? err.message : "No se pudo generar zonas");
    }
  }

  function updateManualZonesCount(nextCountRaw: number) {
    const nextCount = Math.max(1, Math.min(20, Math.trunc(nextCountRaw || 1)));
    setManualError(null);
    setManualZones((prev) => {
      if (nextCount === prev.length) return prev;

      if (nextCount < prev.length) {
        const removed = prev.slice(nextCount);
        const hasTeamsInRemoved = removed.some((zone) => zone.teamIds.length > 0);
        if (hasTeamsInRemoved) {
          setManualError(
            "Para reducir la cantidad de zonas, primero vacia las zonas que sobran."
          );
          return prev;
        }
        const trimmed = prev.slice(0, nextCount);
        if (!trimmed.some((zone) => zone.id === manualSelectedZoneId)) {
          setManualSelectedZoneId(trimmed[0]?.id ?? "");
        }
        return trimmed;
      }

      const expanded = [...prev];
      for (let index = prev.length; index < nextCount; index += 1) {
        expanded.push({
          id: `manual-zone-${index + 1}`,
          name: `Grupo ${index + 1}`,
          teamIds: [],
        });
      }
      return expanded;
    });
  }

  function toggleManualTeamSelection(teamId: number) {
    setManualSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
    setManualError(null);
  }

  function addManualTeamsToZone() {
    if (!selectedManualZone) {
      setManualError("Selecciona una zona.");
      return;
    }
    if (manualSelectedTeamIds.length === 0) {
      setManualError("Selecciona al menos una pareja.");
      return;
    }
    if (selectedTeamsMixDivisions) {
      setManualError("Seleccionaste parejas de distintas divisiones. Separalas antes de agregar.");
      return;
    }
    if (selectedTeamsInvalidForZone.length > 0) {
      setManualError(
        `La zona seleccionada es ${selectedZoneDivisionLabel ?? "de otra division"}. ` +
          "Solo podes agregar parejas de la misma categoria y genero."
      );
      return;
    }

    setManualZones((prev) =>
      {
        const currentZoneIndex = prev.findIndex((zone) => zone.id === selectedManualZone.id);
        const nextZones = prev.map((zone) =>
        zone.id === selectedManualZone.id
          ? { ...zone, teamIds: [...zone.teamIds, ...manualSelectedTeamIds] }
          : zone
        );
        const nextEmptyZone = nextZones.find(
          (zone, idx) => idx > currentZoneIndex && zone.teamIds.length === 0
        );
        if (nextEmptyZone) {
          setManualSelectedZoneId(nextEmptyZone.id);
        }
        return nextZones;
      }
    );
    setManualSelectedTeamIds([]);
    setManualError(null);
  }

  function removeManualTeamFromZone(zoneId: string, teamId: number) {
    setManualZones((prev) =>
      prev.map((zone) =>
        zone.id === zoneId
          ? { ...zone, teamIds: zone.teamIds.filter((id) => id !== teamId) }
          : zone
      )
    );
  }

  async function submitManualGenerate() {
    if (allDivisionsGenerated) {
      setManualError(generationLockedMessage);
      return;
    }
    const nonEmptyZones = manualZones.filter((zone) => zone.teamIds.length > 0);
    if (nonEmptyZones.length === 0) {
      setManualError("Agrega al menos una pareja a una zona.");
      return;
    }

    for (const zone of nonEmptyZones) {
      if (zone.teamIds.length < 2) {
        setManualError(
          `La zona ${zone.name} debe tener al menos 2 parejas.`
        );
        return;
      }
      const divisions = new Set(
        zone.teamIds.map((teamId) => {
          const team = manualTeamsById.get(teamId);
          return team ? `${getTeamCategory(team) ?? ""}::${getTeamGender(team) ?? ""}` : "";
        })
      );
      if (divisions.size > 1) {
        setManualError(
          `La zona ${zone.name} mezcla categorias o generos. Separalas antes de continuar.`
        );
        return;
      }
    }

    setManualError(null);
    setGenerateSuccess(null);
    setActiveGeneration("manual");
    try {
      await onGenerateManual({
        teams_per_group: teamsPerGroup,
        groups: nonEmptyZones.map((zone) => ({
          team_ids: zone.teamIds,
        })),
      });
      setGenerateSuccess("Zonas guardadas manualmente. Podes continuar con otra categoria.");
      setManualZones([{ id: "manual-zone-1", name: "Grupo 1", teamIds: [] }]);
      setManualSelectedZoneId("manual-zone-1");
      setManualSelectedTeamIds([]);
      if (firstPendingDivision?.category) {
        setManualCategory(firstPendingDivision.category);
      } else {
        setManualCategory("all");
      }
      if (firstPendingDivision?.gender) {
        setManualGender(firstPendingDivision.gender);
      } else {
        setManualGender("all");
      }
    } catch (err: unknown) {
      setManualError(
        err instanceof Error ? err.message : "No se pudo generar zonas manualmente"
      );
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetGroupId: number) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as { teamId: number; groupId: number };
      if (parsed.groupId === targetGroupId) return;
      openMoveModal(parsed.teamId, parsed.groupId, targetGroupId);
    } catch {
      // ignore invalid payload
    }
  }

  return (
    <Card className="bg-white/95">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-800">Zona de grupos</div>
            <div className="text-xs text-zinc-600">
              {aiEnabled
                ? "Genera zonas manualmente o en forma automatica con IA"
                : "Genera zonas manualmente. La IA se usa solo en competencias tipo torneo."}
            </div>
            <div
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                allDivisionsGenerated
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  allDivisionsGenerated ? "bg-emerald-500" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              {allDivisionsGenerated ? "Zonas generadas" : "Zonas pendientes"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Navegacion
              </span>
              <Button
                variant="secondary"
                onClick={() => window.location.assign(`/tournaments/${tournamentId}/matches`)}
              >
                Ver partidos
              </Button>
            </div>

            <div className="hidden h-6 w-px bg-zinc-200 md:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Acciones
              </span>
              {allDivisionsGenerated ? (
                <Button
                  onClick={() => window.location.assign(`/tournaments/${tournamentId}/matches`)}
                >
                  Ir a cargar partidos
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => setManualOpen(true)}
                    disabled={disabled || generating}
                  >
                    {generating ? "Generando..." : "Generar zonas"}
                  </Button>
                  {aiEnabled && (
                    <Button
                      variant="secondary"
                      onClick={() => setGenerateOpen(true)}
                      disabled={disabled || generating}
                    >
                      {generating && activeGeneration === "ai"
                        ? getAiGeneratingLabel()
                        : "Generar zonas con IA"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {generateSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {generateSuccess}
          </div>
        )}
        {showAllGeneratedNotice && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-900">
            Perfecto: ya generaste todas las zonas para todas las categorias y generos.
          </div>
        )}

        {/* Groups */}
        {(categories.length > 0 || genders.length > 0) && (
          <div className="flex flex-wrap items-center gap-3">
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-700">Categoria</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
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
              </div>
            )}
            {genders.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-700">Genero</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={genderFilter}
                  onChange={(e) =>
                    setGenderFilter(
                      e.target.value === "all" ? "all" : e.target.value
                    )
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
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredGroups.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, g.id)}
            >
              <div className="flex justify-between">
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{g.name.replace(/^Group\s+/i, "Grupo ")}</span>
                  {g.is_incompatible && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      Incompatible
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {status === "upcoming" && g.teams.length === 0 && (
                    <button
                      onClick={() => removeEmptyGroup(g.id, g.name)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      Eliminar
                    </button>
                  )}
                  <Link
                    href={`/groups/${g.id}/standings`}
                    className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                  >
                    Tabla
                  </Link>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {g.teams.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between rounded-xl border border-zinc-200 px-3 py-2"
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData(
                        "application/json",
                        JSON.stringify({ teamId: t.id, groupId: g.id })
                      )
                    }
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Pareja {idx + 1}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {t.players?.[0]?.name ?? "Jugador"}
                      </div>
                      <div className="text-sm text-zinc-700">
                        {t.players?.[1]?.name ?? "Jugador"}
                      </div>
                    </div>

                    {status === "upcoming" && (
                      <button
                        onClick={() =>
                          removeTeamFromGroup(g.id, t, g.name)
                        }
                        disabled={
                          removing?.groupId === g.id &&
                          removing?.teamId === t.id
                        }
                        className="rounded-lg p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        title="Quitar equipo de la zona"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {aiEnabled && (
        <Modal
          open={generateOpen}
          title="Generar zonas con IA"
          onClose={closeGenerateModal}
          className="max-w-3xl h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="flex h-[calc(90vh-120px)] flex-col gap-4 overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="sticky top-0 z-10 space-y-3 rounded-xl border border-zinc-200 bg-white/95 p-3 backdrop-blur">
                <div className="text-sm text-zinc-600">
                  Definí la ventana horaria para programar los partidos de grupos.
                  Duracion y canchas se toman desde la configuracion de la competencia.
                </div>
              <div className="grid gap-2 text-xs text-zinc-700 md:grid-cols-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  Equipos cargados:{" "}
                  <span className="font-semibold text-zinc-900">{teams.length}</span>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  Equipos por zona:{" "}
                  <span className="font-semibold text-zinc-900">{teamsPerGroup}</span>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  Partidos requeridos:{" "}
                  <span className="font-semibold text-zinc-900">{requiredMatches}</span>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5">
                  Slots disponibles:{" "}
                  <span className="font-semibold text-zinc-900">{availableSlots}</span>
                </div>
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  generateFeasibility.tone === "good"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : generateFeasibility.tone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : generateFeasibility.tone === "bad"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                }`}
              >
                <span className="font-semibold">{generateFeasibility.label}</span>
                {": "}
                {generateFeasibility.detail}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500">
                Equipos por zona
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={teamsPerGroup}
                onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
                disabled={generating}
              >
                {TEAM_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-500">
                  Ventanas horarias
                </div>
                <Button
                  variant="secondary"
                  onClick={addScheduleWindow}
                  disabled={generating}
                >
                  Agregar dia
                </Button>
              </div>

              <div className="space-y-3">
                {generateScheduleWindows.map((window, index) => {
                  const windowErrors = generateValidation.perWindowErrors[index] ?? [];
                  return (
                    <div
                      key={`${window.date}-${index}`}
                      className={`rounded-xl border p-3 ${
                        windowErrors.length > 0
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="mb-2 text-xs font-semibold text-zinc-600">
                        Dia {index + 1}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="grid flex-1 gap-2 md:grid-cols-3">
                          <Input
                            type="date"
                            value={window.date}
                            onChange={(e) =>
                              updateScheduleWindow(index, "date", e.target.value)
                            }
                          />
                          <Input
                            type="time"
                            value={window.start_time}
                            onChange={(e) =>
                              updateScheduleWindow(index, "start_time", e.target.value)
                            }
                          />
                          <Input
                            type="time"
                            value={window.end_time}
                            onChange={(e) =>
                              updateScheduleWindow(index, "end_time", e.target.value)
                            }
                          />
                        </div>
                        {generateScheduleWindows.length > 1 && (
                          <Button
                            variant="secondary"
                            onClick={() => removeScheduleWindow(index)}
                            disabled={generating}
                          >
                            Quitar
                          </Button>
                        )}
                      </div>
                      {windowErrors.length > 0 && (
                        <div className="mt-2 text-xs text-amber-800">
                          {windowErrors.join(" ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              Duracion configurada:{" "}
              <span className="font-semibold">{generateMatchDuration} min</span>
              {" · "}
              Canchas configuradas:{" "}
              <span className="font-semibold">{generateCourtsCount}</span>
            </div>

            {generateValidation.issues.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-100 p-3 text-xs text-amber-900">
                {generateValidation.issues[0]}
              </div>
            )}

            {generateError && (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {generateError}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
            <Button variant="secondary" onClick={closeGenerateModal}>
              Cancelar
            </Button>
            <Button
              onClick={submitGenerate}
              disabled={generating || !generateValidation.canSubmit || allDivisionsGenerated}
            >
              {generating && activeGeneration === "ai"
                ? getAiGeneratingLabel()
                : "Generar zonas ahora"}
            </Button>
          </div>
          </div>
        </Modal>
      )}

      <Modal
        open={manualOpen}
        title="Generar zonas manualmente"
        onClose={() => setManualOpen(false)}
        className="max-w-4xl h-[94vh] max-h-[94vh] overflow-hidden"
      >
        <div className="flex h-[calc(94vh-120px)] flex-col gap-4 overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="text-sm text-zinc-600">
              Elegir categoria y agregar cada pareja a su zona.
            </div>
            {allDivisionsGenerated && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-100 p-3 text-sm text-emerald-900">
                Ya estan generadas todas las zonas para todas las categorias y generos.
              </div>
            )}

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-600">
                <span>
                  Parejas asignadas:{" "}
                  <span className="font-semibold text-zinc-900">
                    {manualAssignedCount}/{manualPoolTotal}
                  </span>
                </span>
              <span>
                Zonas listas ({">="}2 parejas):{" "}
                <span className="font-semibold text-zinc-900">
                  {manualReadyZonesCount}/{manualZones.length}
                </span>
              </span>
            </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-all"
                  style={{ width: `${manualProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold text-zinc-500">Categoria</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value === "all" ? "all" : e.target.value)}
                >
                  <option value="all">Todas</option>
                  {manualCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-xs font-semibold text-zinc-500">Genero</label>
                <select
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                  value={manualGender}
                  onChange={(e) => setManualGender(e.target.value === "all" ? "all" : e.target.value)}
                >
                  <option value="all">Todos</option>
                  {manualGenders.map((gender) => (
                    <option key={gender} value={gender}>
                      {gender === "damas" ? "Damas" : "Masculino"}
                    </option>
                  ))}
                </select>
              </div>
            <div className="min-w-0 space-y-2">
              <label className="text-xs font-semibold text-zinc-500">Cantidad de zonas</label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={manualZones.length}
                onChange={(e) => updateManualZonesCount(Number(e.target.value))}
              >
                {Array.from({ length: 20 }, (_, idx) => idx + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              </div>
            </div>
            {manualMissingByDivision.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                Pendientes por asignar:{" "}
                {manualMissingByDivision
                  .map(
                    (item) =>
                      `${item.category ?? "Sin categoria"} ${getGenderLabel(item.gender)} (${item.count})`
                  )
                  .join(" · ")}
              </div>
            )}

            <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-zinc-500">Zona activa</label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={manualSelectedZoneId}
                onChange={(e) => setManualSelectedZoneId(e.target.value)}
              >
                  {manualZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} ({zone.teamIds.length})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {selectedZoneDivisionLabel && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
                La zona seleccionada usa division:{" "}
                <span className="font-semibold text-zinc-900">{selectedZoneDivisionLabel}</span>
              </div>
            )}
            {selectedTeamsMixDivisions && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Las parejas seleccionadas mezclan categorias o genero. Selecciona una sola division.
              </div>
            )}
            {!selectedTeamsMixDivisions && selectedTeamsInvalidForZone.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                La seleccion no coincide con la division de la zona actual.
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500">Parejas disponibles</label>
                <span className="text-xs text-zinc-500">
                  {filteredManualTeams.length} disponibles
                </span>
              </div>
              {filteredManualTeams.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500">
                  No hay parejas disponibles para los filtros seleccionados.
                </div>
              ) : (
                <div className="max-h-40 md:max-h-44 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2">
                  {filteredManualTeams.map((team) => {
                    const checked = manualSelectedTeamIds.includes(team.id);
                    return (
                      <label
                        key={team.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-zinc-900"
                          checked={checked}
                          onChange={() => toggleManualTeamSelection(team.id)}
                        />
                        <span className="text-sm text-zinc-700">
                          {team.players[0]?.name ?? "Jugador"} / {team.players[1]?.name ?? "Jugador"}{" "}
                          <span className="text-zinc-500">({getDivisionLabel(team)})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setManualSelectedTeamIds(filteredManualTeams.map((team) => team.id))}
                disabled={filteredManualTeams.length === 0}
              >
                Seleccionar visibles
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setManualSelectedTeamIds([])}
                disabled={manualSelectedTeamIds.length === 0}
              >
                Limpiar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={addManualTeamsToZone}
                disabled={!canAddSelectedTeamsToZone}
              >
                Agregar parejas seleccionadas
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500">Zonas armadas</label>
                <span className="text-xs text-zinc-500">{manualZones.length} zonas</span>
              </div>
              <div className="h-[220px] md:h-[260px] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                <div className="space-y-2 pr-1">
                  {manualZones.map((zone) => (
                    <div key={zone.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-zinc-800">
                            {zone.name} ({zone.teamIds.length} pareja(s))
                          </div>
                          {(() => {
                            const firstTeam = zone.teamIds.length
                              ? manualTeamsById.get(zone.teamIds[0])
                              : null;
                            const division = firstTeam ? getDivisionLabel(firstTeam) : null;
                            const statusLabel =
                              zone.teamIds.length === 0
                                ? "Pendiente"
                                : zone.teamIds.length === 1
                                  ? "Incompleta"
                                  : "Lista";
                            return (
                              <div className="text-xs text-zinc-500">
                                {division ? `${division} · ` : ""}{statusLabel}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {zone.teamIds.length === 0 ? (
                        <div className="text-xs text-zinc-500">Sin parejas asignadas</div>
                      ) : (
                        <div className="space-y-1">
                          {zone.teamIds.map((teamId) => {
                            const team = teams.find((item) => item.id === teamId);
                            if (!team) return null;
                            return (
                              <div
                                key={`${zone.id}-${teamId}`}
                                className="flex items-center justify-between rounded-lg border border-zinc-200 px-2 py-1 text-sm"
                              >
                                <span>
                                  {team.players[0]?.name ?? "Jugador 1"} /{" "}
                                  {team.players[1]?.name ?? "Jugador 2"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeManualTeamFromZone(zone.id, teamId)}
                                  className="text-xs text-zinc-500 hover:text-zinc-900"
                                >
                                  Quitar
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-200 bg-white pt-3">
            {manualError && (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {manualError}
              </div>
            )}
            {!manualError && !canSubmitManualGenerate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Para generar: cada zona usada debe tener al menos 2 parejas y una sola division.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setManualOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={submitManualGenerate}
                disabled={generating || !canSubmitManualGenerate || allDivisionsGenerated}
              >
                {generating ? "Generando..." : "Generar zonas"}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={moveOpen}
        title="Mover equipo"
        onClose={() => setMoveOpen(false)}
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-600">
            Selecciona la pareja y la zona destino.
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500">Equipo</label>
            <select
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={moveTeamId}
              onChange={(e) => {
                const value = e.target.value;
                updateMoveTeam(value === "" ? "" : Number(value));
              }}
            >
              <option value="">Seleccionar pareja</option>
              {allTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {getTeamLabel(team)} ({team.group_name})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500">Zona destino</label>
            <select
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={moveTargetGroupId}
              onChange={(e) => {
                const value = e.target.value;
                setMoveTargetGroupId(value === "" ? "" : Number(value));
                setMoveSwapTeamId("");
              }}
            >
              <option value="">Seleccionar zona</option>
              {groups.map((group) => {
                const full = group.teams.length >= capacity;
                return (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.teams.length}/{capacity}
                    {full ? ", completa" : ""})
                  </option>
                );
              })}
            </select>
          </div>
          {selectedTargetGroup && targetIsFull && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500">
                Intercambiar con
              </label>
              <select
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                value={moveSwapTeamId}
                onChange={(e) => {
                  const value = e.target.value;
                  setMoveSwapTeamId(value === "" ? "" : Number(value));
                }}
              >
                <option value="">Seleccionar pareja</option>
                {selectedTargetGroup.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {getTeamLabel(team)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {moveError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {moveError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitMove} disabled={moving}>
              {moving ? "Moviendo..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
});

export default GroupsPanel;
