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

  async function handleManualSubmit(payload: { groups: { team_ids: number[] }[] }) {
    setGenerateSuccess(null);
    setActiveGeneration("manual");
    await onGenerateManual({ teams_per_group: teamsPerGroup, ...payload });
    setGenerateSuccess("Zonas guardadas. Podés continuar con otra categoría.");
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

      <ZonesDragModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        teams={teams}
        persistedAssignedIds={persistedAssignedTeamIds}
        allDivisionsGenerated={allDivisionsGenerated}
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
