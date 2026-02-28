"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatusBadge from "@/components/StatusBadge";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Tournament, TournamentStatus, TournamentStatusResponse } from "@/lib/types";
import { useRouter } from "next/navigation";

type TournamentFieldErrors = {
  name?: string;
  matchDurationMinutes?: string;
  courtsCount?: string;
};

type CompetitionType = "tournament" | "league" | "flash";
type StatusFilter = "all" | TournamentStatus;
type SortOption = "recent" | "name_asc" | "name_desc" | "start_asc" | "start_desc";

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

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Más recientes" },
  { value: "name_asc", label: "Nombre (A-Z)" },
  { value: "name_desc", label: "Nombre (Z-A)" },
  { value: "start_asc", label: "Fecha inicio (próxima)" },
  { value: "start_desc", label: "Fecha inicio (lejana)" },
];
const competitionTypeOptions: { value: CompetitionType; label: string }[] = [
  { value: "tournament", label: "Torneo" },
  { value: "league", label: "Liga" },
  { value: "flash", label: "Relámpago" },
];

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

export default function TournamentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Tournament[]>([]);
  const [statusByTournamentId, setStatusByTournamentId] = useState<
    Record<number, TournamentStatus>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultDescription =
    "Reglas de la competencia:\n" +
    "- Partidos al mejor de 3 sets (gana quien llega a 2).\n" +
    "- Puntos en fase de grupos:\n" +
    "  - 2-0: 3 pts\n" +
    "  - 2-1: 2 pts\n" +
    "  - 1-2: 1 pt\n" +
    "  - 0-2: 0 pts\n" +
    "- Criterios de clasificación: puntos, diferencia de sets, diferencia de games.";

  const [name, setName] = useState("");
  const [competitionType, setCompetitionType] = useState<CompetitionType>("tournament");
  const [description, setDescription] = useState(defaultDescription);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState("90");
  const [courtsCount, setCourtsCount] = useState("1");
  const [creating, setCreating] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<TournamentFieldErrors>({});
  const [showOptionalRules, setShowOptionalRules] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const [recentlyCreatedId, setRecentlyCreatedId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Tournament[]>("/tournaments");
      setItems(data);

      const statuses = await Promise.all(
        data.map(async (tournament) => {
          try {
            const status = await api<TournamentStatusResponse>(
              `/tournaments/${tournament.id}/status`
            );
            return [tournament.id, status.status] as const;
          } catch {
            return [tournament.id, "upcoming"] as const;
          }
        })
      );

      setStatusByTournamentId(Object.fromEntries(statuses));
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(getErrorMessage(err, "No se pudieron cargar las competencias."));
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
      setError(null);
      return;
    }

    setCreating(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await api<Tournament>("/tournaments", {
        method: "POST",
        body: {
          name: trimmedName,
          competition_type: competitionType,
          description: showOptionalRules
            ? description.trim() || null
            : competitionType === "tournament"
            ? defaultDescription
            : null,
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
      setName("");
      setCompetitionType("tournament");
      setDescription(defaultDescription);
      setMatchDurationMinutes("90");
      setCourtsCount("1");
      setShowOptionalRules(false);
      setRecentlyCreatedId(created.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo crear la competencia."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Gestión
          </div>
          <h1 className="text-3xl font-semibold">Competencias</h1>
          <p className="text-sm text-zinc-300">Creá y administrá tus competencias.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:-translate-y-0.5 hover:bg-zinc-50"
        >
          Volver al tablero
        </Link>
      </div>

      <Card className="bg-white/95">
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-zinc-800">Nueva competencia</div>
            <p className="text-xs text-zinc-600">
              Elegí tipo de competencia y completá lo esencial.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="tournament-name" className="text-xs font-semibold text-zinc-600">
                Nombre de la competencia
              </label>
              <Input
                id="tournament-name"
                placeholder="Ej: Liga Apertura 2026"
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-600">Tipo</label>
              <select
                value={competitionType}
                onChange={(e) => setCompetitionType(e.target.value as CompetitionType)}
                className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
              >
                {competitionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {(competitionType === "tournament" || competitionType === "flash") && (
              <>
                {competitionType === "tournament" && (
                  <div className="space-y-1">
                    <label
                      htmlFor="tournament-duration"
                      className="text-xs font-semibold text-zinc-600"
                    >
                      Duración del partido (min)
                    </label>
                    <Input
                      id="tournament-duration"
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
                    {fieldErrors.matchDurationMinutes && (
                      <p className="text-xs font-medium text-red-600">
                        {fieldErrors.matchDurationMinutes}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <label htmlFor="tournament-courts" className="text-xs font-semibold text-zinc-600">
                    Canchas simultáneas
                  </label>
                  <Input
                    id="tournament-courts"
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
                  {fieldErrors.courtsCount && (
                    <p className="text-xs font-medium text-red-600">{fieldErrors.courtsCount}</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
            <button
              type="button"
              onClick={() => setShowOptionalRules((prev) => !prev)}
              className="flex w-full items-center justify-between text-left text-sm font-semibold text-zinc-700"
            >
              <span>Reglas y descripción (opcional)</span>
              <span className="text-zinc-500">{showOptionalRules ? "Ocultar" : "Editar"}</span>
            </button>

            {!showOptionalRules && (
              <p className="text-xs text-zinc-500">
                Se aplicarán reglas estándar automáticamente para crear más rápido.
              </p>
            )}

            {showOptionalRules && (
              <textarea
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                placeholder="Descripción / reglas de la competencia"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={createTournament}
              disabled={creating}
              className="md:w-44 gap-2"
            >
              {creating && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden
                />
              )}
              <span>{creating ? "Creando competencia..." : "Crear competencia"}</span>
            </Button>
            <span className="text-xs text-zinc-500">
              Podés editar la competencia después de crearla.
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-zinc-200">Competencias creadas</div>
          {!loading && (
            <div className="text-xs text-zinc-400">
              {filteredAndSortedItems.length} de {items.length}
            </div>
          )}
          {loading && <div className="text-xs text-zinc-500">Cargando...</div>}
        </div>

        <Card className="bg-white/95">
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="search-tournaments" className="text-xs font-semibold text-zinc-600">
                Buscar
              </label>
              <Input
                id="search-tournaments"
                placeholder="Nombre de la competencia"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="filter-status" className="text-xs font-semibold text-zinc-600">
                Estado
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="sort-by" className="text-xs font-semibold text-zinc-600">
                Ordenar por
              </label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-10 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {loading ? (
            <>
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={`skeleton-${index}`} className="animate-pulse">
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-40 rounded bg-zinc-200" />
                    <div className="h-3 w-28 rounded bg-zinc-100" />
                    <div className="h-3 w-20 rounded bg-zinc-100" />
                  </div>
                </Card>
              ))}
            </>
          ) : filteredAndSortedItems.length === 0 ? (
                <Card className="md:col-span-2">
                  <div className="p-5 text-sm text-zinc-600">
                    No encontramos competencias con esos filtros.
                  </div>
                </Card>
          ) : (
            filteredAndSortedItems.map((t) => {
              const tournamentStatus = statusByTournamentId[t.id] ?? "upcoming";
              const isRecentlyCreated = recentlyCreatedId === t.id;
              return (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Card
                  className={`transition hover:-translate-y-0.5 hover:shadow-xl ${
                    isRecentlyCreated
                      ? "ring-2 ring-emerald-300 shadow-emerald-200/40"
                      : ""
                  }`}
                >
                  <div className="p-5 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold">{t.name}</div>
                      <div className="text-sm text-zinc-600">{formatDateRange(t.start_date, t.end_date)}</div>
                      {t.location?.trim() && (
                        <div className="text-xs text-zinc-500">{t.location}</div>
                      )}
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {competitionTypeLabel(t.competition_type)}
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <StatusBadge status={tournamentStatus} />
                      <div className="text-zinc-400">→</div>
                    </div>
                  </div>
                  {isRecentlyCreated && (
                    <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-2 text-xs font-medium text-emerald-700">
                      Recién creado
                    </div>
                  )}
                </Card>
              </Link>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
