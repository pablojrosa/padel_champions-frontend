"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Tournament, TournamentStatus } from "@/lib/types";
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
const competitionTypeNamePlaceholders: Record<CompetitionType, string> = {
  tournament: "Ej: Torneo Apertura 2026",
  league: "Ej: Liga Apertura 2026",
  flash: "Ej: Relámpago Verano 2026",
};

const createFlowSteps: { step: 1 | 2 | 3; label: string; focus: string }[] = [
  { step: 1, label: "Nombre", focus: "Dale vida a tu competencia" },
  { step: 2, label: "Formato", focus: "¿Cómo van a jugar?" },
  { step: 3, label: "Confirmar", focus: "Casi listo, revisa." },
];
const totalCreateFlowSteps = createFlowSteps.length;

function competitionTypeLabel(value?: string | null) {
  if (value === "league") return "Liga";
  if (value === "flash") return "Relámpago";
  return "Torneo";
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
  const [createFlowStep, setCreateFlowStep] = useState<CreateFlowStep>(1);
  const [lastCreatedTournament, setLastCreatedTournament] = useState<{
    id: number;
    name: string;
  } | null>(null);

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

  function openCreateModal() {
    setCreateModalOpen(true);
    setCreateFlowStep(1);
    setFieldErrors({});
    setCreateError(null);
    setLastCreatedTournament(null);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateFlowStep(1);
    setFieldErrors({});
    setCreateError(null);
    setLastCreatedTournament(null);
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
      setLastCreatedTournament({ id: created.id, name: created.name });
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
  const hasCompetitions = !loading && items.length > 0;

  return (
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
          createFlowStep === 4
            ? ""
            : `Nueva competencia · Paso ${currentVisibleStepIndex + 1}/${visibleCreateFlowTotal}`
        }
        onClose={closeCreateModal}
        className="max-w-3xl"
      >
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
                {competitionType === "league" ? "Tu liga" : competitionType === "flash" ? "Tu relámpago" : "Tu torneo"}{" "}
                <span className="text-zinc-900">{lastCreatedTournament?.name}</span>{" "}
                {competitionType === "league" ? "está lista" : "está listo"}
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
              <>
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
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCreateFlowBack}
                  disabled={creating || createFlowStep === 1}
                >
                  Atrás
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
  );
}
