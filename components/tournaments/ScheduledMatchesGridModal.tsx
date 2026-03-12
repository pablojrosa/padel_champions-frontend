"use client";

import { Fragment, useMemo, useState } from "react";
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
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { Match } from "@/lib/types";

type CategoryColor = {
  badgeBackground: string;
  badgeBorder: string;
  badgeText: string;
  cardBackground: string;
  cardBorder: string;
  accent: string;
};

type ConstraintViolation = {
  teamLabel: string;
  constraint: string;
};

type ScheduledMatchesGridModalProps = {
  open: boolean;
  onClose: () => void;
  scheduledMatches: Match[];
  onMatchSelect: (match: Match) => void;
  getStageLabel: (match: Match) => string;
  getMatchCode: (match: Match) => string;
  getMatchTeamsLabel: (match: Match) => string;
  getMatchCategoryLabel?: (match: Match) => string | null;
  title?: string;
  closeOnEscape?: boolean;
  onMatchReschedule?: (
    matchId: number,
    newDate: string,
    newTime: string,
    newCourt: number
  ) => Promise<void>;
  getConstraintViolations?: (
    matchId: number,
    newDate: string,
    newTime: string
  ) => ConstraintViolation[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

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

const CATEGORY_COLORS: CategoryColor[] = [
  {
    badgeBackground: "#dcfce7",
    badgeBorder: "#86efac",
    badgeText: "#166534",
    cardBackground: "#f0fdf4",
    cardBorder: "#86efac",
    accent: "#16a34a",
  },
  {
    badgeBackground: "#dbeafe",
    badgeBorder: "#93c5fd",
    badgeText: "#1d4ed8",
    cardBackground: "#eff6ff",
    cardBorder: "#93c5fd",
    accent: "#2563eb",
  },
  {
    badgeBackground: "#f3e8ff",
    badgeBorder: "#d8b4fe",
    badgeText: "#7e22ce",
    cardBackground: "#faf5ff",
    cardBorder: "#d8b4fe",
    accent: "#9333ea",
  },
  {
    badgeBackground: "#ffedd5",
    badgeBorder: "#fdba74",
    badgeText: "#c2410c",
    cardBackground: "#fff7ed",
    cardBorder: "#fdba74",
    accent: "#ea580c",
  },
  {
    badgeBackground: "#fef3c7",
    badgeBorder: "#fcd34d",
    badgeText: "#b45309",
    cardBackground: "#fffbeb",
    cardBorder: "#fcd34d",
    accent: "#d97706",
  },
  {
    badgeBackground: "#cffafe",
    badgeBorder: "#67e8f9",
    badgeText: "#0f766e",
    cardBackground: "#ecfeff",
    cardBorder: "#67e8f9",
    accent: "#0891b2",
  },
  {
    badgeBackground: "#fee2e2",
    badgeBorder: "#fca5a5",
    badgeText: "#b91c1c",
    cardBackground: "#fef2f2",
    cardBorder: "#fca5a5",
    accent: "#dc2626",
  },
  {
    badgeBackground: "#e0e7ff",
    badgeBorder: "#a5b4fc",
    badgeText: "#4338ca",
    cardBackground: "#eef2ff",
    cardBorder: "#a5b4fc",
    accent: "#4f46e5",
  },
  {
    badgeBackground: "#fce7f3",
    badgeBorder: "#f9a8d4",
    badgeText: "#be185d",
    cardBackground: "#fdf2f8",
    cardBorder: "#f9a8d4",
    accent: "#db2777",
  },
  {
    badgeBackground: "#e5e7eb",
    badgeBorder: "#cbd5e1",
    badgeText: "#334155",
    cardBackground: "#f8fafc",
    cardBorder: "#cbd5e1",
    accent: "#64748b",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return toLocalIsoDate(new Date(year, month - 1, day + days));
}

function isIsoDate(value?: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveGridDefaultDate(startDateRaw: string | null, todayIsoDate: string) {
  if (!startDateRaw) return todayIsoDate;
  if (startDateRaw >= todayIsoDate) return startDateRaw;
  return todayIsoDate;
}

function formatShortDate(value?: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year.slice(-2)}`;
}

function getCourtBadgeClass(courtNumber?: number | null) {
  if (!courtNumber || courtNumber <= 0) {
    return "bg-zinc-100 text-zinc-600";
  }
  return COURT_BADGES[(courtNumber - 1) % COURT_BADGES.length];
}

function resolveCategoryLabel(
  match: Match,
  getMatchCategoryLabel?: (match: Match) => string | null
) {
  return getMatchCategoryLabel?.(match)?.trim() || "Sin categoria";
}

function formatCourtLabel(courtNumber: number) {
  return courtNumber <= 0 ? "Cancha ?" : `Cancha ${courtNumber}`;
}

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle() {
  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 10 16"
      fill="currentColor"
      className="flex-shrink-0 text-zinc-300 group-hover:text-zinc-400 transition-colors"
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

// ─── Draggable match card ─────────────────────────────────────────────────────

type MatchCardContentProps = {
  match: Match;
  categoryColor: CategoryColor;
  getStageLabel: (m: Match) => string;
  getMatchCode: (m: Match) => string;
  getMatchTeamsLabel: (m: Match) => string;
  categoryLabel: string;
  isDragEnabled: boolean;
};

function DraggableMatchCard({
  match,
  categoryColor,
  getStageLabel,
  getMatchCode,
  getMatchTeamsLabel,
  categoryLabel,
  isDragEnabled,
  onMatchSelect,
  isMutating,
}: MatchCardContentProps & {
  onMatchSelect: (m: Match) => void;
  isMutating: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `match::${match.id}`,
    data: { match },
    disabled: !isDragEnabled || isMutating,
  });

  const color = categoryColor;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.15 : 1,
        transition: isDragging ? "none" : "opacity 0.15s",
        backgroundColor: color.cardBackground,
        borderColor: color.cardBorder,
        borderLeftColor: color.accent,
      }}
      className="group relative w-full rounded-xl border border-l-4 text-left text-xs text-zinc-700 shadow-sm"
    >
      <div className="flex items-start gap-1.5 p-2">
        {isDragEnabled && (
          <button
            type="button"
            className="mt-0.5 cursor-grab active:cursor-grabbing touch-none"
            {...listeners}
            {...attributes}
            aria-label="Arrastrar partido"
            tabIndex={-1}
          >
            <DragHandle />
          </button>
        )}
        <button
          type="button"
          onClick={() => onMatchSelect(match)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {getStageLabel(match)} · {getMatchCode(match)}
            </div>
            <span
              className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: color.badgeBackground,
                borderColor: color.badgeBorder,
                color: color.badgeText,
              }}
            >
              {categoryLabel}
            </span>
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-900 leading-tight">
            {getMatchTeamsLabel(match)}
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Floating overlay card while dragging ────────────────────────────────────

function FloatingMatchCard({
  match,
  categoryColor,
  getStageLabel,
  getMatchCode,
  getMatchTeamsLabel,
  categoryLabel,
}: {
  match: Match;
  categoryColor: CategoryColor;
  getStageLabel: (m: Match) => string;
  getMatchCode: (m: Match) => string;
  getMatchTeamsLabel: (m: Match) => string;
  categoryLabel: string;
}) {
  const color = categoryColor;
  return (
    <div
      className="w-64 rounded-xl border border-l-4 p-2.5 shadow-2xl ring-1 ring-zinc-200 rotate-1 scale-105 select-none cursor-grabbing"
      style={{
        backgroundColor: color.cardBackground,
        borderColor: color.cardBorder,
        borderLeftColor: color.accent,
      }}
    >
      <div className="flex items-center gap-1.5">
        <DragHandle />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-[10px] uppercase tracking-wide text-zinc-500">
              {getStageLabel(match)} · {getMatchCode(match)}
            </div>
            <span
              className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                backgroundColor: color.badgeBackground,
                borderColor: color.badgeBorder,
                color: color.badgeText,
              }}
            >
              {categoryLabel}
            </span>
          </div>
          <div className="mt-1 text-sm font-medium text-zinc-900 leading-tight">
            {getMatchTeamsLabel(match)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Droppable cell ───────────────────────────────────────────────────────────

function DroppableCell({
  time,
  courtKey,
  rowClass,
  isDragEnabled,
  children,
}: {
  time: string;
  courtKey: string;
  rowClass: string;
  isDragEnabled: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell::${time}::${courtKey}`,
    disabled: !isDragEnabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[92px] rounded-2xl border-2 p-2 transition-all duration-150 ${
        isOver
          ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-200 ring-offset-1"
          : `border-zinc-200 ${rowClass}`
      }`}
    >
      {children}
      {isOver && (
        <div className="mt-1.5 flex h-8 items-center justify-center rounded-xl border border-dashed border-emerald-400 text-xs text-emerald-600">
          Soltar aquí ↓
        </div>
      )}
    </div>
  );
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

type PendingMove = {
  match: Match;
  newTime: string;
  newCourt: number;
  occupants: Match[];
  constraintViolations: ConstraintViolation[];
};

function ConfirmRescheduleModal({
  pending,
  onConfirm,
  onCancel,
  confirming,
  error,
  getMatchTeamsLabel,
  getMatchCode,
}: {
  pending: PendingMove;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
  error: string | null;
  getMatchTeamsLabel: (m: Match) => string;
  getMatchCode: (m: Match) => string;
}) {
  const hasOccupants = pending.occupants.length > 0;
  const hasConstraintViolations = pending.constraintViolations.length > 0;

  return (
    <Modal
      open
      title="Confirmar cambio de horario"
      onClose={onCancel}
      className="max-w-md"
    >
      <div className="space-y-4">
        {/* Match being moved */}
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
            Partido a mover
          </div>
          <div className="font-medium text-zinc-800">
            {getMatchTeamsLabel(pending.match)}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            {getMatchCode(pending.match)}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center gap-3 text-sm text-zinc-500">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">Desde</div>
            <div className="font-medium text-zinc-700">
              {normalizeTime(pending.match.scheduled_time) || "—"}
            </div>
            <div className="text-xs">{formatCourtLabel(pending.match.court_number ?? -1)}</div>
          </div>
          <svg className="h-5 w-5 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">Hacia</div>
            <div className="font-medium text-zinc-700">{pending.newTime}</div>
            <div className="text-xs">{formatCourtLabel(pending.newCourt)}</div>
          </div>
        </div>

        {/* Swap warning */}
        {hasOccupants && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <div className="font-semibold">Este slot ya tiene {pending.occupants.length === 1 ? "un partido" : "partidos"}</div>
                <div className="mt-0.5 text-xs text-amber-700">
                  {pending.occupants.map((m) => getMatchTeamsLabel(m)).join(" · ")} será reubicado automáticamente.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Constraint violations warning */}
        {hasConstraintViolations && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Conflicto con restricciones horarias</div>
                <ul className="mt-1.5 space-y-1">
                  {pending.constraintViolations.map((v) => (
                    <li key={v.teamLabel} className="text-xs text-orange-700">
                      <span className="font-medium">{v.teamLabel}:</span>{" "}
                      <span className="italic">"{v.constraint}"</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1.5 text-xs text-orange-600">
                  Podés confirmar igual, pero el horario no respeta sus restricciones.
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel} disabled={confirming}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? "Guardando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScheduledMatchesGridModal({
  open,
  onClose,
  scheduledMatches,
  onMatchSelect,
  getStageLabel,
  getMatchCode,
  getMatchTeamsLabel,
  getMatchCategoryLabel,
  title = "Grilla de partidos",
  closeOnEscape = true,
  onMatchReschedule,
  getConstraintViolations,
}: ScheduledMatchesGridModalProps) {
  const [gridDateFilter, setGridDateFilter] = useState("");
  const [gridHiddenCategories, setGridHiddenCategories] = useState<string[]>([]);
  const [gridHiddenGenders, setGridHiddenGenders] = useState<string[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const isDragEnabled = !!onMatchReschedule;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const todayIsoDate = useMemo(() => toLocalIsoDate(new Date()), []);
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
  const defaultGridDate = useMemo(
    () => resolveGridDefaultDate(gridStartDate, todayIsoDate),
    [gridStartDate, todayIsoDate]
  );
  const gridAvailableDates = useMemo(() => {
    const dates = Array.from(
      new Set(
        scheduledMatches
          .map((match) => (match.scheduled_date ?? "").slice(0, 10))
          .filter((date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date))
      )
    ).sort();
    if (!dates.includes(defaultGridDate)) {
      dates.push(defaultGridDate);
      dates.sort();
    }
    return dates;
  }, [scheduledMatches, defaultGridDate]);
  const fallbackGridDate = useMemo(() => {
    if (gridAvailableDates.includes(defaultGridDate)) return defaultGridDate;
    return gridAvailableDates[0] ?? defaultGridDate;
  }, [gridAvailableDates, defaultGridDate]);
  const activeGridDate = isIsoDate(gridDateFilter) ? gridDateFilter : fallbackGridDate;
  const gridMatchesForDateBase = useMemo(
    () =>
      scheduledMatches.filter(
        (match) => (match.scheduled_date ?? "") === activeGridDate
      ),
    [scheduledMatches, activeGridDate]
  );
  const gridCategoriesForDate = useMemo(
    () =>
      Array.from(
        new Set(
          gridMatchesForDateBase.map((match) => resolveCategoryLabel(match, getMatchCategoryLabel))
        )
      ).sort(),
    [gridMatchesForDateBase, getMatchCategoryLabel]
  );
  const gridGendersForDate = useMemo(
    () =>
      Array.from(
        new Set(
          gridMatchesForDateBase
            .map((match) => match.gender?.trim() ?? "")
            .filter(Boolean)
        )
      ).sort(),
    [gridMatchesForDateBase]
  );
  const gridMatchesForDate = useMemo(
    () =>
      gridMatchesForDateBase.filter(
        (match) =>
          !gridHiddenCategories.includes(resolveCategoryLabel(match, getMatchCategoryLabel)) &&
          (gridHiddenGenders.length === 0 ||
            !gridHiddenGenders.includes(match.gender?.trim() ?? ""))
      ),
    [gridMatchesForDateBase, gridHiddenCategories, gridHiddenGenders, getMatchCategoryLabel]
  );
  const categoryColorMap = useMemo(() => {
    const labels = new Set<string>();
    scheduledMatches.forEach((match) =>
      labels.add(resolveCategoryLabel(match, getMatchCategoryLabel))
    );
    const map = new Map<string, CategoryColor>();
    Array.from(labels)
      .sort()
      .forEach((category, index) => {
        map.set(category, CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
      });
    return map;
  }, [scheduledMatches, getMatchCategoryLabel]);

  // Map matchId → match for quick lookup during drag
  const matchesById = useMemo(
    () => new Map(scheduledMatches.map((m) => [m.id, m])),
    [scheduledMatches]
  );

  const gridData = useMemo(() => {
    const times = Array.from(
      new Set(
        gridMatchesForDateBase
          .map((match) => normalizeTime(match.scheduled_time))
          .filter(Boolean)
      )
    ).sort();
    const courts = Array.from(
      new Set(gridMatchesForDateBase.map((match) => match.court_number ?? -1))
    )
      .sort((a, b) => a - b)
      .map((courtNumber) => ({
        key: String(courtNumber),
        label: courtNumber <= 0 ? "Cancha ?" : `Cancha ${courtNumber}`,
        courtNumber,
      }));
    const map = new Map<string, Map<string, Match[]>>();
    const fullMap = new Map<string, Map<string, Match[]>>();

    const addMatchToMap = (sourceMap: Map<string, Map<string, Match[]>>, match: Match) => {
      const timeKey = normalizeTime(match.scheduled_time);
      if (!timeKey) return;
      const courtKey = String(match.court_number ?? -1);
      if (!sourceMap.has(timeKey)) sourceMap.set(timeKey, new Map());
      const courtMap = sourceMap.get(timeKey)!;
      if (!courtMap.has(courtKey)) courtMap.set(courtKey, []);
      courtMap.get(courtKey)!.push(match);
    };

    gridMatchesForDateBase.forEach((match) => addMatchToMap(fullMap, match));
    gridMatchesForDate.forEach((match) => addMatchToMap(map, match));

    map.forEach((courtMap) => {
      courtMap.forEach((matchesInCell) => matchesInCell.sort((a, b) => a.id - b.id));
    });
    fullMap.forEach((courtMap) => {
      courtMap.forEach((matchesInCell) => matchesInCell.sort((a, b) => a.id - b.id));
    });

    return { times, courts, map, fullMap };
  }, [gridMatchesForDateBase, gridMatchesForDate]);

  const shiftGridDateBy = (days: number) => {
    setGridDateFilter((prev) => {
      const baseDate = isIsoDate(prev) ? prev : fallbackGridDate;
      return shiftIsoDate(baseDate, days);
    });
  };

  // The match currently being dragged (for overlay)
  const activeDragMatch = useMemo(() => {
    if (!activeDragId) return null;
    const matchId = parseInt(activeDragId.split("::")[1]);
    return matchesById.get(matchId) ?? null;
  }, [activeDragId, matchesById]);

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || !onMatchReschedule) return;

    const activeId = active.id as string; // "match::123"
    const overId = over.id as string;     // "cell::10:00::2"

    if (!activeId.startsWith("match::") || !overId.startsWith("cell::")) return;

    const matchId = parseInt(activeId.split("::")[1]);
    const [, newTime, newCourtStr] = overId.split("::");
    const newCourt = parseInt(newCourtStr);
    const match = matchesById.get(matchId);
    if (!match || !newTime) return;

    // If dropped in the same cell, do nothing
    const currentTime = normalizeTime(match.scheduled_time);
    const currentCourt = match.court_number ?? -1;
    if (currentTime === newTime && currentCourt === newCourt) return;

    // Find occupants of the target cell (excluding the match being moved)
    const occupants = (gridData.fullMap.get(newTime)?.get(newCourtStr) ?? []).filter(
      (m) => m.id !== matchId
    );

    const constraintViolations = getConstraintViolations
      ? getConstraintViolations(matchId, activeGridDate, newTime)
      : [];

    setPendingMove({ match, newTime, newCourt, occupants, constraintViolations });
  }

  async function handleConfirmMove() {
    if (!pendingMove || !onMatchReschedule) return;
    setConfirming(true);
    setMoveError(null);
    try {
      await onMatchReschedule(
        pendingMove.match.id,
        activeGridDate,
        pendingMove.newTime,
        pendingMove.newCourt
      );
      setPendingMove(null);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "No se pudo reprogramar el partido.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        title={title}
        onClose={onClose}
        className="max-w-[95vw]"
        closeOnEscape={closeOnEscape && !pendingMove}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            {scheduledMatches.length === 0 ? (
              <div className="text-sm text-zinc-600">
                No hay partidos programados para mostrar.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-end gap-3 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <label htmlFor="grid-date-filter" className="font-semibold text-zinc-600">
                      Fecha
                    </label>
                    <button
                      type="button"
                      onClick={() => shiftGridDateBy(-1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                      aria-label="Ir al dia anterior"
                    >
                      {"<"}
                    </button>
                    <input
                      id="grid-date-filter"
                      type="date"
                      value={activeGridDate}
                      onChange={(event) => setGridDateFilter(event.target.value)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-800/15"
                    />
                    <button
                      type="button"
                      onClick={() => shiftGridDateBy(1)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
                      aria-label="Ir al dia siguiente"
                    >
                      {">"}
                    </button>
                  </div>
                </div>
                {(gridCategoriesForDate.length > 0 || gridGendersForDate.length > 1) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {gridCategoriesForDate.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                          Categorias
                        </div>
                        {gridCategoriesForDate.map((category) => {
                          const color = categoryColorMap.get(category) ?? CATEGORY_COLORS[0];
                          const active = !gridHiddenCategories.includes(category);
                          return (
                            <button
                              key={`grid-category-${category}`}
                              type="button"
                              onClick={() =>
                                setGridHiddenCategories((prev) =>
                                  prev.includes(category)
                                    ? prev.filter((item) => item !== category)
                                    : [...prev, category]
                                )
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                active
                                  ? "shadow-sm"
                                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
                              }`}
                              style={
                                active
                                  ? {
                                      backgroundColor: color.badgeBackground,
                                      borderColor: color.badgeBorder,
                                      color: color.badgeText,
                                    }
                                  : undefined
                              }
                              aria-pressed={active}
                            >
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: color.accent }}
                                aria-hidden="true"
                              />
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {gridGendersForDate.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                          Género
                        </div>
                        {gridGendersForDate.map((gender) => {
                          const active = !gridHiddenGenders.includes(gender);
                          const isMasculino = gender.toLowerCase() === "masculino";
                          return (
                            <button
                              key={`grid-gender-${gender}`}
                              type="button"
                              onClick={() =>
                                setGridHiddenGenders((prev) =>
                                  prev.includes(gender)
                                    ? prev.filter((g) => g !== gender)
                                    : [...prev, gender]
                                )
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                active
                                  ? isMasculino
                                    ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm"
                                    : "border-pink-200 bg-pink-50 text-pink-700 shadow-sm"
                                  : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600"
                              }`}
                              aria-pressed={active}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  active
                                    ? isMasculino
                                      ? "bg-blue-400"
                                      : "bg-pink-400"
                                    : "bg-zinc-300"
                                }`}
                                aria-hidden="true"
                              />
                              {gender.charAt(0).toUpperCase() + gender.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {gridData.times.length === 0 || gridData.courts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
                    No hay partidos programados para la fecha {formatShortDate(activeGridDate)}.
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
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${getCourtBadgeClass(
                              court.courtNumber
                            )}`}
                          >
                            {court.label}
                          </span>
                        </div>
                      ))}

                      {gridData.times.map((slotTime, rowIdx) => {
                        const rowClass = rowIdx % 2 === 0 ? "bg-white" : "bg-zinc-50";
                        return (
                          <Fragment key={`row-${slotTime}`}>
                            <div
                              className={`rounded-lg px-2 py-1 text-sm font-medium text-zinc-700 ${rowClass}`}
                            >
                              {slotTime}
                            </div>
                            {gridData.courts.map((court) => {
                              const allMatchesInCell =
                                gridData.fullMap.get(slotTime)?.get(court.key) ?? [];
                              const matchesInCell =
                                gridData.map.get(slotTime)?.get(court.key) ?? [];
                              const hiddenMatchesCount =
                                allMatchesInCell.length - matchesInCell.length;
                              return (
                                <DroppableCell
                                  key={`cell-${slotTime}-${court.key}`}
                                  time={slotTime}
                                  courtKey={court.key}
                                  rowClass={rowClass}
                                  isDragEnabled={isDragEnabled}
                                >
                                  {matchesInCell.length === 0 ? (
                                    <div className="flex h-full min-h-[68px] items-center justify-center rounded-xl border border-dashed border-zinc-200 text-xs text-zinc-400">
                                      {hiddenMatchesCount > 0
                                        ? "Ocultos por filtro"
                                        : isDragEnabled
                                        ? "Arrastrá aquí"
                                        : "Sin partidos"}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {matchesInCell.map((match) => {
                                        const category = resolveCategoryLabel(
                                          match,
                                          getMatchCategoryLabel
                                        );
                                        const color =
                                          categoryColorMap.get(category) ?? CATEGORY_COLORS[0];
                                        return (
                                          <DraggableMatchCard
                                            key={match.id}
                                            match={match}
                                            categoryColor={color}
                                            categoryLabel={category}
                                            getStageLabel={getStageLabel}
                                            getMatchCode={getMatchCode}
                                            getMatchTeamsLabel={getMatchTeamsLabel}
                                            isDragEnabled={isDragEnabled}
                                            onMatchSelect={onMatchSelect}
                                            isMutating={confirming}
                                          />
                                        );
                                      })}
                                      {hiddenMatchesCount > 0 && (
                                        <div className="px-1 text-[11px] text-zinc-400">
                                          {hiddenMatchesCount} oculto
                                          {hiddenMatchesCount === 1 ? "" : "s"} por filtro
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </DroppableCell>
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

          {/* Floating drag overlay */}
          <DragOverlay
            modifiers={[restrictToWindowEdges]}
            dropAnimation={{
              duration: 220,
              easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
            }}
          >
            {activeDragMatch ? (
              <FloatingMatchCard
                match={activeDragMatch}
                categoryColor={
                  categoryColorMap.get(
                    resolveCategoryLabel(activeDragMatch, getMatchCategoryLabel)
                  ) ?? CATEGORY_COLORS[0]
                }
                categoryLabel={resolveCategoryLabel(activeDragMatch, getMatchCategoryLabel)}
                getStageLabel={getStageLabel}
                getMatchCode={getMatchCode}
                getMatchTeamsLabel={getMatchTeamsLabel}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </Modal>

      {/* Confirmation modal — rendered outside the grid modal so it stacks on top */}
      {pendingMove && (
        <ConfirmRescheduleModal
          pending={pendingMove}
          onConfirm={handleConfirmMove}
          onCancel={() => { setPendingMove(null); setMoveError(null); }}
          confirming={confirming}
          error={moveError}
          getMatchTeamsLabel={getMatchTeamsLabel}
          getMatchCode={getMatchCode}
        />
      )}
    </>
  );
}
