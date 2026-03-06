"use client";

import { useState, useMemo, useEffect } from "react";
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
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Team, TournamentGroupOut } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

type ManualZone = {
  id: string;
  name: string;
  teamIds: number[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTeamCategory(team: Team) {
  return team.players[0]?.category ?? null;
}
function getTeamGender(team: Team) {
  return team.players[0]?.gender ?? null;
}
function getDivisionLabel(team: Team) {
  const cat = getTeamCategory(team) ?? "Sin categoría";
  const gen = getTeamGender(team);
  const genLabel =
    gen === "damas" ? "Damas" : gen === "masculino" ? "Masculino" : gen ?? "Sin género";
  return `${cat} - ${genLabel}`;
}
function getDivisionKey(team: Team) {
  return `${getTeamCategory(team) ?? ""}::${getTeamGender(team) ?? ""}`;
}

// ─── Drag handle icon ─────────────────────────────────────────────────────────

function DragHandle({ className = "" }: { className?: string }) {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="currentColor"
      className={className}
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

// ─── Draggable team card ───────────────────────────────────────────────────────

function DraggableTeamCard({
  team,
  fromZoneId,
}: {
  team: Team;
  fromZoneId?: string;
}) {
  const draggableId = fromZoneId
    ? `zoned:${fromZoneId}:${team.id}`
    : `available:${team.id}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { team, fromZoneId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.15 : 1,
        transition: isDragging ? "none" : "opacity 0.15s",
      }}
      {...listeners}
      {...attributes}
      className="group flex cursor-grab items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm select-none hover:border-zinc-300 hover:shadow-md active:cursor-grabbing"
    >
      <DragHandle className="flex-shrink-0 text-zinc-300 group-hover:text-zinc-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-800">
          {team.players[0]?.name ?? "Jugador"} / {team.players[1]?.name ?? "Jugador"}
        </div>
        <div className="text-xs text-zinc-500">{getDivisionLabel(team)}</div>
      </div>
    </div>
  );
}

// ─── Droppable available pool ─────────────────────────────────────────────────

function DroppableAvailablePool({
  children,
  isDraggingFromZone,
}: {
  children: React.ReactNode;
  isDraggingFromZone: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "available-pool" });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-full flex-1 rounded-xl transition-all duration-200 ${
        isOver && isDraggingFromZone
          ? "bg-zinc-100 ring-2 ring-zinc-400 ring-offset-1"
          : ""
      }`}
    >
      {children}
      {isOver && isDraggingFromZone && (
        <div className="mt-1.5 flex h-10 items-center justify-center rounded-xl border border-dashed border-zinc-400 text-xs text-zinc-500">
          Devolver aquí ↑
        </div>
      )}
    </div>
  );
}

// ─── Droppable zone card ───────────────────────────────────────────────────────

function DroppableZone({
  zone,
  teamsById,
  onRemoveTeam,
}: {
  zone: ManualZone;
  teamsById: Map<number, Team>;
  onRemoveTeam: (teamId: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `zone:${zone.id}` });

  const isEmpty = zone.teamIds.length === 0;
  const isReady = zone.teamIds.length >= 2;
  const isIncomplete = zone.teamIds.length === 1;

  const borderClass = isOver
    ? "border-emerald-400 ring-2 ring-emerald-200"
    : isReady
    ? "border-emerald-200"
    : isIncomplete
    ? "border-amber-200"
    : "border-zinc-200";

  const bgClass = isOver
    ? "bg-emerald-50/60"
    : isReady
    ? "bg-emerald-50/20"
    : isIncomplete
    ? "bg-amber-50/20"
    : "bg-white";

  return (
    <div
      ref={setNodeRef}
      className={`rounded-2xl border-2 p-3 transition-all duration-150 ${borderClass} ${bgClass}`}
      style={{ minHeight: 120 }}
    >
      {/* Zone header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">{zone.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">{zone.teamIds.length}</span>
          {isReady && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              ✓ Lista
            </span>
          )}
          {isIncomplete && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Incompleta
            </span>
          )}
        </div>
      </div>

      {/* Zone content */}
      {isEmpty ? (
        <div
          className={`flex h-14 items-center justify-center rounded-xl border border-dashed text-xs transition-all duration-150 ${
            isOver
              ? "border-emerald-400 text-emerald-600 bg-emerald-50"
              : "border-zinc-300 text-zinc-400"
          }`}
        >
          {isOver ? "Soltar aquí ↓" : "Arrastrá acá"}
        </div>
      ) : (
        <div className="space-y-1.5">
          {zone.teamIds.map((teamId) => {
            const team = teamsById.get(teamId);
            if (!team) return null;
            return (
              <div key={`${zone.id}-${teamId}`} className="relative">
                <DraggableTeamCard team={team} fromZoneId={zone.id} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTeam(teamId);
                  }}
                  className="absolute right-1.5 top-1.5 rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
                  title="Quitar de la zona"
                  aria-label="Quitar"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            );
          })}
          {isOver && (
            <div className="flex h-8 items-center justify-center rounded-xl border border-dashed border-emerald-400 text-xs text-emerald-600">
              Soltar aquí ↓
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Floating overlay card during drag ────────────────────────────────────────

function FloatingCard({ team }: { team: Team }) {
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2.5 shadow-2xl ring-1 ring-zinc-200 rotate-2 scale-105 select-none">
      <DragHandle className="flex-shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-zinc-800">
          {team.players[0]?.name ?? "Jugador"} / {team.players[1]?.name ?? "Jugador"}
        </div>
        <div className="text-xs text-zinc-500">{getDivisionLabel(team)}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  teams: Team[];
  persistedAssignedIds: Set<number>;
  allDivisionsGenerated: boolean;
  existingGroups?: TournamentGroupOut[];
  generating: boolean;
  defaultCategory?: string | null;
  defaultGender?: string | null;
  onSubmit: (payload: { groups: { team_ids: number[] }[] }) => Promise<void>;
};

export default function ZonesDragModal({
  open,
  onClose,
  teams,
  persistedAssignedIds,
  allDivisionsGenerated,
  existingGroups = [],
  generating,
  defaultCategory,
  defaultGender,
  onSubmit,
}: Props) {
  const [zonesMap, setZonesMap] = useState<Record<string, ManualZone[]>>({});
  const [category, setCategory] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Current division key and zones (each category+gender combination has its own zones)
  const currentKey = `${category}::${gender}`;
  const zones: ManualZone[] = zonesMap[currentKey] ?? [
    { id: "zone-1", name: "Grupo 1", teamIds: [] },
    { id: "zone-2", name: "Grupo 2", teamIds: [] },
  ];

  // Reset state when modal opens, pre-populating existing group assignments
  useEffect(() => {
    if (!open) return;
    const initialZonesMap: Record<string, ManualZone[]> = {};
    for (const group of existingGroups) {
      if (group.teams.length === 0) continue;
      const firstPlayer = group.teams[0]?.players[0];
      const cat = firstPlayer?.category ?? null;
      const gen = firstPlayer?.gender ?? null;
      const key = `${cat ?? ""}::${gen ?? ""}`;
      if (!initialZonesMap[key]) initialZonesMap[key] = [];
      initialZonesMap[key].push({
        id: `zone-existing-${group.id}`,
        name: group.name,
        teamIds: group.teams.map((t) => t.id),
      });
    }
    setZonesMap(initialZonesMap);
    setCategory(defaultCategory ?? "all");
    setGender(defaultGender ?? "all");
    setError(null);
    setActiveDragId(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update filters when the pending division changes (e.g. after saving a category's zones)
  useEffect(() => {
    if (!open) return;
    setCategory(defaultCategory ?? "all");
    setGender(defaultGender ?? "all");
  }, [defaultCategory, defaultGender]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((t) => {
      const c = getTeamCategory(t);
      if (c) values.add(c);
    });
    return Array.from(values).sort();
  }, [teams]);

  const genders = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((t) => {
      const g = getTeamGender(t);
      if (g) values.add(g);
    });
    return Array.from(values).sort();
  }, [teams]);

  const assignedInZonesIds = useMemo(
    () => new Set(Object.values(zonesMap).flatMap((divZones) => divZones.flatMap((z) => z.teamIds))),
    [zonesMap]
  );

  const availableTeams = useMemo(
    () => teams.filter((t) => !persistedAssignedIds.has(t.id) && !assignedInZonesIds.has(t.id)),
    [teams, persistedAssignedIds, assignedInZonesIds]
  );

  const filteredAvailableTeams = useMemo(
    () =>
      availableTeams.filter((t) => {
        const catMatch = category === "all" || getTeamCategory(t) === category;
        const genMatch = gender === "all" || getTeamGender(t) === gender;
        return catMatch && genMatch;
      }),
    [availableTeams, category, gender]
  );

  const totalPool = teams.filter((t) => !persistedAssignedIds.has(t.id)).length;
  const assignedCount = assignedInZonesIds.size;
  const progressPercent = totalPool > 0 ? Math.round((assignedCount / totalPool) * 100) : 0;
  const readyZones = zones.filter((z) => z.teamIds.length >= 2).length;

  const canSubmit = useMemo(() => {
    const nonEmpty = zones.filter((z) => z.teamIds.length > 0);
    if (nonEmpty.length === 0) return false;
    for (const z of nonEmpty) {
      if (z.teamIds.length < 2) return false;
      const divs = new Set(
        z.teamIds.map((id) => {
          const t = teamsById.get(id);
          return t ? getDivisionKey(t) : "";
        })
      );
      if (divs.size > 1) return false;
    }
    return true;
  }, [zones, teamsById]);

  // Who is being dragged (for overlay)
  const activeDragTeam = useMemo(() => {
    if (!activeDragId) return null;
    if (activeDragId.startsWith("available:")) {
      return teamsById.get(parseInt(activeDragId.split(":")[1])) ?? null;
    }
    if (activeDragId.startsWith("zoned:")) {
      return teamsById.get(parseInt(activeDragId.split(":")[2])) ?? null;
    }
    return null;
  }, [activeDragId, teamsById]);

  const isDraggingFromZone = activeDragId?.startsWith("zoned:") ?? false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith("available:")) {
      const teamId = parseInt(activeId.split(":")[1]);
      if (overId.startsWith("zone:")) {
        addTeamToZone(teamId, overId.replace("zone:", ""));
      }
    } else if (activeId.startsWith("zoned:")) {
      const parts = activeId.split(":");
      const sourceZoneId = parts[1];
      const teamId = parseInt(parts[2]);

      if (overId === "available-pool") {
        removeTeamFromZone(sourceZoneId, teamId);
      } else if (overId.startsWith("zone:")) {
        const targetZoneId = overId.replace("zone:", "");
        if (targetZoneId !== sourceZoneId) moveTeamBetweenZones(teamId, sourceZoneId, targetZoneId);
      } else if (overId.startsWith("zoned:")) {
        const targetZoneId = overId.split(":")[1];
        if (targetZoneId !== sourceZoneId) moveTeamBetweenZones(teamId, sourceZoneId, targetZoneId);
      }
    }
  }

  function setCurrentZones(updater: ManualZone[] | ((prev: ManualZone[]) => ManualZone[])) {
    setZonesMap((prev) => {
      const current: ManualZone[] = prev[currentKey] ?? [
        { id: "zone-1", name: "Grupo 1", teamIds: [] },
        { id: "zone-2", name: "Grupo 2", teamIds: [] },
      ];
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [currentKey]: next };
    });
  }

  function addTeamToZone(teamId: number, zoneId: string) {
    const team = teamsById.get(teamId);
    if (!team) return;
    const zone = zones.find((z) => z.id === zoneId);
    if (!zone) return;
    if (zone.teamIds.length > 0) {
      const existing = teamsById.get(zone.teamIds[0]);
      if (existing && getDivisionKey(existing) !== getDivisionKey(team)) {
        setError(`No podés mezclar divisiones en ${zone.name}.`);
        return;
      }
    }
    setCurrentZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, teamIds: [...z.teamIds, teamId] } : z))
    );
  }

  function removeTeamFromZone(zoneId: string, teamId: number) {
    setCurrentZones((prev) =>
      prev.map((z) =>
        z.id === zoneId ? { ...z, teamIds: z.teamIds.filter((id) => id !== teamId) } : z
      )
    );
  }

  function moveTeamBetweenZones(teamId: number, fromZoneId: string, toZoneId: string) {
    const team = teamsById.get(teamId);
    if (!team) return;
    const toZone = zones.find((z) => z.id === toZoneId);
    if (!toZone) return;
    if (toZone.teamIds.length > 0) {
      const existing = teamsById.get(toZone.teamIds[0]);
      if (existing && getDivisionKey(existing) !== getDivisionKey(team)) {
        setError(`No podés mezclar divisiones en ${toZone.name}.`);
        return;
      }
    }
    setCurrentZones((prev) =>
      prev.map((z) => {
        if (z.id === fromZoneId) return { ...z, teamIds: z.teamIds.filter((id) => id !== teamId) };
        if (z.id === toZoneId) return { ...z, teamIds: [...z.teamIds, teamId] };
        return z;
      })
    );
    setError(null);
  }

  function updateZoneCount(newCount: number) {
    const count = Math.max(1, Math.min(20, newCount));
    if (count < zones.length) {
      const removed = zones.slice(count);
      if (removed.some((z) => z.teamIds.length > 0)) {
        setError("Para reducir zonas, primero vaciá las que sobran.");
        return;
      }
    }
    setCurrentZones((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const expanded = [...prev];
      for (let i = prev.length; i < count; i++) {
        expanded.push({ id: `zone-${Date.now()}-${i}`, name: `Grupo ${i + 1}`, teamIds: [] });
      }
      return expanded;
    });
    setError(null);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      const nonEmpty = zones.filter((z) => z.teamIds.length > 0);
      await onSubmit({ groups: nonEmpty.map((z) => ({ team_ids: z.teamIds })) });
      setZonesMap((prev) => {
        const next = { ...prev };
        delete next[currentKey];
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar las zonas.");
    }
  }

  return (
    <Modal
      open={open}
      title="Generar zonas manualmente"
      onClose={onClose}
      className="max-w-5xl h-[92vh] max-h-[92vh] overflow-hidden"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex h-[calc(92vh-116px)] flex-col gap-3 overflow-hidden">

          {/* ── Top bar: filters + progress ──────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
            {categories.length > 0 && (
              <select
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {genders.length > 0 && (
              <select
                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="all">Todos los géneros</option>
                <option value="masculino">Masculino</option>
                <option value="damas">Damas</option>
              </select>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs font-medium text-zinc-600">
                {readyZones}/{zones.length} zonas listas
              </span>
            </div>
          </div>

          {/* ── Two-panel body ────────────────────────────────────────── */}
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">

            {/* Left: Available teams */}
            <div className="flex w-60 flex-shrink-0 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Disponibles
                </span>
                <span className="text-xs text-zinc-400">{filteredAvailableTeams.length}</span>
              </div>
              <DroppableAvailablePool isDraggingFromZone={isDraggingFromZone}>
                <div className="flex h-full flex-col gap-1.5 overflow-y-auto pr-0.5">
                  {filteredAvailableTeams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="mb-1 text-2xl">✓</div>
                      <div className="text-xs text-zinc-400">
                        {availableTeams.length === 0
                          ? "Todos asignados"
                          : "Sin resultados para estos filtros"}
                      </div>
                    </div>
                  ) : (
                    filteredAvailableTeams.map((team) => (
                      <DraggableTeamCard key={team.id} team={team} />
                    ))
                  )}
                </div>
              </DroppableAvailablePool>
            </div>

            {/* Divider */}
            <div className="w-px flex-shrink-0 bg-zinc-100" />

            {/* Right: Zones grid */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Zonas
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateZoneCount(zones.length - 1)}
                    disabled={zones.length <= 1}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="min-w-[1.5rem] text-center text-xs font-semibold text-zinc-700">
                    {zones.length}
                  </span>
                  <button
                    onClick={() => updateZoneCount(zones.length + 1)}
                    disabled={zones.length >= 20}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 pb-2 pr-0.5">
                  {zones.map((zone) => (
                    <DroppableZone
                      key={zone.id}
                      zone={zone}
                      teamsById={teamsById}
                      onRemoveTeam={(teamId) => removeTeamFromZone(zone.id, teamId)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div className="space-y-2 border-t border-zinc-100 pt-3">
            {allDivisionsGenerated && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-800">
                Ya están generadas todas las zonas para todas las categorías.
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">
                {error}
              </div>
            )}
            {!error && !canSubmit && !allDivisionsGenerated && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
                Cada zona usada necesita al menos 2 parejas de la misma división.
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={generating}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={generating || !canSubmit}
              >
                {generating ? "Generando..." : "Generar zonas"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Drag overlay (floating card while dragging) ─────────────── */}
        <DragOverlay
          modifiers={[restrictToWindowEdges]}
          dropAnimation={{
            duration: 220,
            easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
          }}
        >
          {activeDragTeam ? <FloatingCard team={activeDragTeam} /> : null}
        </DragOverlay>
      </DndContext>
    </Modal>
  );
}
