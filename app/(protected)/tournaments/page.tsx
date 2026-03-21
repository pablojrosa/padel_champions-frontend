"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type {
  Tournament,
  TournamentCreationAiDraft,
  TournamentCreationAiField,
  TournamentCreationAiMessage,
  TournamentCreationAiPairDraft,
  TournamentCreationAiPairsParseResponse,
  TournamentCreationAiScheduleParseResponse,
  TournamentCreationAiScheduleWindow,
  TournamentCreationAiSession,
  TournamentStatus,
} from "@/lib/types";
import { useRouter } from "next/navigation";

type TournamentFieldErrors = {
  name?: string;
  matchDurationMinutes?: string;
  courtsCount?: string;
};

type CompetitionType = "tournament" | "league" | "flash";
type StatusFilter = "all" | TournamentStatus;
type SortOption = "recent" | "name_asc" | "name_desc" | "start_asc" | "start_desc";
type CreateFlowStep = 1 | 2 | 3 | 4;
type CreateMode = "choose" | "manual" | "provogpt";
type AiDivisionConfig = {
  key: string;
  category: string;
  gender: string;
  count: number;
};
type AiPostCreateStage =
  | "tournament_setup"
  | "pair_offer"
  | "pair_waiting"
  | "pair_review"
  | "generation_offer"
  | "generation_collect_teams_per_group"
  | "generation_collect_schedule_windows"
  | "generation_ready"
  | "completed";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const statusFilterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "upcoming", label: "Por jugar" },
  { value: "ongoing", label: "En curso" },
  { value: "groups_finished", label: "Zonas finalizadas" },
  { value: "finished", label: "Finalizado" },
];

const ITEMS_PER_PAGE = 16;

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "name_asc", label: "Nombre (A-Z)" },
  { value: "name_desc", label: "Nombre (Z-A)" },
  { value: "start_asc", label: "Fecha inicio (próxima)" },
  { value: "start_desc", label: "Fecha inicio (lejana)" },
];

const typeCardConfig: Record<CompetitionType, { bg: string; iconColor: string }> = {
  tournament: { bg: "bg-gradient-to-br from-amber-50 to-yellow-100", iconColor: "text-amber-400" },
  league:     { bg: "bg-gradient-to-br from-sky-50 to-blue-100",    iconColor: "text-blue-400"  },
  flash:      { bg: "bg-gradient-to-br from-orange-50 to-red-100",  iconColor: "text-orange-400"},
};
const competitionTypeOptions: { value: CompetitionType; label: string }[] = [
  { value: "tournament", label: "Torneo" },
  { value: "league", label: "Liga" },
  { value: "flash", label: "Relámpago" },
];
const competitionTypeHints: Record<CompetitionType, string> = {
  tournament: "Ideal para torneos que duran un fin de semana.",
  league: "Ideal para ligas en donde se juega 1 vez por semana.",
  flash: "Ideal para torneos relámpago que se juegan en 1 solo día.",
};
const AI_PAIR_TEMPLATE_HEADERS = [
  "Nombre Jugador 1",
  "Nombre Jugador 2",
  "Categoria",
  "Genero",
  "Restricciones",
];
const AI_PAIR_TEMPLATE_SAMPLE = [
  "Ana",
  "Carla",
  "6ta",
  "Damas",
  "No puede viernes",
];
const AI_PAIR_HEADER_FIELD_MAP: Record<string, string> = {
  nombrejugador1: "player1_name",
  nombrejugador2: "player2_name",
  jugador1nombre: "player1_name",
  jugador2nombre: "player2_name",
  categoria: "category",
  genero: "gender",
  restricciones: "constraints",
  restriccioneshorarias: "constraints",
  disponibilidad: "constraints",
};
const AI_PAIR_FIELD_LABELS: Record<string, string> = {
  player1_name: "Nombre Jugador 1",
  player2_name: "Nombre Jugador 2",
  category: "Categoria",
  gender: "Genero",
  constraints: "Restricciones",
};
const competitionTypeNamePlaceholders: Record<CompetitionType, string> = {
  tournament: "Ej: Torneo Apertura 2026",
  league: "Ej: Liga Apertura 2026",
  flash: "Ej: Relámpago Verano 2026",
};

const createFlowSteps: { step: 1 | 2 | 3; label: string; focus: string }[] = [
  { step: 1, label: "Nombre", focus: "¿Cómo se llama la compatencia?" },
  { step: 2, label: "Formato", focus: "¿Cómo van a jugar?" },
  { step: 3, label: "Confirmar", focus: "¿Listo para crear la competencia?" },
];
const totalCreateFlowSteps = createFlowSteps.length;
const tournamentCreationFieldLabels: Record<TournamentCreationAiField, string> = {
  name: "Nombre",
  competition_type: "Formato",
  description: "Descripción",
  location: "Sede",
  category: "Categoría",
  start_date: "Fecha de inicio",
  end_date: "Fecha de cierre",
  teams_per_group: "Equipos por zona",
  courts_count: "Canchas",
  match_duration_minutes: "Duración por partido",
  start_time: "Hora de inicio",
  end_time: "Hora de cierre",
};
const provoChatBackgroundStyle = {
  backgroundColor: "#efeae2",
  backgroundImage:
    'linear-gradient(rgba(239, 234, 226, 0.68), rgba(239, 234, 226, 0.68)), url("/chat-bg-whatsapp.png")',
  backgroundRepeat: "repeat, repeat",
  backgroundSize: "auto, auto 540px",
  backgroundPosition: "0 0, left top",
} as const;

function competitionTypeLabel(value?: string | null) {
  if (value === "league") return "Liga";
  if (value === "flash") return "Relámpago";
  return "Torneo";
}

function competitionTypeNoun(value?: string | null) {
  if (value === "league") return "liga";
  if (value === "flash") return "relámpago";
  return "torneo";
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function toDateWeight(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return parsed.getTime();
}

function compareByStartDate(a: Tournament, b: Tournament, direction: 1 | -1) {
  if (!a.start_date && !b.start_date) return 0;
  if (!a.start_date) return 1;
  if (!b.start_date) return -1;
  return (toDateWeight(a.start_date) - toDateWeight(b.start_date)) * direction;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);
  if (startLabel && endLabel) return `${startLabel} - ${endLabel}`;
  if (startLabel) return startLabel;
  return "Sin fecha";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const defaultDescriptionByType: Record<CompetitionType, string> = {
  tournament:
    "Reglas del torneo\n" +
    "- Los partidos se juegan al mejor de 3 sets.\n" +
    "- Si una pareja gana por 2 sets a 0, suma 3 puntos.\n" +
    "- Si una pareja gana por 2 sets a 1, suma 2 puntos.\n" +
    "- Si una pareja pierde por 1 set a 2, suma 1 punto.\n" +
    "- Si una pareja pierde por 0 sets a 2, suma 0 puntos.\n" +
    "- Desempate: puntos, diferencia de sets y diferencia de games.",
  league:
    "Reglas de la liga\n" +
    "- Los partidos se juegan al mejor de 3 sets.\n" +
    "- Cada victoria suma 3 puntos.\n" +
    "- Cada derrota suma 0 puntos.\n" +
    "- Desempate: puntos, diferencia de sets y diferencia de games.\n" +
    "- Formato todos contra todos.",
  flash:
    "Reglas del relámpago\n" +
    "- Formato de eliminación directa.\n" +
    "- Los partidos se juegan al mejor de 3 sets.\n" +
    "- No hay fase de grupos.",
};

function buildTournamentPayloadFromAiDraft(draft: TournamentCreationAiDraft) {
  const competitionType = (draft.competition_type ?? "tournament") as CompetitionType;
  return {
    name: draft.name?.trim() ?? "",
    competition_type: competitionType,
    description: draft.description?.trim() || defaultDescriptionByType[competitionType],
    location: draft.location?.trim() || null,
    category: draft.category?.trim() || null,
    start_date: draft.start_date ?? null,
    end_date: draft.end_date ?? null,
    teams_per_group: draft.teams_per_group ?? null,
    match_duration_minutes:
      competitionType === "tournament" ? draft.match_duration_minutes ?? null : null,
    courts_count:
      competitionType === "tournament" || competitionType === "flash"
        ? draft.courts_count ?? null
        : 1,
    start_time: draft.start_time ?? null,
    end_time: draft.end_time ?? null,
  };
}

function formatAiDraftValue(
  field: TournamentCreationAiField,
  value: TournamentCreationAiDraft[TournamentCreationAiField]
) {
  if (value === null || value === undefined || value === "") return null;
  if (field === "competition_type" && typeof value === "string") {
    return competitionTypeLabel(value);
  }
  if ((field === "start_date" || field === "end_date") && typeof value === "string") {
    return formatDate(value) ?? value;
  }
  if ((field === "start_time" || field === "end_time") && typeof value === "string") {
    return value.slice(0, 5);
  }
  if (field === "match_duration_minutes" && typeof value === "number") {
    return `${value} min`;
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

function normalizeAiChatValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeAiPairHeader(value: string) {
  return normalizeAiChatValue(value).replace(/[^a-z0-9]/g, "");
}

function normalizeAiPairGender(value: string) {
  const normalized = normalizeAiChatValue(value);
  if (["damas", "femenino", "mujer", "f"].includes(normalized)) return "damas";
  if (["masculino", "caballeros", "hombre", "m"].includes(normalized)) return "masculino";
  return normalized;
}

function normalizeAiPairCategory(value: string) {
  const normalized = normalizeAiChatValue(value);
  if (!normalized) return "";
  const digitMatch = normalized.match(/\d+/);
  if (!digitMatch) return normalized;
  const categoryMap: Record<string, string> = {
    "1": "1ra",
    "2": "2da",
    "3": "3ra",
    "4": "4ta",
    "5": "5ta",
    "6": "6ta",
    "7": "7ma",
    "8": "8va",
  };
  return categoryMap[digitMatch[0]] ?? normalized;
}

function buildAiPairsTemplateMessage() {
  return (
    "Perfecto 🤝. Puedes pegar las parejas en varias filas usando este formato.\n\n" +
    `${AI_PAIR_TEMPLATE_HEADERS.join(" | ")}\n` +
    `${AI_PAIR_TEMPLATE_SAMPLE.join(" | ")}\n\n` +
    "Si una pareja no tiene restricciones horarias, deja la ultima columna vacia."
  );
}

function formatAiScheduleWindowLabel(window: TournamentCreationAiScheduleWindow) {
  const dateLabel = formatDate(window.date) ?? window.date;
  const startTime = window.start_time.slice(0, 5);
  const endTime = window.end_time.slice(0, 5);
  return `${dateLabel} · ${startTime} a ${endTime}`;
}

function sortAiScheduleWindows(windows: TournamentCreationAiScheduleWindow[]) {
  return [...windows].sort((a, b) =>
    `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`)
  );
}

function buildAiScheduleWindowsMessage(windows: TournamentCreationAiScheduleWindow[]) {
  return windows.map((window) => formatAiScheduleWindowLabel(window)).join("\n");
}

function buildAiDivisionTeamsMessage(
  divisions: AiDivisionConfig[],
  teamsPerGroupByDivision: Record<string, number>
) {
  return divisions
    .map((division) => {
      const label = `${division.category} · ${division.gender}`;
      const teamsPerGroup = teamsPerGroupByDivision[division.key];
      return `${label}: ${teamsPerGroup} parejas por zona`;
    })
    .join("\n");
}

function buildAiPostCreationTransitionMessage(draft: TournamentCreationAiDraft) {
  const competitionType = draft.competition_type ?? "tournament";
  const detailParts: string[] = [];

  if (draft.courts_count) {
    detailParts.push(`${draft.courts_count} ${draft.courts_count === 1 ? "cancha" : "canchas"}`);
  }
  if (competitionType === "tournament" && draft.match_duration_minutes) {
    detailParts.push(
      `partidos de ${draft.match_duration_minutes} ${draft.match_duration_minutes === 1 ? "minuto" : "minutos"}`
    );
  }

  const details =
    detailParts.length > 0 ? ` con ${detailParts.join(" y ")}` : "";

  return (
    `Listo ✅. Ya tengo todo lo básico: ${draft.name ?? "la competencia"} será un ${competitionTypeNoun(
      competitionType
    )}${details}. La competencia ya quedó creada.\n\n` +
    "¿Quieres que carguemos las parejas ahora desde acá?"
  );
}

function incrementIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  return nextDate.toISOString().slice(0, 10);
}

function renderAiChatMessageContent(message: TournamentCreationAiMessage) {
  const isPairsTemplateMessage =
    message.role === "assistant" &&
    message.content.startsWith("Perfecto 🤝. Puedes pegar las parejas en varias filas usando este formato.");

  if (!isPairsTemplateMessage) {
    return <div className="whitespace-pre-wrap">{message.content}</div>;
  }

  return (
    <div className="space-y-3">
      <p>Perfecto 🤝. Puedes pegar las parejas en varias filas usando este formato.</p>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
          📝 Formato
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-[12px] text-zinc-700">
          {AI_PAIR_TEMPLATE_HEADERS.join(" | ")}
        </div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
          💡 Ejemplo
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl bg-white px-3 py-2 font-mono text-[12px] text-zinc-700">
          {AI_PAIR_TEMPLATE_SAMPLE.join(" | ")}
        </div>
      </div>
      <p>Si una pareja no tiene restricciones horarias, deja la ultima columna vacia ✅.</p>
    </div>
  );
}

export default function TournamentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Tournament[]>([]);
  const [statusByTournamentId, setStatusByTournamentId] = useState<
    Record<number, TournamentStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [competitionType, setCompetitionType] = useState<CompetitionType>("tournament");
  const currentTypeDefaultDescription = defaultDescriptionByType[competitionType];
  const [matchDurationMinutes, setMatchDurationMinutes] = useState("90");
  const [courtsCount, setCourtsCount] = useState("1");
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("choose");
  const [createFlowStep, setCreateFlowStep] = useState<CreateFlowStep>(1);
  const [lastCreatedTournament, setLastCreatedTournament] = useState<{
    id: number;
    name: string;
    competitionType: CompetitionType;
  } | null>(null);
  const [aiSessionId, setAiSessionId] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<TournamentCreationAiDraft>({});
  const [aiMessages, setAiMessages] = useState<TournamentCreationAiMessage[]>([]);
  const [aiMissingFields, setAiMissingFields] = useState<TournamentCreationAiField[]>([]);
  const [aiReadyToCreate, setAiReadyToCreate] = useState(false);
  const [aiOffTopicCount, setAiOffTopicCount] = useState(0);
  const [aiConversationClosed, setAiConversationClosed] = useState(false);
  const [aiPostCreateStage, setAiPostCreateStage] =
    useState<AiPostCreateStage>("tournament_setup");
  const [aiPendingPairs, setAiPendingPairs] = useState<TournamentCreationAiPairDraft[]>([]);
  const [aiImportedPairs, setAiImportedPairs] = useState<TournamentCreationAiPairDraft[]>([]);
  const [aiPairImportErrors, setAiPairImportErrors] = useState<string[]>([]);
  const [aiTeamsPerGroupByDivision, setAiTeamsPerGroupByDivision] = useState<
    Record<string, number>
  >({});
  const [aiActiveDivisionKey, setAiActiveDivisionKey] = useState<string | null>(null);
  const [aiScheduleWindows, setAiScheduleWindows] = useState<
    TournamentCreationAiScheduleWindow[]
  >([]);
  const [aiScheduleDateInput, setAiScheduleDateInput] = useState("");
  const [aiScheduleStartTimeInput, setAiScheduleStartTimeInput] = useState("");
  const [aiScheduleEndTimeInput, setAiScheduleEndTimeInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStartingSession, setAiStartingSession] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCreatingTournament, setAiCreatingTournament] = useState(false);
  const [aiImportingPairs, setAiImportingPairs] = useState(false);
  const [aiGeneratingGroups, setAiGeneratingGroups] = useState(false);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiPairsFileInputRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [page, setPage] = useState(1);

  const [recentlyCreatedId, setRecentlyCreatedId] = useState<number | null>(null);

  function resetCreateDraft() {
    setName("");
    setCompetitionType("tournament");
    setMatchDurationMinutes("90");
    setCourtsCount("1");
    setFieldErrors({});
    setCreateError(null);
  }

  function resetAiDraft() {
    setAiSessionId(null);
    setAiDraft({});
    setAiMessages([]);
    setAiMissingFields([]);
    setAiReadyToCreate(false);
    setAiOffTopicCount(0);
    setAiConversationClosed(false);
    setAiPostCreateStage("tournament_setup");
    setAiPendingPairs([]);
    setAiImportedPairs([]);
    setAiPairImportErrors([]);
    setAiTeamsPerGroupByDivision({});
    setAiActiveDivisionKey(null);
    setAiScheduleWindows([]);
    setAiScheduleDateInput("");
    setAiScheduleStartTimeInput("");
    setAiScheduleEndTimeInput("");
    setAiInput("");
    setAiLoading(false);
    setAiStartingSession(false);
    setAiError(null);
    setAiCreatingTournament(false);
    setAiImportingPairs(false);
    setAiGeneratingGroups(false);
  }

  function openCreateModal() {
    setCreateModalOpen(true);
    setCreateMode("choose");
    setCreateFlowStep(1);
    setFieldErrors({});
    setCreateError(null);
    setLastCreatedTournament(null);
    resetCreateDraft();
    resetAiDraft();
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateMode("choose");
    setCreateFlowStep(1);
    setFieldErrors({});
    setCreateError(null);
    setLastCreatedTournament(null);
    resetCreateDraft();
    resetAiDraft();
  }

  function validateCreateStep(step: 1 | 2) {
    const nextFieldErrors: TournamentFieldErrors = {};
    if (step === 1) {
      if (!name.trim()) {
        nextFieldErrors.name = "Ingresá un nombre para la competencia.";
      }
    }

    if (step === 2) {
      const parsedMatchDuration = Number(matchDurationMinutes);
      const parsedCourtsCount = Number(courtsCount);

      if (competitionType === "tournament") {
        if (!Number.isFinite(parsedMatchDuration) || parsedMatchDuration <= 0) {
          nextFieldErrors.matchDurationMinutes = "La duración debe ser mayor a 0.";
        }
      }

      if (competitionType === "tournament" || competitionType === "flash") {
        if (!Number.isFinite(parsedCourtsCount) || parsedCourtsCount <= 0) {
          nextFieldErrors.courtsCount = "La cantidad de canchas debe ser mayor a 0.";
        }
      }
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...nextFieldErrors }));
      setCreateError(null);
      return false;
    }

    return true;
  }

  async function load() {
    setLoading(true);
    setPageError(null);
    try {
      const data = await api<Tournament[]>("/tournaments");
      setItems(data);

      const statusMap = Object.fromEntries(
        data.map((t) => [t.id, (t.status ?? "upcoming") as TournamentStatus] as const)
      );
      setStatusByTournamentId(statusMap);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setPageError(getErrorMessage(err, "No se pudieron cargar las competencias."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!recentlyCreatedId) return;
    const timeoutId = window.setTimeout(() => setRecentlyCreatedId(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [recentlyCreatedId]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    if (createMode !== "provogpt") return;
    aiMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, aiLoading, createMode]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = items.filter((tournament) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        tournament.name.toLowerCase().includes(normalizedSearch);
      const status = statusByTournamentId[tournament.id] ?? "upcoming";
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "name_asc") return a.name.localeCompare(b.name, "es");
      if (sortBy === "name_desc") return b.name.localeCompare(a.name, "es");
      if (sortBy === "start_asc") return compareByStartDate(a, b, 1);
      if (sortBy === "start_desc") return compareByStartDate(a, b, -1);
      return b.id - a.id;
    });
  }, [items, search, statusFilter, sortBy, statusByTournamentId]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredAndSortedItems.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  async function createTournament() {
    const nextFieldErrors: TournamentFieldErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      nextFieldErrors.name = "Ingresá un nombre para la competencia.";
    }

    const parsedMatchDuration = Number(matchDurationMinutes);
    const parsedCourtsCount = Number(courtsCount);

    if (competitionType === "tournament") {
      if (!Number.isFinite(parsedMatchDuration) || parsedMatchDuration <= 0) {
        nextFieldErrors.matchDurationMinutes = "La duración debe ser mayor a 0.";
      }
    }

    if (competitionType === "tournament" || competitionType === "flash") {
      if (!Number.isFinite(parsedCourtsCount) || parsedCourtsCount <= 0) {
        nextFieldErrors.courtsCount = "La cantidad de canchas debe ser mayor a 0.";
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setCreateError(null);
      return null;
    }

    setCreating(true);
    setCreateError(null);
    setFieldErrors({});
    try {
      const created = await api<Tournament>("/tournaments", {
        method: "POST",
        body: {
          name: trimmedName,
          competition_type: competitionType,
          description: currentTypeDefaultDescription,
          location: null,
          match_duration_minutes:
            competitionType === "tournament"
              ? Math.trunc(parsedMatchDuration)
              : null,
          courts_count:
            competitionType === "tournament" || competitionType === "flash"
              ? Math.trunc(parsedCourtsCount)
              : 1,
          start_date: null,
          start_time: null,
        },
      });
      setItems((prev) => [created, ...prev]);
      setStatusByTournamentId((prev) => ({ ...prev, [created.id]: "upcoming" }));
      setLastCreatedTournament({
        id: created.id,
        name: created.name,
        competitionType,
      });
      resetCreateDraft();
      setRecentlyCreatedId(created.id);
      setPage(1);
      return created;
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "No se pudo crear la competencia."));
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function startAiSession() {
    setAiStartingSession(true);
    setAiError(null);
    try {
      const session = await api<TournamentCreationAiSession>("/tournaments/ai/session", {
        method: "POST",
      });
      setAiSessionId(session.session_id);
      setAiDraft(session.draft);
      setAiMissingFields(session.missing_fields);
      setAiReadyToCreate(session.ready_to_create);
      setAiOffTopicCount(session.off_topic_count);
      setAiConversationClosed(session.conversation_closed);
      setAiMessages([{ role: "assistant", content: session.assistant_message }]);
      setAiInput("");
      setCreateMode("provogpt");
    } catch (err: unknown) {
      setAiError(getErrorMessage(err, "No se pudo iniciar ProvoGPT."));
    } finally {
      setAiStartingSession(false);
    }
  }

  async function handleCreateModeSelection(mode: Exclude<CreateMode, "choose">) {
    if (mode === "manual") {
      setCreateMode("manual");
      setCreateFlowStep(1);
      setCreateError(null);
      setLastCreatedTournament(null);
      resetCreateDraft();
      return;
    }
    resetAiDraft();
    await startAiSession();
  }

  function appendAiAssistantMessage(content: string) {
    setAiMessages((prev) => [...prev, { role: "assistant", content }]);
  }

  function appendAiUserMessage(content: string) {
    setAiMessages((prev) => [...prev, { role: "user", content }]);
  }

  function downloadAiPairsTemplate() {
    const rows = [
      AI_PAIR_TEMPLATE_HEADERS.join(","),
      AI_PAIR_TEMPLATE_SAMPLE.join(","),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "provogpt_template_parejas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function openAiPairsFilePicker() {
    aiPairsFileInputRef.current?.click();
  }

  async function handleAiPairsFileUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    appendAiUserMessage(`Subir archivo: ${file.name}`);
    setAiLoading(true);
    setAiError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("El archivo no tiene hojas para importar.");
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as Array<Array<string | number>>;

      if (rows.length < 2) {
        throw new Error("El archivo no contiene filas para importar.");
      }

      const headerRow = rows[0].map((cell) => String(cell ?? ""));
      const headerKeys = headerRow.map(normalizeAiPairHeader);
      const fieldIndexes: Record<string, number> = {};

      headerKeys.forEach((key, index) => {
        const mapped = AI_PAIR_HEADER_FIELD_MAP[key];
        if (mapped) fieldIndexes[mapped] = index;
      });

      const requiredFields = ["player1_name", "player2_name", "category", "gender"];
      const missingFields = requiredFields.filter(
        (field) => fieldIndexes[field] === undefined
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Faltan columnas requeridas: ${missingFields
            .map((field) => AI_PAIR_FIELD_LABELS[field] ?? field)
            .join(", ")}.`
        );
      }

      const parseCell = (row: Array<string | number>, key: string) => {
        const index = fieldIndexes[key];
        if (index === undefined) return "";
        return String(row[index] ?? "").trim();
      };

      const parsedPairs: TournamentCreationAiPairDraft[] = [];
      const rowErrors: string[] = [];

      rows.slice(1).forEach((row, index) => {
        const rowIndex = index + 2;
        const hasContent = row.some((cell) => String(cell ?? "").trim() !== "");
        if (!hasContent) return;

        const pair: TournamentCreationAiPairDraft = {
          player1_name: parseCell(row, "player1_name"),
          player2_name: parseCell(row, "player2_name"),
          category: normalizeAiPairCategory(parseCell(row, "category")),
          gender: normalizeAiPairGender(parseCell(row, "gender")),
          schedule_constraints: parseCell(row, "constraints") || null,
        };

        if (!pair.player1_name || !pair.player2_name || !pair.category || !pair.gender) {
          rowErrors.push(`Fila ${rowIndex}: faltan datos obligatorios.`);
          return;
        }

        parsedPairs.push(pair);
      });

      if (parsedPairs.length === 0) {
        throw new Error("No se encontraron parejas validas en el archivo.");
      }

      setAiPendingPairs(parsedPairs);
      setAiPairImportErrors([]);
      setAiPostCreateStage("pair_review");
      appendAiAssistantMessage(
        `Encontre ${parsedPairs.length} ${parsedPairs.length === 1 ? "pareja" : "parejas"} lista${parsedPairs.length === 1 ? "" : "s"} para importar desde el archivo.${rowErrors.length > 0 ? ` Tambien hubo ${rowErrors.length} fila${rowErrors.length === 1 ? "" : "s"} con observaciones.` : ""} Ahora puedes crear las zonas y programar los partidos o cargar un nuevo listado.`
      );
    } catch (err: unknown) {
      setAiError(getErrorMessage(err, "No se pudo leer el archivo de parejas."));
    } finally {
      setAiLoading(false);
    }
  }

  function getNextAiGenerationPrompt() {
    const detectedDivisions = buildAiDivisionConfig(aiImportedPairs);
    const hasTeamsPerGroupConfig =
      detectedDivisions.length > 0 &&
      detectedDivisions.every((division) => (aiTeamsPerGroupByDivision[division.key] ?? 0) > 1);

    if (!hasTeamsPerGroupConfig) {
      return {
        stage: "generation_collect_teams_per_group" as const,
        message:
          "Antes de generar las zonas, elige cuantas parejas por zona quieres usar en cada categoria detectada.",
      };
    }
    if (aiScheduleWindows.length === 0) {
      return {
        stage: "generation_collect_schedule_windows" as const,
        message:
          "Ahora agrega los dias y horarios en el selector de abajo. Puedes cargar uno o varios bloques para las zonas.",
      };
    }
    return {
      stage: "generation_ready" as const,
      message:
        "Ya tengo todo lo necesario. Si quieres, ahora puedo generar las zonas y programar los partidos.",
    };
  }

  function promptNextAiGenerationStep() {
    const nextPrompt = getNextAiGenerationPrompt();
    setAiPostCreateStage(nextPrompt.stage);
    appendAiAssistantMessage(nextPrompt.message);
  }

  function buildAiDivisionConfig(pairs: TournamentCreationAiPairDraft[]) {
    const divisions = new Map<string, AiDivisionConfig>();
    pairs.forEach((pair) => {
      const key = `${pair.category}::${pair.gender}`;
      const current = divisions.get(key);
      if (current) {
        current.count += 1;
        return;
      }
      divisions.set(key, {
        key,
        category: pair.category,
        gender: pair.gender,
        count: 1,
      });
    });
    return Array.from(divisions.values());
  }

  async function handleAiPostCreationMessage(trimmedMessage: string) {
    appendAiUserMessage(trimmedMessage);
    setAiInput("");
    setAiError(null);

    if (aiPostCreateStage === "pair_waiting") {
      const normalizedMessage = normalizeAiChatValue(trimmedMessage);
      if (["no", "no gracias", "mas tarde"].includes(normalizedMessage)) {
        appendAiAssistantMessage(
          "Perfecto ✅. La competencia ya quedo creada y puedes cargar las parejas despues desde la vista de la competencia."
        );
        setAiPostCreateStage("completed");
        return;
      }

      setAiLoading(true);
      try {
        const parsed = await api<TournamentCreationAiPairsParseResponse>(
          "/tournaments/ai/pairs/parse",
          {
            method: "POST",
            body: { raw_input: trimmedMessage },
          }
        );
        setAiPendingPairs(parsed.pairs);
        setAiPairImportErrors([]);
        setAiPostCreateStage(parsed.pairs.length > 0 ? "pair_review" : "pair_waiting");
        const invalidRowsDetail =
          parsed.invalid_rows.length > 0
            ? `\n\nObservaciones:\n- ${parsed.invalid_rows.slice(0, 3).join("\n- ")}`
            : "";
        appendAiAssistantMessage(`${parsed.assistant_message}${invalidRowsDetail}`);
      } catch (err: unknown) {
        setAiError(
          getErrorMessage(err, "No se pudieron interpretar las parejas con ProvoGPT.")
        );
      } finally {
        setAiLoading(false);
      }
      return;
    }

    if (aiPostCreateStage === "generation_collect_teams_per_group") {
      const parsedValue = Number(trimmedMessage);
      if (!Number.isFinite(parsedValue) || parsedValue <= 1) {
        appendAiAssistantMessage(
          "Necesito un numero mayor a 1 para las parejas por zona."
        );
        return;
      }
      const detectedDivisions = buildAiDivisionConfig(aiImportedPairs);
      if (detectedDivisions.length > 0) {
        setAiTeamsPerGroupByDivision(
          Object.fromEntries(
            detectedDivisions.map((division) => [division.key, Math.trunc(parsedValue)])
          )
        );
      }
      const nextDraft = {
        ...aiDraft,
        teams_per_group: Math.trunc(parsedValue),
      };
      setAiDraft(nextDraft);
      promptNextAiGenerationStep();
      return;
    }

    if (aiPostCreateStage === "generation_collect_schedule_windows") {
      setAiLoading(true);
      try {
        const parsed = await api<TournamentCreationAiScheduleParseResponse>(
          "/tournaments/ai/schedule/parse",
          {
            method: "POST",
            body: {
              raw_input: trimmedMessage,
              reference_start_date: aiDraft.start_date ?? null,
            },
          }
        );
        if (parsed.schedule_windows.length === 0) {
          appendAiAssistantMessage(parsed.assistant_message);
          return;
        }

        const earliestWindow = parsed.schedule_windows[0];
        const nextDraft = {
          ...aiDraft,
          start_date: parsed.inferred_start_date ?? earliestWindow.date,
          start_time: earliestWindow.start_time,
          end_time: earliestWindow.end_time,
        };
        setAiScheduleWindows(parsed.schedule_windows);
        setAiDraft(nextDraft);
        appendAiAssistantMessage(parsed.assistant_message);
        promptNextAiGenerationStep();
      } catch (err: unknown) {
        setAiError(
          getErrorMessage(err, "No se pudieron interpretar los dias y horarios de juego.")
        );
      } finally {
        setAiLoading(false);
      }
      return;
    }
  }

  async function sendAiMessage() {
    const trimmedMessage = aiInput.trim();
    if (!trimmedMessage || aiLoading || aiConversationClosed) return;
    if (lastCreatedTournament) {
      await handleAiPostCreationMessage(trimmedMessage);
      return;
    }
    if (!aiSessionId) return;
    const nextMessages = [...aiMessages, { role: "user" as const, content: trimmedMessage }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);
    setAiError(null);
    try {
      const session = await api<TournamentCreationAiSession>("/tournaments/ai/message", {
        method: "POST",
        body: {
          session_id: aiSessionId,
          user_message: trimmedMessage,
          messages: aiMessages,
          draft: aiDraft,
          off_topic_count: aiOffTopicCount,
          conversation_closed: aiConversationClosed,
        },
      });
      setAiDraft(session.draft);
      setAiMissingFields(session.missing_fields);
      setAiReadyToCreate(session.ready_to_create);
      setAiOffTopicCount(session.off_topic_count);
      setAiConversationClosed(session.conversation_closed);
      if (session.ready_to_create && !lastCreatedTournament) {
        const created = await createTournamentWithAiDraft(session.draft, {
          skipAssistantMessage: true,
        });
        if (created) {
          setAiMessages((prev) => [
            ...prev,
            { role: "assistant", content: buildAiPostCreationTransitionMessage(session.draft) },
          ]);
        } else {
          setAiMessages((prev) => [...prev, { role: "assistant", content: session.assistant_message }]);
        }
      } else {
        setAiMessages((prev) => [...prev, { role: "assistant", content: session.assistant_message }]);
      }
    } catch (err: unknown) {
      setAiMessages(aiMessages);
      setAiInput(trimmedMessage);
      setAiError(getErrorMessage(err, "No se pudo continuar la conversación con ProvoGPT."));
    } finally {
      setAiLoading(false);
    }
  }

  async function sendAiQuickReply(message: string) {
    if (!aiSessionId || aiLoading || aiConversationClosed) return;
    const nextMessages = [...aiMessages, { role: "user" as const, content: message }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);
    setAiError(null);
    try {
      const session = await api<TournamentCreationAiSession>("/tournaments/ai/message", {
        method: "POST",
        body: {
          session_id: aiSessionId,
          user_message: message,
          messages: aiMessages,
          draft: aiDraft,
          off_topic_count: aiOffTopicCount,
          conversation_closed: aiConversationClosed,
        },
      });
      setAiDraft(session.draft);
      setAiMissingFields(session.missing_fields);
      setAiReadyToCreate(session.ready_to_create);
      setAiOffTopicCount(session.off_topic_count);
      setAiConversationClosed(session.conversation_closed);
      if (session.ready_to_create && !lastCreatedTournament) {
        const created = await createTournamentWithAiDraft(session.draft, {
          skipAssistantMessage: true,
        });
        if (created) {
          setAiMessages((prev) => [
            ...prev,
            { role: "assistant", content: buildAiPostCreationTransitionMessage(session.draft) },
          ]);
        } else {
          setAiMessages((prev) => [...prev, { role: "assistant", content: session.assistant_message }]);
        }
      } else {
        setAiMessages((prev) => [...prev, { role: "assistant", content: session.assistant_message }]);
      }
    } catch (err: unknown) {
      setAiMessages(aiMessages);
      setAiError(getErrorMessage(err, "No se pudo continuar la conversación con ProvoGPT."));
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiLoadPairsNow() {
    appendAiUserMessage("Cargar parejas ahora");
    appendAiAssistantMessage(buildAiPairsTemplateMessage());
    setAiTeamsPerGroupByDivision({});
    setAiActiveDivisionKey(null);
    setAiPostCreateStage("pair_waiting");
    setAiError(null);
  }

  function handleAiSkipPairs() {
    appendAiUserMessage("Más tarde");
    appendAiAssistantMessage(
      "Perfecto ✅. La competencia ya quedo creada. Cuando quieras, puedes seguir con las parejas desde la vista de la competencia."
    );
    setAiPostCreateStage("completed");
    setAiError(null);
  }

  async function importAiPendingPairs() {
    if (!lastCreatedTournament || aiPendingPairs.length === 0) return;
    setAiImportingPairs(true);
    setAiError(null);

    const importedPairs: TournamentCreationAiPairDraft[] = [];
    const failedPairs: TournamentCreationAiPairDraft[] = [];
    const importErrors: string[] = [];

    for (const pair of aiPendingPairs) {
      try {
        await api(`/tournaments/${lastCreatedTournament.id}/teams/pair`, {
          method: "POST",
          body: {
            player1: {
              first_name: pair.player1_name,
              category: pair.category,
              gender: pair.gender,
            },
            player2: {
              first_name: pair.player2_name,
              category: pair.category,
              gender: pair.gender,
            },
            schedule_constraints: pair.schedule_constraints ?? null,
          },
        });
        importedPairs.push(pair);
      } catch (err: unknown) {
        failedPairs.push(pair);
        if (importErrors.length < 3) {
          importErrors.push(getErrorMessage(err, "No se pudo importar una pareja."));
        }
      }
    }

    if (importedPairs.length > 0) {
      setAiImportedPairs((prev) => [...prev, ...importedPairs]);
      setAiTeamsPerGroupByDivision({});
      setAiActiveDivisionKey(null);
    }
    setAiPendingPairs(failedPairs);
    setAiPairImportErrors(importErrors);

    if (importedPairs.length > 0) {
      appendAiUserMessage("Crear zonas y partidos");
      appendAiAssistantMessage(
        `Listo ✅, cargue ${importedPairs.length} ${importedPairs.length === 1 ? "pareja" : "parejas"} en la competencia.`
      );
    }

    if (failedPairs.length > 0) {
      appendAiAssistantMessage(
        `Quedaron ${failedPairs.length} ${failedPairs.length === 1 ? "pareja pendiente" : "parejas pendientes"} por revisar. ${importErrors.join(" ")}`
      );
      setAiPostCreateStage("pair_review");
      setAiImportingPairs(false);
      return;
    }

    const totalImportedPairs = aiImportedPairs.length + importedPairs.length;
    if (lastCreatedTournament.competitionType === "tournament" && totalImportedPairs >= 2) {
      appendAiAssistantMessage(
        "Puedo armar las zonas y programar los partidos 🎾. ¿Lo hago?"
      );
      setAiPostCreateStage("generation_offer");
    } else {
      if (lastCreatedTournament.competitionType !== "tournament") {
        appendAiAssistantMessage(
          "Ya tienes la competencia creada con sus parejas listas ✅. El siguiente paso puedes hacerlo desde la vista de la competencia."
        );
        setAiPostCreateStage("completed");
      } else if (totalImportedPairs < 2) {
        appendAiAssistantMessage(
          "Necesito al menos 2 parejas cargadas para poder generar zonas y partidos 🎾. Si quieres, pégame mas parejas usando el mismo formato."
        );
        setAiPostCreateStage("pair_waiting");
      } else {
        setAiPostCreateStage("completed");
      }
    }

    setAiImportingPairs(false);
  }

  function handleAiGenerateNow() {
    appendAiUserMessage("Generar ahora");
    promptNextAiGenerationStep();
    setAiError(null);
  }

  function handleAiSkipGeneration() {
    appendAiUserMessage("Más tarde");
    appendAiAssistantMessage(
      "Perfecto ✅. Ya deje la competencia y las parejas listas para que continues cuando quieras."
    );
    setAiPostCreateStage("completed");
    setAiError(null);
  }

  async function generateAiGroupsFromChat() {
    if (!lastCreatedTournament || lastCreatedTournament.competitionType !== "tournament") return;
    const divisions = buildAiDivisionConfig(aiImportedPairs);
    const hasTeamsPerGroupConfig =
      divisions.length > 0 &&
      divisions.every((division) => (aiTeamsPerGroupByDivision[division.key] ?? 0) > 1);

    if (
      !hasTeamsPerGroupConfig ||
      aiScheduleWindows.length === 0 ||
      !aiDraft.match_duration_minutes ||
      !aiDraft.courts_count
    ) {
      promptNextAiGenerationStep();
      return;
    }

    if (divisions.length === 0) {
      setAiError("Primero necesito parejas cargadas para poder generar las zonas.");
      return;
    }

    setAiGeneratingGroups(true);
    setAiError(null);
    try {
      const generation = await api<{
        groups: { id: number }[];
        schedule_conflicts?: { conflicts: object[] }[];
      }>(`/tournaments/${lastCreatedTournament.id}/groups/generate`, {
        method: "POST",
        body: {
          teams_per_group_by_division: divisions.map((division) => ({
            category: division.category,
            gender: division.gender,
            teams_per_group: aiTeamsPerGroupByDivision[division.key],
          })),
          schedule_windows: aiScheduleWindows,
          match_duration_minutes: aiDraft.match_duration_minutes,
          courts_count: aiDraft.courts_count,
        },
      });

      const conflictsCount =
        generation.schedule_conflicts?.reduce(
          (total, item) => total + item.conflicts.length,
          0
        ) ?? 0;
      appendAiUserMessage("Generar zonas y partidos");
      appendAiAssistantMessage(
        conflictsCount > 0
          ? `Listo ✅. Ya genere ${generation.groups.length} zonas y programe los partidos. Tambien detecte ${conflictsCount} conflicto${conflictsCount === 1 ? "" : "s"} horario${conflictsCount === 1 ? "" : "s"} para revisar luego.`
          : `Listo ✅. Ya genere ${generation.groups.length} zonas y programe los partidos para tu torneo.`
      );
      setAiPostCreateStage("completed");
    } catch (err: unknown) {
      setAiError(
        getErrorMessage(err, "No se pudieron generar las zonas desde ProvoGPT.")
      );
    } finally {
      setAiGeneratingGroups(false);
    }
  }

  function confirmAiTeamsPerGroupByDivision() {
    const detectedDivisions = buildAiDivisionConfig(aiImportedPairs);
    if (detectedDivisions.length === 0) {
      setAiError("Primero necesito parejas cargadas para configurar las zonas.");
      return;
    }

    const hasMissingConfig = detectedDivisions.some(
      (division) => (aiTeamsPerGroupByDivision[division.key] ?? 0) <= 1
    );
    if (hasMissingConfig) {
      setAiError("Elige cuantas parejas por zona usar en cada categoria detectada.");
      return;
    }

    const nextTeamsPerGroupByDivision = Object.fromEntries(
      detectedDivisions.map((division) => [
        division.key,
        aiTeamsPerGroupByDivision[division.key],
      ])
    );
    const nextDraft = {
      ...aiDraft,
      teams_per_group: Math.max(...Object.values(nextTeamsPerGroupByDivision)),
    };

    setAiTeamsPerGroupByDivision(nextTeamsPerGroupByDivision);
    setAiDraft(nextDraft);
    appendAiUserMessage(
      buildAiDivisionTeamsMessage(detectedDivisions, nextTeamsPerGroupByDivision)
    );
    setAiError(null);
    promptNextAiGenerationStep();
  }

  function addAiScheduleWindow() {
    if (!aiScheduleDateInput || !aiScheduleStartTimeInput || !aiScheduleEndTimeInput) {
      setAiError("Completa fecha, hora de inicio y hora de cierre.");
      return;
    }

    if (aiScheduleEndTimeInput <= aiScheduleStartTimeInput) {
      setAiError("La hora de cierre debe ser posterior a la hora de inicio.");
      return;
    }

    const nextWindow: TournamentCreationAiScheduleWindow = {
      date: aiScheduleDateInput,
      start_time: `${aiScheduleStartTimeInput}:00`,
      end_time: `${aiScheduleEndTimeInput}:00`,
    };

    setAiScheduleWindows((prev) => {
      const exists = prev.some(
        (window) =>
          window.date === nextWindow.date &&
          window.start_time === nextWindow.start_time &&
          window.end_time === nextWindow.end_time
      );
      return exists ? prev : sortAiScheduleWindows([...prev, nextWindow]);
    });
    setAiScheduleDateInput(incrementIsoDate(aiScheduleDateInput));
    setAiError(null);
  }

  function removeAiScheduleWindow(indexToRemove: number) {
    setAiScheduleWindows((prev) => prev.filter((_, index) => index !== indexToRemove));
    setAiError(null);
  }

  function confirmAiScheduleWindows() {
    const hasPendingScheduleInput =
      Boolean(aiScheduleDateInput) ||
      Boolean(aiScheduleStartTimeInput) ||
      Boolean(aiScheduleEndTimeInput);

    const windowsToConfirm = [...aiScheduleWindows];

    if (hasPendingScheduleInput) {
      if (!aiScheduleDateInput || !aiScheduleStartTimeInput || !aiScheduleEndTimeInput) {
        setAiError("Completa fecha, hora de inicio y hora de cierre, o borra el bloque incompleto.");
        return;
      }

      if (aiScheduleEndTimeInput <= aiScheduleStartTimeInput) {
        setAiError("La hora de cierre debe ser posterior a la hora de inicio.");
        return;
      }

      const pendingWindow: TournamentCreationAiScheduleWindow = {
        date: aiScheduleDateInput,
        start_time: `${aiScheduleStartTimeInput}:00`,
        end_time: `${aiScheduleEndTimeInput}:00`,
      };

      const exists = windowsToConfirm.some(
        (window) =>
          window.date === pendingWindow.date &&
          window.start_time === pendingWindow.start_time &&
          window.end_time === pendingWindow.end_time
      );

      if (!exists) {
        windowsToConfirm.push(pendingWindow);
      }
    }

    if (windowsToConfirm.length === 0) {
      setAiError("Agrega al menos un bloque de juego para continuar.");
      return;
    }

    const orderedWindows = sortAiScheduleWindows(windowsToConfirm);
    const earliestWindow = orderedWindows[0];
    const nextDraft = {
      ...aiDraft,
      start_date: earliestWindow.date,
      start_time: earliestWindow.start_time,
      end_time: earliestWindow.end_time,
    };

    setAiScheduleWindows(orderedWindows);
    setAiDraft(nextDraft);
    setAiScheduleDateInput("");
    setAiScheduleStartTimeInput("");
    setAiScheduleEndTimeInput("");
    appendAiUserMessage(buildAiScheduleWindowsMessage(orderedWindows));
    setAiError(null);
    promptNextAiGenerationStep();
  }

  async function createTournamentWithAiDraft(
    draftOverride?: TournamentCreationAiDraft,
    options?: { skipAssistantMessage?: boolean }
  ) {
    if ((!aiReadyToCreate && !draftOverride) || aiCreatingTournament) return;
    const draftToCreate = draftOverride ?? aiDraft;
    setAiCreatingTournament(true);
    setAiError(null);
    try {
      const created = await api<Tournament>("/tournaments", {
        method: "POST",
        body: buildTournamentPayloadFromAiDraft(draftToCreate),
      });
      const createdCompetitionType = (created.competition_type ?? "tournament") as CompetitionType;
      setItems((prev) => [created, ...prev]);
      setStatusByTournamentId((prev) => ({ ...prev, [created.id]: "upcoming" }));
      setLastCreatedTournament({
        id: created.id,
        name: created.name,
        competitionType: createdCompetitionType,
      });
      setAiReadyToCreate(false);
      setRecentlyCreatedId(created.id);
      setPage(1);
      setAiPostCreateStage("pair_offer");
      if (!options?.skipAssistantMessage) {
        appendAiAssistantMessage(buildAiPostCreationTransitionMessage(draftToCreate));
      }
      return created;
    } catch (err: unknown) {
      setAiError(getErrorMessage(err, "No se pudo crear la competencia con ProvoGPT."));
      return null;
    } finally {
      setAiCreatingTournament(false);
    }
  }

  const currentCreateFlowVisualStep = Math.min(createFlowStep, totalCreateFlowSteps) as
    | 1
    | 2
    | 3;
  const visibleCreateFlowSteps =
    competitionType === "league"
      ? createFlowSteps.filter((step) => step.step !== 2)
      : createFlowSteps;
  const currentVisibleStepIndex = Math.max(
    visibleCreateFlowSteps.findIndex((step) => step.step === currentCreateFlowVisualStep),
    0
  );
  const visibleCreateFlowTotal = visibleCreateFlowSteps.length;
  const createFlowProgress = ((currentVisibleStepIndex + 1) / visibleCreateFlowTotal) * 100;
  async function handleCreateFlowContinue() {
    if (createFlowStep === 1) {
      if (!validateCreateStep(1)) return;
      setFieldErrors((prev) => ({ ...prev, name: undefined }));
      if (competitionType === "league") {
        setCreateFlowStep(3);
        return;
      }
      setCreateFlowStep(2);
      return;
    }

    if (createFlowStep === 2) {
      if (!validateCreateStep(2)) return;
      setFieldErrors((prev) => ({
        ...prev,
        matchDurationMinutes: undefined,
        courtsCount: undefined,
      }));
      setCreateFlowStep(3);
      return;
    }

    if (createFlowStep === 3) {
      const created = await createTournament();
      if (!created) return;
      setCreateFlowStep(4);
    }
  }

  function handleCreateFlowBack() {
    if (createFlowStep <= 1 || createFlowStep === 4) return;
    if (competitionType === "league" && createFlowStep === 3) {
      setCreateFlowStep(1);
      return;
    }
    setCreateFlowStep((prev) => (prev <= 1 ? prev : ((prev - 1) as CreateFlowStep)));
  }
  const activeCreateStepMeta =
    visibleCreateFlowSteps[currentVisibleStepIndex] ?? visibleCreateFlowSteps[0];
  const aiDivisionConfigs = buildAiDivisionConfig(aiImportedPairs);
  const aiCurrentDivision =
    aiDivisionConfigs.find((division) => division.key === aiActiveDivisionKey) ??
    aiDivisionConfigs[0] ??
    null;
  const aiHasTeamsPerGroupConfig =
    aiDivisionConfigs.length > 0 &&
    aiDivisionConfigs.every((division) => (aiTeamsPerGroupByDivision[division.key] ?? 0) > 1);
  const aiDraftEntries = (Object.entries(aiDraft) as Array<
    [TournamentCreationAiField, TournamentCreationAiDraft[TournamentCreationAiField]]
  >).filter(
    ([field, value]) =>
      value !== null &&
      value !== undefined &&
      value !== "" &&
      !(field === "teams_per_group" && aiHasTeamsPerGroupConfig)
  );
  const aiShowCompetitionTypeOptions =
    Boolean(aiDraft.name?.trim()) &&
    aiMissingFields.includes("competition_type") &&
    !aiReadyToCreate &&
    !aiConversationClosed;
  const aiCanShowCreateRetryButton =
    !lastCreatedTournament &&
    !aiShowCompetitionTypeOptions &&
    aiReadyToCreate &&
    Boolean(aiError);
  const aiShowTeamsPerGroupComposer =
    !aiConversationClosed &&
    Boolean(lastCreatedTournament) &&
    aiPostCreateStage === "generation_collect_teams_per_group";
  const aiShowScheduleComposer =
    !aiConversationClosed &&
    Boolean(lastCreatedTournament) &&
    aiPostCreateStage === "generation_collect_schedule_windows";
  const aiAllowsFreeTextAfterCreation =
    aiPostCreateStage === "pair_waiting";
  const aiShowInput =
    !aiConversationClosed &&
    !aiShowTeamsPerGroupComposer &&
    !aiShowScheduleComposer &&
    (lastCreatedTournament ? aiAllowsFreeTextAfterCreation : !aiShowCompetitionTypeOptions && !aiReadyToCreate);
  const aiBusy =
    aiLoading || aiCreatingTournament || aiStartingSession || aiImportingPairs || aiGeneratingGroups;
  const lastCreatedCompetitionType = lastCreatedTournament?.competitionType ?? "tournament";
  const hasCompetitions = !loading && items.length > 0;

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Gestión
          </div>
          <h1 className="text-3xl font-semibold">Competencias</h1>
          <p className="text-sm text-zinc-300">Crea y administra tus competencias.</p>
        </div>
        {!loading && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Volver al tablero
            </Button>
            {hasCompetitions && (
              <Button variant="green" onClick={openCreateModal} className="gap-2 whitespace-nowrap">
                + Nueva competencia
              </Button>
            )}
          </div>
        )}
      </div>

      {pageError && !createModalOpen && (
        <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {pageError}
        </div>
      )}

      <Modal
        open={createModalOpen}
        title={
          createMode === "choose"
            ? "Nueva competencia"
            : createMode === "provogpt"
            ? "Nueva competencia · ProvoGPT"
            : createFlowStep === 4
            ? ""
            : `Nueva competencia · Paso ${currentVisibleStepIndex + 1}/${visibleCreateFlowTotal}`
        }
        onClose={closeCreateModal}
        className={
          createMode === "provogpt"
            ? "max-w-6xl"
            : createMode === "choose"
            ? "max-w-4xl"
            : "max-w-3xl"
        }
      >
        {createMode === "choose" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-zinc-900">
                ¿Cómo quieres crear la competencia?
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => handleCreateModeSelection("manual")}
                className="rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-lg"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100">
                  <svg className="h-5 w-5 text-zinc-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                </div>
                <div className="text-lg font-semibold text-zinc-900">Crear manual</div>
                <p className="mt-2 text-sm text-zinc-600">
                  Configura manualmente todo lo necesario para crear tu próxima competencia.
                </p>
              </button>

              <button
                type="button"
                onClick={() => void handleCreateModeSelection("provogpt")}
                disabled={aiStartingSession}
                className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  {aiStartingSession ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" aria-hidden />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M13.65 3.75L7.75 12.2h3.95L10.35 20.25l5.9-8.45H12.3l1.35-8.05z"
                        fill="currentColor"
                        fillOpacity="0.18"
                      />
                      <path
                        d="M13.65 3.75L7.75 12.2h3.95L10.35 20.25l5.9-8.45H12.3l1.35-8.05z"
                        stroke="currentColor"
                        strokeWidth={1.7}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.9 4.9l1.9-.85"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                      <path
                        d="M15.55 7.1h2.15"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-zinc-900">Crear con ProvoGPT</div>
                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                    AI
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Nunca fue tan sencillo crear un torneo de padel, conversa con ProvoGPT y crea tu próxima competencia.
                </p>
              </button>
            </div>

            {aiError && (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {aiError}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="secondary" onClick={closeCreateModal}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {createMode === "manual" && (
          <div className="space-y-5">
            {createFlowStep !== 4 && (
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    {activeCreateStepMeta.label}
                  </div>
                  <div className="text-sm font-semibold text-zinc-900">
                    {activeCreateStepMeta.focus}
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all"
                    style={{ width: `${createFlowProgress}%` }}
                  />
                </div>
                <div
                  className={`grid gap-2 ${
                    visibleCreateFlowTotal === 2 ? "grid-cols-2" : "grid-cols-3"
                  }`}
                >
                  {visibleCreateFlowSteps.map((step, index) => {
                    const isActive = currentCreateFlowVisualStep === step.step;
                    const isCompleted = currentCreateFlowVisualStep > step.step;
                    return (
                      <div
                        key={step.step}
                        className={`rounded-lg border px-2 py-1.5 text-xs transition-all duration-300 ${
                          isActive
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : isCompleted
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-500"
                        }`}
                      >
                        {isCompleted ? (
                          <span className="flex items-center gap-1">
                            <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            {step.label}
                          </span>
                        ) : (
                          <>{index + 1}. {step.label}</>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {createFlowStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="tournament-name-modal" className="text-xs font-semibold text-zinc-600">
                    Nombre de la competencia
                  </label>
                  <Input
                    id="tournament-name-modal"
                    placeholder={competitionTypeNamePlaceholders[competitionType]}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    aria-invalid={Boolean(fieldErrors.name)}
                  />
                  {fieldErrors.name && (
                    <p className="text-xs font-medium text-red-600">{fieldErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-zinc-600">¿Qué tipo de competencia es?</div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {competitionTypeOptions.map((option) => {
                      const active = competitionType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setCompetitionType(option.value);
                            setFieldErrors((prev) => ({
                              ...prev,
                              matchDurationMinutes: undefined,
                              courtsCount: undefined,
                            }));
                          }}
                          className={`rounded-xl border p-3 text-left transition-all duration-200 ${
                            active
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50"
                          }`}
                        >
                          <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-zinc-100"}`}>
                            {option.value === "tournament" && (
                              <svg className={`h-4 w-4 ${active ? "text-white" : "text-zinc-600"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.02 9.02 0 01-2.48 5.228m2.48-5.492a23.278 23.278 0 00-2.48.492m-8.52 0a7.454 7.454 0 00-.982 3.172" />
                              </svg>
                            )}
                            {option.value === "league" && (
                              <svg className={`h-4 w-4 ${active ? "text-white" : "text-zinc-600"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                              </svg>
                            )}
                            {option.value === "flash" && (
                              <svg className={`h-4 w-4 ${active ? "text-white" : "text-zinc-600"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                              </svg>
                            )}
                          </div>
                          <div className="text-sm font-semibold">{option.label}</div>
                          <p className={`mt-1 text-xs ${active ? "text-zinc-300" : "text-zinc-500"}`}>
                            {competitionTypeHints[option.value]}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {createFlowStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                  Configuración para <span className="font-semibold">{competitionTypeLabel(competitionType)}</span>
                </div>
                {competitionType === "league" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    En formato liga no necesitás definir duración ni canchas en esta etapa.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {competitionType === "tournament" && (
                      <div className="space-y-1">
                        <label htmlFor="tournament-duration-modal" className="text-xs font-semibold text-zinc-600">
                          Duración por partido
                        </label>
                        <Input
                          id="tournament-duration-modal"
                          type="number"
                          min={1}
                          placeholder="Ej: 90"
                          value={matchDurationMinutes}
                          onChange={(e) => {
                            setMatchDurationMinutes(e.target.value);
                            setFieldErrors((prev) => ({ ...prev, matchDurationMinutes: undefined }));
                          }}
                          aria-invalid={Boolean(fieldErrors.matchDurationMinutes)}
                        />
                        {fieldErrors.matchDurationMinutes ? (
                          <p className="text-xs font-medium text-red-600">
                            {fieldErrors.matchDurationMinutes}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400">
                            Tiempo total en cancha, incluyendo cambios de lado. Para padel competitivo, 90 min es lo habitual.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="space-y-1">
                      <label htmlFor="tournament-courts-modal" className="text-xs font-semibold text-zinc-600">
                        ¿Cuántas canchas en simultáneo?
                      </label>
                      <Input
                        id="tournament-courts-modal"
                        type="number"
                        min={1}
                        placeholder="Ej: 2"
                        value={courtsCount}
                        onChange={(e) => {
                          setCourtsCount(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, courtsCount: undefined }));
                        }}
                        aria-invalid={Boolean(fieldErrors.courtsCount)}
                      />
                      {fieldErrors.courtsCount ? (
                        <p className="text-xs font-medium text-red-600">{fieldErrors.courtsCount}</p>
                      ) : (
                        <p className="text-xs text-zinc-400">
                          Usamos este dato para calcular los horarios del fixture automáticamente.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-400">
                  Puedes ajustar estos valores después desde la configuración de la competencia.
                </p>
              </div>
            )}

            {createFlowStep === 3 && (
              <div className="space-y-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Nombre</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">{name || "-"}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Formato</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                      {competitionTypeLabel(competitionType)}
                    </div>
                  </div>
                  {competitionType !== "league" && (
                    <>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Duración</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {competitionType === "tournament" ? `${matchDurationMinutes} min` : "No aplica"}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                        <div className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">Canchas</div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">{courtsCount}</div>
                      </div>
                    </>
                  )}
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {competitionType === "tournament"
                    ? `Torneo con ${matchDurationMinutes} min por partido y ${courtsCount} ${Number(courtsCount) === 1 ? "cancha" : "canchas"}. Al crear, sumás parejas y generás las zonas.`
                    : competitionType === "flash"
                    ? `Relámpago con ${courtsCount} ${Number(courtsCount) === 1 ? "cancha" : "canchas"}. Al crear, armás el fixture rápidamente.`
                    : "Liga lista para configurar. Al crear, podés sumar equipos y programar el calendario."}
                </div>
              </div>
            )}

            {createFlowStep === 4 && (
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-100">
                  <svg
                    className="h-7 w-7 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div className="text-xl font-bold text-zinc-900">
                  {lastCreatedCompetitionType === "league"
                    ? "Tu liga"
                    : lastCreatedCompetitionType === "flash"
                    ? "Tu relámpago"
                    : "Tu torneo"}{" "}
                  <span className="text-zinc-900">{lastCreatedTournament?.name}</span>{" "}
                  {lastCreatedCompetitionType === "league" ? "está lista" : "está listo"}
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  El próximo paso es cargar las parejas.
                </p>
              </div>
            )}

            {createError && createModalOpen && (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {createError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              {createFlowStep === 4 ? (
                <Button
                  className="ml-auto"
                  onClick={() => {
                    if (!lastCreatedTournament) {
                      closeCreateModal();
                      return;
                    }
                    const targetId = lastCreatedTournament.id;
                    closeCreateModal();
                    router.push(`/tournaments/${targetId}`);
                  }}
                >
                  Ir a la competencia
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (createFlowStep === 1) {
                        setCreateMode("choose");
                        setCreateError(null);
                        return;
                      }
                      handleCreateFlowBack();
                    }}
                    disabled={creating}
                  >
                    {createFlowStep === 1 ? "Volver" : "Atrás"}
                  </Button>
                  <Button onClick={handleCreateFlowContinue} disabled={creating} className="gap-2">
                    {creating && (
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        aria-hidden
                      />
                    )}
                    <span>
                      {createFlowStep === 3
                        ? creating
                          ? "Creando competencia..."
                          : "Crear competencia"
                        : "Continuar"}
                    </span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {createMode === "provogpt" && (
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.95fr)]">
              <div className="flex h-[min(78vh,720px)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="border-b border-zinc-200 bg-[#f0f2f5] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl shadow-sm">
                      <span aria-hidden>🤖</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">
                        ProvoGPT
                      </div>
                      <div className="text-xs text-zinc-500">
                        Asistente para crear competencias
                      </div>
                    </div>
                    <div className="group relative ml-auto">
                      <button
                        type="button"
                        onClick={() => {
                          resetAiDraft();
                          void startAiSession();
                        }}
                        disabled={aiBusy}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        aria-label="Comenzar de nuevo"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.2}
                          stroke="currentColor"
                          aria-hidden
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 12a9 9 0 101.88-5.4M3 4.5v4.2h4.2"
                          />
                        </svg>
                      </button>
                      <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        Comenzar de nuevo
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
                  style={provoChatBackgroundStyle}
                >
                  {aiMessages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`relative max-w-[88%] px-4 py-3 text-sm shadow-sm ${
                        message.role === "assistant"
                          ? "rounded-[7px_18px_18px_18px] bg-white text-zinc-800"
                          : "ml-auto rounded-[18px_7px_18px_18px] bg-[#d9fdd3] text-zinc-900"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-0 h-3.5 w-3.5 ${
                          message.role === "assistant"
                            ? "-left-[7px] bg-white [clip-path:polygon(100%_0,0_0,100%_100%)]"
                            : "-right-[7px] bg-[#d9fdd3] [clip-path:polygon(0_0,100%_0,0_100%)]"
                        }`}
                      />
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                        {message.role === "assistant" ? "ProvoGPT" : "Vos"}
                      </div>
                      {renderAiChatMessageContent(message)}
                    </div>
                  ))}

                  {(aiLoading || aiImportingPairs || aiGeneratingGroups) && (
                    <div className="relative max-w-[88%] rounded-[7px_18px_18px_18px] bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
                      <span
                        aria-hidden
                        className="absolute -left-[7px] top-0 h-3.5 w-3.5 bg-white [clip-path:polygon(100%_0,0_0,100%_100%)]"
                      />
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        ProvoGPT
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Escribiendo</span>
                        <span className="flex items-center gap-1" aria-hidden>
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                            style={{ animation: "provoTypingDot 1.2s infinite ease-in-out" }}
                          />
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                            style={{
                              animation: "provoTypingDot 1.2s infinite ease-in-out",
                              animationDelay: "0.2s",
                            }}
                          />
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-zinc-400"
                            style={{
                              animation: "provoTypingDot 1.2s infinite ease-in-out",
                              animationDelay: "0.4s",
                            }}
                          />
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={aiMessagesEndRef} />
                </div>

                <div className="space-y-3 border-t border-zinc-200 bg-[#f0f2f5] p-4">
                  {aiError && (
                    <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                      {aiError}
                    </div>
                  )}
                  {aiShowCompetitionTypeOptions && (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => void sendAiQuickReply("Torneo")}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Torneo
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendAiQuickReply("Liga")}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Liga
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendAiQuickReply("Relámpago")}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Relámpago
                      </button>
                    </div>
                  )}
                  {aiCanShowCreateRetryButton && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => void createTournamentWithAiDraft()}
                        disabled={aiBusy}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {aiCreatingTournament ? "Creando..." : "Reintentar crear competencia"}
                      </button>
                    </div>
                  )}
                  {lastCreatedTournament && aiPostCreateStage === "pair_offer" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleAiLoadPairsNow}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cargar parejas ahora
                      </button>
                      <button
                        type="button"
                        onClick={handleAiSkipPairs}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Más tarde
                      </button>
                    </div>
                  )}
                  {lastCreatedTournament && aiPostCreateStage === "pair_waiting" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={downloadAiPairsTemplate}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Descargar template
                      </button>
                      <button
                        type="button"
                        onClick={openAiPairsFilePicker}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Subir archivo
                      </button>
                      <input
                        ref={aiPairsFileInputRef}
                        type="file"
                        accept=".csv,.xls,.xlsx"
                        className="hidden"
                        onChange={(event) => void handleAiPairsFileUpload(event)}
                      />
                    </div>
                  )}
                  {lastCreatedTournament && aiPostCreateStage === "pair_review" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAiPendingPairs([]);
                          setAiPairImportErrors([]);
                          setAiTeamsPerGroupByDivision({});
                          setAiActiveDivisionKey(null);
                          setAiPostCreateStage("pair_waiting");
                          appendAiUserMessage("Cargar nuevo listado");
                          appendAiAssistantMessage(buildAiPairsTemplateMessage());
                        }}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cargar nuevo listado
                      </button>
                      <button
                        type="button"
                        onClick={() => void importAiPendingPairs()}
                        disabled={aiBusy || aiPendingPairs.length === 0}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {aiImportingPairs ? "Procesando..." : "Crear zonas y partidos"}
                      </button>
                    </div>
                  )}
                  {lastCreatedTournament && aiPostCreateStage === "generation_offer" && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleAiSkipGeneration}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Más tarde
                      </button>
                      <button
                        type="button"
                        onClick={handleAiGenerateNow}
                        disabled={aiBusy}
                        className="min-w-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Generar ahora
                      </button>
                    </div>
                  )}
                  {lastCreatedTournament && aiPostCreateStage === "generation_ready" && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => void generateAiGroupsFromChat()}
                        disabled={aiBusy}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {aiGeneratingGroups ? "Generando..." : "Generar zonas y partidos"}
                      </button>
                    </div>
                  )}
                  {aiShowTeamsPerGroupComposer && (
                    <div className="space-y-3">
                      <div className="rounded-[1.8rem] border border-zinc-200 bg-white p-3 shadow-sm">
                        <div className="flex flex-wrap gap-2">
                          {aiDivisionConfigs.map((division) => {
                            const active = aiCurrentDivision?.key === division.key;
                            const configured = (aiTeamsPerGroupByDivision[division.key] ?? 0) > 1;

                            return (
                              <button
                                key={division.key}
                                type="button"
                                onClick={() => setAiActiveDivisionKey(division.key)}
                                disabled={aiBusy}
                                className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                                  active
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                              >
                                <span>{division.category} · {division.gender}</span>
                                {configured ? (
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${
                                      active ? "bg-white/90" : "bg-emerald-500"
                                    }`}
                                    aria-hidden
                                  />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {aiCurrentDivision && (
                          <div className="mt-4 rounded-2xl bg-zinc-50 px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-zinc-900">
                                  {aiCurrentDivision.category} · {aiCurrentDivision.gender}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {aiCurrentDivision.count}{" "}
                                  {aiCurrentDivision.count === 1 ? "pareja detectada" : "parejas detectadas"}
                                </div>
                              </div>
                              {(aiTeamsPerGroupByDivision[aiCurrentDivision.key] ?? 0) > 1 ? (
                                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                  {aiTeamsPerGroupByDivision[aiCurrentDivision.key]} por zona
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {Array.from(
                                { length: Math.min(6, Math.max(2, aiCurrentDivision.count)) - 1 },
                                (_, index) => index + 2
                              ).map((value) => {
                                const active =
                                  aiTeamsPerGroupByDivision[aiCurrentDivision.key] === value;

                                return (
                                  <button
                                    key={`${aiCurrentDivision.key}-${value}`}
                                    type="button"
                                    onClick={() => {
                                      setAiTeamsPerGroupByDivision((prev) => ({
                                        ...prev,
                                        [aiCurrentDivision.key]: value,
                                      }));
                                      const nextUnconfiguredDivision = aiDivisionConfigs.find(
                                        (division) =>
                                          division.key !== aiCurrentDivision.key &&
                                          (aiTeamsPerGroupByDivision[division.key] ?? 0) <= 1
                                      );
                                      if (nextUnconfiguredDivision) {
                                        setAiActiveDivisionKey(nextUnconfiguredDivision.key);
                                      }
                                      setAiError(null);
                                    }}
                                    disabled={aiBusy}
                                    className={`min-w-[52px] rounded-full px-4 py-2 text-sm font-semibold transition ${
                                      active
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {value}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={confirmAiTeamsPerGroupByDivision}
                        disabled={aiBusy || !aiHasTeamsPerGroupConfig}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Usar esta configuración
                      </button>
                    </div>
                  )}
                  {aiShowScheduleComposer && (
                    <div className="space-y-3">
                      {aiScheduleWindows.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {aiScheduleWindows.map((window, index) => (
                            <div
                              key={`${window.date}-${window.start_time}-${window.end_time}-${index}`}
                              className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900"
                            >
                              <span>{formatAiScheduleWindowLabel(window)}</span>
                              <button
                                type="button"
                                onClick={() => removeAiScheduleWindow(index)}
                                disabled={aiBusy}
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`Quitar ${formatAiScheduleWindowLabel(window)}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-[1.8rem] border border-zinc-200 bg-white p-3 shadow-sm">
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
                          <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Fecha
                            </div>
                            <input
                              type="date"
                              value={aiScheduleDateInput}
                              onChange={(event) => setAiScheduleDateInput(event.target.value)}
                              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
                            />
                          </label>
                          <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Desde
                            </div>
                            <input
                              type="time"
                              value={aiScheduleStartTimeInput}
                              onChange={(event) => setAiScheduleStartTimeInput(event.target.value)}
                              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
                            />
                          </label>
                          <label className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              Hasta
                            </div>
                            <input
                              type="time"
                              value={aiScheduleEndTimeInput}
                              onChange={(event) => setAiScheduleEndTimeInput(event.target.value)}
                              className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={addAiScheduleWindow}
                            disabled={aiBusy}
                            className="flex h-full min-h-[58px] items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={confirmAiScheduleWindows}
                        disabled={aiBusy || aiScheduleWindows.length === 0}
                        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold text-teal-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Usar estos horarios
                      </button>
                    </div>
                  )}
                  {aiShowInput && (
                    <div className="flex items-end gap-3">
                      <textarea
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        rows={1}
                        placeholder="Escribe un mensaje"
                        className="min-h-[44px] flex-1 resize-none rounded-[1.6rem] border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void sendAiMessage();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void sendAiMessage()}
                        disabled={!aiInput.trim() || aiBusy}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                        aria-label={aiLoading ? "Enviando mensaje" : "Enviar mensaje"}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h11m0 0-4.5-4.5M17 12l-4.5 4.5" />
                        </svg>
                      </button>
                    </div>
                  )}
                  {aiConversationClosed && (
                    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                      Conversación finalizada. Si quieres retomarla, presiona &quot;Comenzar de nuevo&quot;.
                    </div>
                  )}
                </div>
              </div>

              <div className="max-h-[min(78vh,720px)] space-y-4 overflow-y-auto pr-1">
                {lastCreatedTournament && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-4">
                    <div className="text-sm font-semibold text-zinc-900">Competencia creada</div>
                    <div className="mt-2 text-lg font-semibold text-zinc-900">
                      {lastCreatedTournament.name}
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">
                      {competitionTypeLabel(lastCreatedTournament.competitionType)}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <div className="text-sm font-semibold text-zinc-900">Datos del torneo</div>
                  <div className="mt-3 space-y-2">
                    {aiDraftEntries.length === 0 ? (
                      <p className="text-sm text-zinc-500">
                        Todavía no hay datos confirmados. Responde las preguntas del chat y ProvoGPT irá armando la competencia.
                      </p>
                    ) : (
                      aiDraftEntries.map(([field, value]) => (
                        <div key={field} className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                            {tournamentCreationFieldLabels[field]}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {formatAiDraftValue(field, value)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {aiScheduleWindows.length > 0 && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Ventanas de juego</div>
                    <div className="mt-3 space-y-2">
                      {aiScheduleWindows.map((window, index) => (
                        <div key={`${window.date}-${window.start_time}-${index}`} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                          {formatAiScheduleWindowLabel(window)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {aiHasTeamsPerGroupConfig && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Parejas por zona</div>
                    <div className="mt-3 space-y-2">
                      {aiDivisionConfigs.map((division) => (
                        <div
                          key={`division-${division.key}`}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                            {division.category} · {division.gender}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {aiTeamsPerGroupByDivision[division.key]} por zona
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastCreatedTournament &&
                  (aiImportedPairs.length > 0 || aiPairImportErrors.length > 0) && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                    <div className="text-sm font-semibold text-zinc-900">Parejas</div>
                    <div className="mt-3 space-y-2">
                      {aiImportedPairs.length > 0 && (
                        <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                          Parejas cargadas:{" "}
                          <span className="font-semibold text-zinc-900">{aiImportedPairs.length}</span>
                        </div>
                      )}
                      {aiPairImportErrors.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          Hubo problemas al cargar {aiPendingPairs.length}{" "}
                          {aiPendingPairs.length === 1 ? "pareja" : "parejas"}.{" "}
                          {aiPairImportErrors.join(" ")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                {lastCreatedTournament && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const targetId = lastCreatedTournament.id;
                      closeCreateModal();
                      router.push(`/tournaments/${targetId}`);
                    }}
                  >
                    Ir a la competencia
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="space-y-4">
        {/* Título + búsqueda + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-200">
            Competencias
            {hasCompetitions && (
              <span className="ml-2 text-xs font-normal text-zinc-400">
                {filteredAndSortedItems.length} de {items.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasCompetitions && (
              <>
                <Input
                  id="search-tournaments"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-44"
                />
                {items.length >= 3 && (
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="h-10 rounded-xl border border-zinc-600 bg-transparent px-3 text-xs text-zinc-300 outline-none focus:border-zinc-400"
                  >
                    {sortOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-zinc-800 text-zinc-100">
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pills de estado (solo si hay competencias) */}
        {hasCompetitions && (
          <div className="flex flex-wrap gap-1.5">
            {statusFilterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  statusFilter === opt.value
                    ? "border-zinc-100 bg-white text-zinc-900"
                    : "border-zinc-600 bg-transparent text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Grid de torneos / estados vacíos */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            <>
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="animate-pulse overflow-hidden">
                  <div className="h-40 bg-zinc-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-36 rounded bg-zinc-200" />
                    <div className="h-3 w-24 rounded bg-zinc-100" />
                    <div className="h-3 w-16 rounded bg-zinc-100" />
                  </div>
                </Card>
              ))}
            </>
          ) : items.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 border-2 border-dashed border-zinc-700 !bg-zinc-800/40 shadow-none ring-0">
              <div className="p-10 flex flex-col items-center text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
                  <svg className="h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.02 9.02 0 01-2.48 5.228m2.48-5.492a23.278 23.278 0 00-2.48.492m-8.52 0a7.454 7.454 0 00-.982 3.172" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="text-base font-semibold text-zinc-200">Todavía no tenés competencias</div>
                  <p className="text-sm text-zinc-400">Crea la primera y empieza a organizar tus torneos.</p>
                </div>
                <Button variant="green" onClick={openCreateModal}>+ Nueva competencia</Button>
              </div>
            </Card>
          ) : filteredAndSortedItems.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <div className="p-8 flex flex-col items-center text-center gap-3">
                <div className="text-sm text-zinc-500">No hay competencias con esos filtros.</div>
                <button
                  type="button"
                  onClick={() => { setSearch(""); setStatusFilter("all"); }}
                  className="text-xs font-medium text-zinc-400 underline underline-offset-2 hover:text-zinc-700 transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            </Card>
          ) : (
            paginatedItems.map((t) => {
              const tournamentStatus = statusByTournamentId[t.id] ?? "upcoming";
              const isRecentlyCreated = recentlyCreatedId === t.id;
              const dateLabel = formatDateRange(t.start_date, t.end_date);
              const cardType = (t.competition_type ?? "tournament") as CompetitionType;
              const cardConfig = typeCardConfig[cardType] ?? typeCardConfig.tournament;
              return (
                <Link key={t.id} href={`/tournaments/${t.id}`}>
                  <Card
                    className={`overflow-hidden transition hover:-translate-y-1 hover:shadow-2xl ${
                      isRecentlyCreated ? "ring-2 ring-emerald-300 shadow-emerald-200/40" : ""
                    }`}
                  >
                    {/* Visual area */}
                    <div className={`relative flex h-40 items-center justify-center ${cardConfig.bg}`}>
                      {cardType === "tournament" && (
                        <svg className={`h-20 w-20 ${cardConfig.iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.02 9.02 0 01-2.48 5.228m2.48-5.492a23.278 23.278 0 00-2.48.492m-8.52 0a7.454 7.454 0 00-.982 3.172" />
                        </svg>
                      )}
                      {cardType === "league" && (
                        <svg className={`h-20 w-20 ${cardConfig.iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                        </svg>
                      )}
                      {cardType === "flash" && (
                        <svg className={`h-20 w-20 ${cardConfig.iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      )}
                      <div className="absolute top-3 right-3">
                        <StatusBadge status={tournamentStatus} />
                      </div>
                      {isRecentlyCreated && (
                        <div className="absolute top-3 left-3">
                          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                            Nuevo
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Info area */}
                    <div className="p-4 space-y-1">
                      <div className="text-sm font-semibold leading-snug">{t.name}</div>
                      {dateLabel !== "Sin fecha" && (
                        <div className="text-xs text-zinc-500">{dateLabel}</div>
                      )}
                      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        {competitionTypeLabel(t.competition_type)}
                        {t.courts_count != null && t.courts_count > 0 && (
                          <span className="ml-1.5 normal-case tracking-normal">
                            · {t.courts_count} {t.courts_count === 1 ? "cancha" : "canchas"}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Footer */}
                    <div className={`border-t px-4 py-2.5 text-xs text-right font-medium ${
                      isRecentlyCreated
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-100 bg-zinc-50/50 text-zinc-400"
                    }`}>
                      Ver competencia →
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  p === page
                    ? "border-zinc-100 bg-white text-zinc-900"
                    : "border-zinc-600 bg-transparent text-zinc-400 hover:border-zinc-400 hover:text-zinc-200"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="rounded-full border border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        )}
      </div>

    </div>
    <style jsx>{`
      @keyframes provoTypingDot {
        0%,
        60%,
        100% {
          opacity: 0.25;
          transform: translateY(0);
        }
        30% {
          opacity: 1;
          transform: translateY(-1px);
        }
      }
    `}</style>
    </>
  );
}
