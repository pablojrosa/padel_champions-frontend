"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ZonesDragModal from "@/components/ZonesDragModal";
import { api } from "@/lib/api";
import type {
  GenerateGroupsResponse,
  Team,
  TournamentGroupOut,
  TournamentStatus,
} from "@/lib/types";

const MIN_TEAMS_PER_GROUP = 2;

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

// ─── Panel DnD sub-components ─────────────────────────────────────────────────

function PanelDragHandle() {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="currentColor"
      className="flex-shrink-0 text-zinc-300 group-hover:text-zinc-400"
      aria-hidden="true"
    >
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  );
}

type PanelTeamCardProps = {
  team: { id: number; players: { name: string }[] };
  groupId: number;
  idx: number;
  status: TournamentStatus;
  onRemove: () => void;
  removing: boolean;
};

function PanelTeamCard({ team, groupId, idx, status, onRemove, removing }: PanelTeamCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel-team:${groupId}:${team.id}`,
    data: { teamId: team.id, groupId },
    disabled: status !== "upcoming",
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.15 : 1,
        transition: isDragging ? "none" : "opacity 0.15s",
      }}
      className="group flex items-start justify-between rounded-xl border border-zinc-200 px-3 py-2"
    >
      <div className="flex items-start gap-2">
        {status === "upcoming" && (
          <button
            {...listeners}
            {...attributes}
            className="mt-1 cursor-grab active:cursor-grabbing touch-none"
            aria-label="Arrastrar"
          >
            <PanelDragHandle />
          </button>
        )}
        <div>
          <div className="text-sm font-medium">Pareja {idx + 1}</div>
          <div className="text-sm text-zinc-700">{team.players?.[0]?.name ?? "Jugador"}</div>
          <div className="text-sm text-zinc-700">{team.players?.[1]?.name ?? "Jugador"}</div>
        </div>
      </div>
      {status === "upcoming" && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="rounded-lg p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50"
          title="Quitar equipo de la zona"
        >
          🗑️
        </button>
      )}
    </div>
  );
}

type PanelGroupDropZoneProps = {
  group: TournamentGroupOut;
  children: React.ReactNode;
};

function PanelGroupDropZone({ group, children }: PanelGroupDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: `panel-group:${group.id}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border p-4 shadow-sm transition-all duration-150 ${
        isOver
          ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-200"
          : "border-zinc-200 bg-white"
      }`}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
    teams_per_group_by_division: { category: string; gender: string; teams_per_group: number }[];
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
  openGenerateAiModal: () => void;
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
  const [divisionTeamsPerGroup, setDivisionTeamsPerGroup] = useState<Record<string, number>>({});
  const [generateScheduleWindows, setGenerateScheduleWindows] = useState<
    { date: string; start_time: string; end_time: string }[]
  >([{ date: defaultStartDate, start_time: defaultStartTime, end_time: defaultEndTime }]);
  const [generateMatchDuration, setGenerateMatchDuration] = useState(
    defaultMatchDurationMinutes
  );
  const [generateCourtsCount, setGenerateCourtsCount] = useState(defaultCourtsCount);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const [generateSuccessModalOpen, setGenerateSuccessModalOpen] = useState(false);
  const [showAllGeneratedNotice, setShowAllGeneratedNotice] = useState(false);
  const [activeGeneration, setActiveGeneration] = useState<"ai" | "manual" | null>(null);
  const [aiDots, setAiDots] = useState(".");
  const [manualOpen, setManualOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string | "all">("all");
  const [panelDragActiveId, setPanelDragActiveId] = useState<string | null>(null);

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

  function goToMatches() {
    window.location.assign(`/tournaments/${tournamentId}/matches`);
  }

  function closeGenerateSuccessModal() {
    setGenerateSuccessModalOpen(false);
  }
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
  const firstPendingDivision = persistedMissingByDivision[0] ?? null;

  useImperativeHandle(
    ref,
    () => ({
      openGenerateModal: () => {
        if (disabled || generating) return;
        setManualOpen(true);
      },
      openGenerateAiModal: () => {
        if (disabled || generating || !aiEnabled) return;
        setGenerateOpen(true);
      },
    }),
    [disabled, generating, aiEnabled]
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
    // Initialize per-division teams_per_group from registered teams
    const initial: Record<string, number> = {};
    teams.forEach((team) => {
      const cat = team.players[0]?.category ?? "sin_categoria";
      const gen = team.players[0]?.gender ?? "sin_genero";
      const key = `${cat}::${gen}`;
      if (!(key in initial)) {
        initial[key] = teamsPerGroup >= MIN_TEAMS_PER_GROUP ? teamsPerGroup : MIN_TEAMS_PER_GROUP;
      }
    });
    setDivisionTeamsPerGroup(initial);
  }, [
    generateOpen,
    defaultStartDate,
    defaultStartTime,
    defaultEndTime,
    defaultMatchDurationMinutes,
    defaultCourtsCount,
    // intentionally omit teams and teamsPerGroup: only initialize on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);
  useEffect(() => {
    if (Number.isFinite(teamsPerGroup) && teamsPerGroup >= MIN_TEAMS_PER_GROUP) {
      return;
    }
    setTeamsPerGroup(MIN_TEAMS_PER_GROUP);
  }, [teamsPerGroup, setTeamsPerGroup]);
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

  function decrementTeamsPerGroup() {
    setTeamsPerGroup(Math.max(MIN_TEAMS_PER_GROUP, teamsPerGroup - 1));
  }

  function incrementTeamsPerGroup() {
    setTeamsPerGroup(Math.min(maxTeamsPerGroup, teamsPerGroup + 1));
  }

  // Per-division helpers for the AI modal
  const divisions = useMemo(() => {
    const map = new Map<string, { category: string; gender: string; count: number }>();
    teams.forEach((team) => {
      const cat = team.players[0]?.category ?? "sin_categoria";
      const gen = team.players[0]?.gender ?? "sin_genero";
      const key = `${cat}::${gen}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, { category: cat, gender: gen, count: 1 });
      }
    });
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [teams]);

  function getDivisionTpg(key: string): number {
    return divisionTeamsPerGroup[key] ?? MIN_TEAMS_PER_GROUP;
  }

  function setDivisionTpg(key: string, value: number) {
    setDivisionTeamsPerGroup((prev) => ({ ...prev, [key]: value }));
  }

  function getZonesPreview(count: number, tpg: number): string {
    const full = Math.floor(count / tpg);
    const remainder = count % tpg;
    if (remainder === 0) return `${full} zona${full !== 1 ? "s" : ""} de ${tpg}`;
    if (full === 0) return `1 zona de ${remainder}`;
    return `${full} zona${full !== 1 ? "s" : ""} de ${tpg} + 1 de ${remainder}`;
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
    const counts = new Map<string, number>();
    teams.forEach((team) => {
      const first = team.players[0];
      const category = first?.category ?? "sin_categoria";
      const gender = first?.gender ?? "sin_genero";
      const key = `${category}::${gender}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    let total = 0;
    counts.forEach((count, key) => {
      const tpg = divisionTeamsPerGroup[key] ?? MIN_TEAMS_PER_GROUP;
      if (tpg <= 1) return;
      const fullGroups = Math.floor(count / tpg);
      const remainder = count % tpg;
      total += (fullGroups * tpg * (tpg - 1)) / 2;
      if (remainder > 1) {
        total += (remainder * (remainder - 1)) / 2;
      }
    });
    return total;
  }, [teams, divisionTeamsPerGroup]);

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
      issues.push("Duración y canchas deben ser mayores a 0.");
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
      label: "Perfecto",
      detail: `Hay margen de ${extraSlots} slots sobre los partidos requeridos.`,
    };
  }, [requiredMatches, availableSlots]);
  const maxTeamsPerGroup = useMemo(
    () => Math.max(MIN_TEAMS_PER_GROUP, teams.length || 0),
    [teams.length]
  );

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

  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

  async function deleteGroupWithTeams(groupId: number, groupName: string) {
    if (status !== "upcoming") return;

    const confirmed = window.confirm(
      `Vas a eliminar la zona "${groupName}" y liberar todas sus parejas.\n\n¿Deseás continuar?`
    );

    if (!confirmed) return;

    setDeletingGroupId(groupId);
    try {
      await api(`/tournaments/${tournamentId}/groups/${groupId}?force=true`, {
        method: "DELETE",
      });
      const updatedGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(updatedGroups);
    } catch (err: any) {
      alert(err?.message ?? "No se pudo eliminar la zona");
    } finally {
      setDeletingGroupId(null);
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
      setGenerateError("Ya generaste el 100% de las zonas posibles. Si queres ajustar, move parejas entre zonas.");
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
        teams_per_group_by_division: divisions.map(({ category, gender, key }) => ({
          category,
          gender,
          teams_per_group: getDivisionTpg(key),
        })),
        schedule_windows: generateScheduleWindows,
        match_duration_minutes: generateMatchDuration,
        courts_count: generateCourtsCount,
      });
      setGenerateSuccess("Zonas generadas con exito.");
      setGenerateOpen(false);
      setGenerateSuccessModalOpen(true);
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setGenerateError("Generacion cancelada por el usuario.");
        return;
      }
      setGenerateError(err instanceof Error ? err.message : "No se pudo generar zonas");
    }
  }

  async function handleManualSubmit(payload: { groups: { team_ids: number[] }[] }) {
    setGenerateSuccess(null);
    setActiveGeneration("manual");
    await onGenerateManual({ teams_per_group: teamsPerGroup, ...payload });
    setGenerateSuccess("Zonas guardadas. Puedes continuar con otra categoria.");
  }

  const panelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handlePanelDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setPanelDragActiveId(null);
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (!activeId.startsWith("panel-team:")) return;
    const [, groupIdStr, teamIdStr] = activeId.split(":");
    const sourceGroupId = parseInt(groupIdStr);
    const teamId = parseInt(teamIdStr);
    let targetGroupId: number;
    if (overId.startsWith("panel-group:")) {
      targetGroupId = parseInt(overId.replace("panel-group:", ""));
    } else if (overId.startsWith("panel-team:")) {
      targetGroupId = parseInt(overId.split(":")[1]);
    } else {
      return;
    }
    if (sourceGroupId === targetGroupId) return;
    openMoveModal(teamId, sourceGroupId, targetGroupId);
  }

  // Get team data for panel drag overlay
  const panelDragTeam = useMemo(() => {
    if (!panelDragActiveId || !panelDragActiveId.startsWith("panel-team:")) return null;
    const teamId = parseInt(panelDragActiveId.split(":")[2]);
    return allTeams.find((t) => t.id === teamId) ?? null;
  }, [panelDragActiveId, allTeams]);

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
              <Button
                variant="secondary"
                onClick={goToMatches}
              >
                Ver partidos
              </Button>
            </div>

            <div className="hidden h-6 w-px bg-zinc-200 md:block" />

            <div className="flex items-center gap-2">
              {!disabled && (
                <>
                  <Button
                    onClick={() => setManualOpen(true)}
                    disabled={generating}
                  >
                    {generating ? "Generando..." : "Generar zonas"}
                  </Button>
                  {aiEnabled && (
                    <Button
                      variant="secondary"
                      onClick={() => setGenerateOpen(true)}
                      disabled={generating}
                    >
                      {generating && activeGeneration === "ai"
                        ? getAiGeneratingLabel()
                        : "Generar zonas con IA"}
                    </Button>
                  )}
                </>
              )}
              {allDivisionsGenerated && (
                <Button
                  variant={disabled ? "primary" : "secondary"}
                  onClick={goToMatches}
                >
                  Ir a cargar partidos
                </Button>
              )}
            </div>
          </div>
        </div>


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
        <DndContext
          sensors={panelSensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => setPanelDragActiveId(e.active.id as string)}
          onDragEnd={handlePanelDragEnd}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {filteredGroups.map((g) => (
              <PanelGroupDropZone key={g.id} group={g}>
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
                    {status === "upcoming" && (
                      <button
                        onClick={() =>
                          g.teams.length === 0
                            ? removeEmptyGroup(g.id, g.name)
                            : deleteGroupWithTeams(g.id, g.name)
                        }
                        disabled={deletingGroupId === g.id}
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingGroupId === g.id ? "Eliminando..." : "Eliminar zona"}
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
                    <PanelTeamCard
                      key={t.id}
                      team={t}
                      groupId={g.id}
                      idx={idx}
                      status={status}
                      onRemove={() => removeTeamFromGroup(g.id, t, g.name)}
                      removing={removing?.groupId === g.id && removing?.teamId === t.id}
                    />
                  ))}
                </div>
              </PanelGroupDropZone>
            ))}
          </div>
          <DragOverlay
            dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}
          >
            {panelDragTeam ? (
              <div className="flex cursor-grabbing items-start gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 shadow-2xl rotate-1 scale-105">
                <div>
                  <div className="text-sm font-medium">Pareja</div>
                  <div className="text-sm text-zinc-700">{panelDragTeam.players?.[0]?.name ?? "Jugador"}</div>
                  <div className="text-sm text-zinc-700">{panelDragTeam.players?.[1]?.name ?? "Jugador"}</div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {aiEnabled && (
        <Modal
          open={generateOpen}
          title="Generar zonas con IA"
          onClose={closeGenerateModal}
          className="max-w-5xl h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="flex h-[calc(90vh-120px)] flex-col gap-4 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                  <div className="flex flex-col rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-3.5 lg:h-[124px]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                      Configuración
                    </div>
                    <div className="mt-1.5 text-base font-semibold text-zinc-900">
                      Armado de zonas
                    </div>
                    <div className="mt-1 text-sm leading-5 text-zinc-600">
                      Ajusta las parejas por zona y define horarios para los partidos de grupos.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                          Parejas por zona
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">
                          Configura por categoría. Mínimo {MIN_TEAMS_PER_GROUP}.
                        </div>
                      </div>
                      <div className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                        Requerido
                      </div>
                    </div>

                    <div className="space-y-3">
                      {divisions.map(({ key, category, gender, count }) => {
                        const tpg = getDivisionTpg(key);
                        const genderLabel = gender === "damas" ? "Damas" : gender === "masculino" ? "Masculino" : gender;
                        return (
                          <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-zinc-700">
                                  {category} · {genderLabel}
                                </div>
                                <div className="text-[11px] text-zinc-500">{count} pareja{count !== 1 ? "s" : ""} · {getZonesPreview(count, tpg)}</div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setDivisionTpg(key, Math.max(MIN_TEAMS_PER_GROUP, tpg - 1))}
                                  disabled={generating || tpg <= MIN_TEAMS_PER_GROUP}
                                  aria-label={`Restar pareja por zona en ${category} ${genderLabel}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  -
                                </button>
                                <div className="w-8 text-center text-lg font-semibold text-zinc-900">{tpg}</div>
                                <button
                                  type="button"
                                  onClick={() => setDivisionTpg(key, Math.min(count, tpg + 1))}
                                  disabled={generating || tpg >= count}
                                  aria-label={`Sumar pareja por zona en ${category} ${genderLabel}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-lg font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Equipos cargados
                      </div>
                      <div className="mt-1.5 text-2xl font-semibold text-zinc-900">{teams.length}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Partidos requeridos
                      </div>
                      <div className="mt-1.5 text-2xl font-semibold text-zinc-900">{requiredMatches}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Slots disponibles
                      </div>
                      <div className="mt-1.5 text-2xl font-semibold text-zinc-900">{availableSlots}</div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Configuración
                      </div>
                      <div className="mt-1.5 text-sm text-zinc-700">
                        <div>
                          <span className="font-semibold text-zinc-900">{generateMatchDuration} min</span>
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-900">{generateCourtsCount} canchas</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:h-[136px]">
                    <div className="flex-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                        Ventanas horarias
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">
                        Definí días y horarios válidos para programar partidos de grupos.
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div
                        className={`flex min-h-[48px] items-center rounded-2xl border px-4 py-1.5 ${
                          generateFeasibility.tone === "good"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : generateFeasibility.tone === "warn"
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : generateFeasibility.tone === "bad"
                            ? "border-red-200 bg-red-50 text-red-900"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700"
                        }`}
                      >
                        <div className="text-sm font-medium leading-5">
                          {generateFeasibility.detail}
                        </div>
                      </div>
                      <div className="flex items-stretch md:justify-end">
                        <Button
                          variant="secondary"
                          onClick={addScheduleWindow}
                          disabled={generating}
                          className="min-h-[48px] min-w-[140px] shrink-0"
                        >
                          Agregar día
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {generateScheduleWindows.map((window, index) => {
                      const windowErrors = generateValidation.perWindowErrors[index] ?? [];
                      return (
                        <div
                          key={`${window.date}-${index}`}
                          className={`rounded-2xl border p-4 transition-colors ${
                            windowErrors.length > 0
                              ? "border-amber-200 bg-amber-50"
                              : "border-zinc-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-zinc-900">Día {index + 1}</div>
                              <div className="text-xs text-zinc-500">
                                Ventana disponible para programar partidos de grupos.
                              </div>
                            </div>
                            {generateScheduleWindows.length > 1 && (
                              <Button
                                variant="secondary"
                                onClick={() => removeScheduleWindow(index)}
                                disabled={generating}
                                className="px-3"
                              >
                                Quitar
                              </Button>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <label className="space-y-1.5">
                              <span className="text-xs font-medium text-zinc-500">Fecha</span>
                              <Input
                                type="date"
                                value={window.date}
                                onChange={(e) =>
                                  updateScheduleWindow(index, "date", e.target.value)
                                }
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-xs font-medium text-zinc-500">Desde</span>
                              <Input
                                type="time"
                                value={window.start_time}
                                onChange={(e) =>
                                  updateScheduleWindow(index, "start_time", e.target.value)
                                }
                              />
                            </label>
                            <label className="space-y-1.5">
                              <span className="text-xs font-medium text-zinc-500">Hasta</span>
                              <Input
                                type="time"
                                value={window.end_time}
                                onChange={(e) =>
                                  updateScheduleWindow(index, "end_time", e.target.value)
                                }
                              />
                            </label>
                          </div>

                          {windowErrors.length > 0 && (
                            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-xs text-amber-900">
                              {windowErrors.join(" ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {generateValidation.issues.length > 0 && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-950">
                      {generateValidation.issues[0]}
                    </div>
                  )}

                  {generateError && (
                    <div className="rounded-2xl border border-red-300 bg-red-100 p-4 text-sm text-red-800">
                      {generateError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-zinc-500">
                Se usa la duracion y cantidad de canchas ya configuradas en la competencia.
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeGenerateModal}>
                  Cancelar
                </Button>
                <Button
                  onClick={submitGenerate}
                  disabled={generating || !generateValidation.canSubmit}
                >
                  {generating && activeGeneration === "ai"
                    ? getAiGeneratingLabel()
                    : "Generar zonas ahora"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        open={generateSuccessModalOpen}
        title="Generacion completada"
        onClose={closeGenerateSuccessModal}
        className="max-w-md"
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-zinc-900">
                La ejecucion fue exitosa
              </div>
              <div className="mt-1 text-sm leading-6 text-zinc-600">
                Se crearon las zonas y se generaron los partidos correctamente.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeGenerateSuccessModal}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                closeGenerateSuccessModal();
                goToMatches();
              }}
            >
              Ver partidos
            </Button>
          </div>
        </div>
      </Modal>

      <ZonesDragModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        teams={teams}
        persistedAssignedIds={persistedAssignedTeamIds}
        allDivisionsGenerated={allDivisionsGenerated}
        existingGroups={groups}
        generating={generating && activeGeneration === "manual"}
        defaultCategory={firstPendingDivision?.category}
        defaultGender={firstPendingDivision?.gender}
        onSubmit={handleManualSubmit}
      />
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
