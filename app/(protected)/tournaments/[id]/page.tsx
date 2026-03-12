"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError, apiMaybe } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Player, Team, Tournament } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import GroupsPanel, { type GroupsPanelHandle } from "@/components/GroupsPanel";
import type { TournamentGroupOut } from "@/lib/types";
import type {
  TournamentStatus,
  TournamentStatusResponse,
  GenerateGroupsResponse,
  TournamentGroup,
  StartTournamentResponse,
} from "@/lib/types";


type IdParam = { id: string };
type CompetitionType = "tournament" | "league" | "flash";

type RulesContent = {
  title: string;
  subtitle?: string;
  items: string[];
};

const rulesContentByType: Record<CompetitionType, RulesContent> = {
  tournament: {
    title: "Reglas del torneo",
    subtitle: "Cuando veas 2-0 o 2-1, se refiere a sets ganados y perdidos.",
    items: [
      "Los partidos se juegan al mejor de 3 sets.",
      "Si una pareja gana por 2 sets a 0, suma 3 puntos.",
      "Si una pareja gana por 2 sets a 1, suma 2 puntos.",
      "Si una pareja pierde por 1 set a 2, suma 1 punto.",
      "Si una pareja pierde por 0 sets a 2, suma 0 puntos.",
      "Desempate: puntos, diferencia de sets y diferencia de games.",
    ],
  },
  league: {
    title: "Reglas de la liga",
    items: [
      "Los partidos se juegan al mejor de 3 sets.",
      "Cada victoria suma 3 puntos.",
      "Cada derrota suma 0 puntos.",
      "Desempate: puntos, diferencia de sets y diferencia de games.",
      "Formato todos contra todos.",
    ],
  },
  flash: {
    title: "Reglas del relámpago",
    items: [
      "Formato de eliminación directa.",
      "Los partidos se juegan al mejor de 3 sets.",
      "No hay fase de grupos.",
    ],
  },
};

function serializeRulesContent(content: RulesContent) {
  return [content.title, ...content.items.map((item) => `- ${item}`)].join("\n");
}

const fixedDescriptionByType: Record<CompetitionType, string> = {
  tournament: serializeRulesContent(rulesContentByType.tournament),
  league: serializeRulesContent(rulesContentByType.league),
  flash: serializeRulesContent(rulesContentByType.flash),
};

const IMPORT_TEMPLATE_HEADERS = [
  "Nombre Jugador 1",
  "Nombre Jugador 2",
  "Categoria",
  "Genero",
  "Restricciones",
];
const IMPORT_TEMPLATE_SAMPLE = [
  "Ana",
  "Carla",
  "6",
  "Damas",
  "No puede viernes",
];
const IMPORT_PAIRS_TOOLTIP =
  "La forma mas rapida de cargar parejas, desde un archivo tipo Excel.";

const HEADER_FIELD_MAP: Record<string, string> = {
  nombrejugador1: "p1_first_name",
  nombrejugador2: "p2_first_name",
  jugador1nombre: "p1_first_name",
  jugador1apellido: "p1_last_name",
  jugador2nombre: "p2_first_name",
  jugador2apellido: "p2_last_name",
  categoria: "category",
  genero: "gender",
  restricciones: "constraints",
  restriccioneshorarias: "constraints",
  disponibilidad: "constraints",
};
const FIELD_LABELS: Record<string, string> = {
  p1_first_name: "Nombre Jugador 1",
  p1_last_name: "Jugador 1 Apellido",
  p2_first_name: "Nombre Jugador 2",
  p2_last_name: "Jugador 2 Apellido",
  category: "Categoria",
  gender: "Genero",
  constraints: "Restricciones",
};

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}

function normalizeScheduleConstraints(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasScheduleRestrictions(value?: string | null) {
  const normalized = normalizeScheduleConstraints(value);
  if (!normalized) return false;
  return !/^(sin\s+restricciones?(?:\s+horarias?)?|sin\s+problemas?(?:\s+(?:de|con)\s+horarios?)?|sin\s+limitaciones?(?:\s+horarias?)?|disponibilidad\s+completa|libre)$/.test(
    normalized
  );
}

function CompetitionTypeIcon({
  type,
  className = "",
}: {
  type: CompetitionType;
  className?: string;
}) {
  if (type === "league") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    );
  }
  if (type === "flash") {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.02 9.02 0 01-2.48 5.228m2.48-5.492a23.278 23.278 0 00-2.48.492m-8.52 0a7.454 7.454 0 00-.982 3.172" />
    </svg>
  );
}

function HelpTooltip({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={`group relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="Mas informacion"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300 bg-white text-[11px] font-bold text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-300"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max max-w-[18rem] -translate-x-1/2 rounded-lg border border-zinc-200 bg-zinc-900 px-3 py-2 text-center text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function RulesSummary({
  type,
  className = "",
}: {
  type: CompetitionType;
  className?: string;
}) {
  const content = rulesContentByType[type];

  return (
    <div className={`rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 ${className}`}>
      <div className="text-sm font-semibold text-zinc-900">{content.title}</div>
      {content.subtitle ? (
        <p className="mt-1 text-xs text-zinc-500">{content.subtitle}</p>
      ) : null}
      <ul className="mt-3 space-y-2 text-sm text-zinc-600">
        {content.items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams<IdParam>();
  const tournamentId = Number(params.id);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [deletingTournament, setDeletingTournament] = useState(false);

  type UiTeam = Team & { pending?: boolean };
  const [teams, setTeams] = useState<UiTeam[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create team with new players
  const [pairOpen, setPairOpen] = useState(false);
  const [pairSaving, setPairSaving] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [p1FirstName, setP1FirstName] = useState("");
  const [p2FirstName, setP2FirstName] = useState("");
  const [pairCategory, setPairCategory] = useState("");
  const [pairGender, setPairGender] = useState("");
  const [pairScheduleConstraints, setPairScheduleConstraints] = useState("");
  const [pairHasScheduleRestrictions, setPairHasScheduleRestrictions] = useState(false);
  const [importingPairs, setImportingPairs] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    failed: number;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const groupsPanelRef = useRef<GroupsPanelHandle | null>(null);

  // Delete team from tournament
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  // Status + Groups
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [teamsPerGroup, setTeamsPerGroup] = useState<number>(2);
  const [generatingGroups, setGeneratingGroups] = useState(false);
  const [teamsGroupFilter, setTeamsGroupFilter] = useState<number | "all">("all");
  const [teamsCategoryFilter, setTeamsCategoryFilter] = useState<string | "all">("all");
  const [teamsGenderFilter, setTeamsGenderFilter] = useState<string | "all">("all");
  const [teamsNameQuery, setTeamsNameQuery] = useState("");

  const [startingTournament, setStartingTournament] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmStartModalOpen, setConfirmStartModalOpen] = useState(false);
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [teamToDelete, setTeamToDelete] = useState<number | null>(null);
  const [startSuccessModalOpen, setStartSuccessModalOpen] = useState(false);
  const [startSuccessCopyMessage, setStartSuccessCopyMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const aiGenerateAbortRef = useRef<AbortController | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompetitionType, setEditCompetitionType] = useState<CompetitionType>("tournament");
  const [editLocation, setEditLocation] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editMatchDurationMinutes, setEditMatchDurationMinutes] = useState("90");
  const [editCourtsCount, setEditCourtsCount] = useState("1");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [editPairOpen, setEditPairOpen] = useState(false);
  const [editPairSaving, setEditPairSaving] = useState(false);
  const [editPairError, setEditPairError] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<number | null>(null);
  const [editP1Id, setEditP1Id] = useState<number | null>(null);
  const [editP2Id, setEditP2Id] = useState<number | null>(null);
  const [editP1FirstName, setEditP1FirstName] = useState("");
  const [editP1LastName, setEditP1LastName] = useState("");
  const [editP2FirstName, setEditP2FirstName] = useState("");
  const [editP2LastName, setEditP2LastName] = useState("");
  const [editPairCategory, setEditPairCategory] = useState("");
  const [editPairGender, setEditPairGender] = useState("");
  const [editScheduleConstraints, setEditScheduleConstraints] = useState("");
  const [editPairHasScheduleRestrictions, setEditPairHasScheduleRestrictions] = useState(false);

  const categories = ["8va","7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];
  const genders = [
    { value: "masculino", label: "Masculino" },
    { value: "damas", label: "Damas" },
  ];


function hydrateTeams(rawTeams: Team[], players: Player[]): UiTeam[] {
  const playersById = new Map(players.map((p) => [p.id, p]));

  return rawTeams.map((team) => ({
    ...team,
    schedule_constraints: team.schedule_constraints ?? null,
    players: (team.players || [])
      .map((p) => playersById.get(p.id))
      .filter((p): p is Player => !!p)
      .map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
        category: p.category ?? null,
        gender: p.gender ?? null,
      })),
  }));
}

type TeamApi = {
  id: number;
  players: {
    id: number;
    first_name: string;
    last_name: string | null;
    category?: string | null;
    gender?: string | null;
  }[];
  schedule_constraints?: string | null;
};

function mapTeamsFromApi(rawTeams: TeamApi[], tournamentId: number): UiTeam[] {
  return rawTeams.map((team) => ({
    id: team.id,
    tournament_id: tournamentId,
    schedule_constraints: team.schedule_constraints ?? null,
    players: team.players.map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
      category: p.category ?? null,
      gender: p.gender ?? null,
    })),
  }));
}

async function load(options?: { silent?: boolean }) {
  const { silent = false } = options ?? {};
  if (!silent) {
    setLoading(true);
  }
  setError(null);

  try {
    // Disparamos todas las peticiones en paralelo
    const [tournaments, statusRes, tPlayers, rawTeams, tGroups] = await Promise.all([
      api<Tournament[]>("/tournaments"),
      api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      apiMaybe<Player[]>(`/tournaments/${tournamentId}/players`) || Promise.resolve([]),
      apiMaybe<Team[]>(`/tournaments/${tournamentId}/teams`) || Promise.resolve([]),
      apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) || Promise.resolve([])
    ]);

    // Una vez que todas terminan, actualizamos los estados
    const found = tournaments.find((t) => t.id === tournamentId) ?? null;
    setTournament(found);
    setStatus(statusRes.status);
    setPlayers(tPlayers || []);
    
    // Hidratamos equipos usando los jugadores recién obtenidos
    const hydratedTeams = hydrateTeams(rawTeams || [], tPlayers || []);
    setTeams(hydratedTeams);
    setGroups(tGroups || []);

    const persistedTeamsPerGroup =
      found?.teams_per_group && found.teams_per_group > 1
        ? found.teams_per_group
        : null;
    if (persistedTeamsPerGroup) {
      setTeamsPerGroup(Math.max(2, persistedTeamsPerGroup));
    } else if (tGroups && tGroups.length > 0) {
      const inferredTeamsPerGroup = Math.max(
        2,
        ...tGroups.map((group) => group.teams.length || 0)
      );
      setTeamsPerGroup(inferredTeamsPerGroup);
    }

  } catch (err: any) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      router.replace("/login");
      return;
    }
    setError(err?.message ?? "No se pudo cargar la competencia.");
  } finally {
    if (!silent) {
      setLoading(false);
    }
  }
}

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    if (!importingPairs) return;
    let active = true;
    const poll = async () => {
      if (!active) return;
      await load({ silent: true });
    };
    poll();
    const interval = window.setInterval(poll, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [importingPairs, tournamentId]);


  async function copyPublicLink() {
    const origin = window.location.origin;
    const url = `${origin}/viewer/tournaments/${tournamentId}`;
    setCopyMessage(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copia el link publico:", url);
      }
      setCopyMessage("Link publico copiado.");
    } catch (err) {
      setCopyMessage("No se pudo copiar el link.");
    }
  }

  function openEditModal() {
    if (!tournament) return;
    setEditName(tournament.name ?? "");
    setEditCompetitionType((tournament.competition_type ?? "tournament") as CompetitionType);
    setEditLocation(tournament.location ?? "");
    setEditStartDate(tournament.start_date?.slice(0, 10) ?? "");
    setEditMatchDurationMinutes(String(tournament.match_duration_minutes ?? 90));
    setEditCourtsCount(String(tournament.courts_count ?? 1));
    setEditError(null);
    setEditOpen(true);
  }
  async function deleteTeam(teamId: number) {
    const team = teams.find((t) => t.id === teamId);
    if (team?.pending) return;
    setTeamToDelete(teamId);
  }

  async function confirmDeleteTeam() {
    if (teamToDelete === null) return;
    const teamId = teamToDelete;
    setTeamToDelete(null);
    setDeletingTeamId(teamId);
    setError(null);
  
    try {
      await api(
        `/tournaments/${tournamentId}/teams/${teamId}`,
        { method: "DELETE" }
      );
  
      // 🔹 eliminar solo el equipo (jugadores quedan libres)
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar la pareja.");
    } finally {
      setDeletingTeamId(null);
    }
    if (groups.length > 0) {
      // Opcional: Limpiar los grupos o avisar que deben regenerarse
      // setGroups([]); 
      // O mejor, re-validar con el servidor:
      const updatedGroups = await apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) ?? [];
      setGroups(updatedGroups);
    }
  }
  

  function openPairModal() {
    setP1FirstName("");
    setP2FirstName("");
    setPairCategory("");
    setPairGender("");
    setPairScheduleConstraints("");
    setPairHasScheduleRestrictions(false);
    setPairError(null);
    setPairOpen(true);
  }

  function openEditPairModal(team: UiTeam) {
    if (status !== "upcoming") return;
    const [player1, player2] = team.players ?? [];
    const p1 = players.find((p) => p.id === player1?.id) ?? null;
    const p2 = players.find((p) => p.id === player2?.id) ?? null;

    setEditTeamId(team.id);
    setEditP1Id(p1?.id ?? player1?.id ?? null);
    setEditP2Id(p2?.id ?? player2?.id ?? null);
    setEditP1FirstName(p1?.first_name ?? "");
    setEditP1LastName(p1?.last_name ?? "");
    setEditP2FirstName(p2?.first_name ?? "");
    setEditP2LastName(p2?.last_name ?? "");
    setEditPairCategory(p1?.category ?? p2?.category ?? "");
    setEditPairGender(p1?.gender ?? p2?.gender ?? "");
    const teamHasRestrictions = hasScheduleRestrictions(team.schedule_constraints);
    setEditPairHasScheduleRestrictions(teamHasRestrictions);
    setEditScheduleConstraints(teamHasRestrictions ? team.schedule_constraints ?? "" : "");
    setEditPairError(null);
    setEditPairOpen(true);
  }

  async function saveEditPair() {
    if (!editTeamId || !editP1Id || !editP2Id) return;
    if (
      !editP1FirstName.trim() ||
      !editP2FirstName.trim() ||
      !editPairCategory ||
      !editPairGender
    ) {
      setEditPairError("Completa los datos de ambos jugadores.");
      return;
    }

    setEditPairSaving(true);
    setEditPairError(null);
    try {
      const updated = await api<{
        id: number;
        players: Player[];
        schedule_constraints?: string | null;
      }>(
        `/tournaments/${tournamentId}/teams/${editTeamId}`,
        {
          method: "PATCH",
          body: {
            players: [
              {
                player_id: editP1Id,
                first_name: editP1FirstName.trim(),
                last_name: editP1LastName.trim(),
                category: editPairCategory,
                gender: editPairGender,
              },
              {
                player_id: editP2Id,
                first_name: editP2FirstName.trim(),
                last_name: editP2LastName.trim(),
                category: editPairCategory,
                gender: editPairGender,
              },
            ],
            schedule_constraints:
              editPairHasScheduleRestrictions && editScheduleConstraints.trim()
              ? editScheduleConstraints.trim()
              : null,
          },
        }
      );

      setTeams((prev) =>
        prev.map((team) => {
          if (team.id !== updated.id) return team;
          const mappedPlayers = updated.players.map((p) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
            category: p.category ?? null,
            gender: p.gender ?? null,
          }));
          return {
            ...team,
            players: mappedPlayers,
            schedule_constraints: updated.schedule_constraints ?? null,
          };
        })
      );
      setPlayers((prev) =>
        prev.map((p) => {
          const replacement = updated.players.find((u) => u.id === p.id);
          return replacement ? replacement : p;
        })
      );
      setEditPairOpen(false);
    } catch (err: any) {
      setEditPairError(err?.message ?? "No se pudo editar la pareja");
    } finally {
      setEditPairSaving(false);
    }
  }

  async function createPair() {
    if (
      !p1FirstName.trim() ||
      !p2FirstName.trim() ||
      !pairCategory ||
      !pairGender
    ) {
      setPairError("Completa los datos de ambos jugadores.");
      return;
    }

    const tempId = -Date.now();
    const optimisticTeam: UiTeam = {
      id: tempId,
      tournament_id: tournamentId,
      pending: true,
      schedule_constraints:
        pairHasScheduleRestrictions && pairScheduleConstraints.trim()
        ? pairScheduleConstraints.trim()
        : null,
      players: [
        {
          id: tempId * 10 - 1,
          name: p1FirstName.trim(),
          category: pairCategory,
          gender: pairGender,
        },
        {
          id: tempId * 10 - 2,
          name: p2FirstName.trim(),
          category: pairCategory,
          gender: pairGender,
        },
      ],
    };

    setPairSaving(true);
    setPairError(null);
    setPairOpen(false);
    setTeams((prev) => [optimisticTeam, ...prev]);

    try {
      const res = await api<{ team_id: number; message: string }>(
        `/tournaments/${tournamentId}/teams/pair`,
        {
          method: "POST",
          body: {
            player1: {
              first_name: p1FirstName.trim(),
              category: pairCategory,
              gender: pairGender,
            },
            player2: {
              first_name: p2FirstName.trim(),
              category: pairCategory,
              gender: pairGender,
            },
            schedule_constraints:
              pairHasScheduleRestrictions && pairScheduleConstraints.trim()
              ? pairScheduleConstraints.trim()
              : null,
          },
        }
      );

      setTeams((prev) =>
        prev.map((team) =>
          team.id === tempId
            ? { ...team, id: res.team_id, pending: false }
            : team
        )
      );
      const [rawTeams, tGroups, tPlayers] = await Promise.all([
        api<TeamApi[]>(`/tournaments/${tournamentId}/teams`),
        apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) ||
          Promise.resolve([]),
        apiMaybe<Player[]>(`/tournaments/${tournamentId}/players`) ||
          Promise.resolve([]),
      ]);
      setTeams(mapTeamsFromApi(rawTeams, tournamentId));
      setGroups(tGroups || []);
      setPlayers(tPlayers || []);
    } catch (err: any) {
      setTeams((prev) => prev.filter((team) => team.id !== tempId));
      setError(err?.message ?? "No se pudo crear la pareja.");
    } finally {
      setPairSaving(false);
    }
  }

  function normalizeHeader(value: string) {
    return value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function normalizeGender(value: string) {
    const normalized = value.trim().toLowerCase();
    if (["damas", "femenino", "mujer", "f"].includes(normalized)) return "damas";
    if (["masculino", "caballeros", "hombre", "m"].includes(normalized)) {
      return "masculino";
    }
    return normalized;
  }
  function normalizeCategory(value: string) {
    const normalized = value.trim().toLowerCase();
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
    if (normalized === digitMatch[0]) {
      return categoryMap[digitMatch[0]] ?? normalized;
    }
    return categoryMap[digitMatch[0]] ?? normalized;
  }

  function downloadImportTemplate() {
    const rows = [
      IMPORT_TEMPLATE_HEADERS.join(","),
      IMPORT_TEMPLATE_SAMPLE.join(","),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "provopadel_template_parejas.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (status !== "upcoming") {
      setImportError("Solo podes importar parejas antes de iniciar la competencia.");
      return;
    }

    setImportingPairs(true);
    setImportError(null);
    setImportSummary(null);

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
      const headerKeys = headerRow.map(normalizeHeader);
      const fieldIndexes: Record<string, number> = {};

      headerKeys.forEach((key, idx) => {
        const mapped = HEADER_FIELD_MAP[key];
        if (mapped) fieldIndexes[mapped] = idx;
      });

      const requiredFields = ["p1_first_name", "p2_first_name", "category", "gender"];
      const missing = requiredFields.filter((field) => fieldIndexes[field] === undefined);
      if (missing.length > 0) {
        throw new Error(
          `Faltan columnas requeridas: ${missing
            .map((field) => FIELD_LABELS[field] ?? field)
            .join(", ")}.`
        );
      }

      const parseCell = (row: Array<string | number>, key: string) => {
        const idx = fieldIndexes[key];
        if (idx === undefined) return "";
        return String(row[idx] ?? "").trim();
      };

      const pairs: {
        player1: { first_name: string; last_name: string; category: string; gender: string };
        player2: { first_name: string; last_name: string; category: string; gender: string };
        schedule_constraints?: string | null;
      }[] = [];
      const rowErrors: string[] = [];

      rows.slice(1).forEach((row, index) => {
        const rowIndex = index + 2;
        const hasContent = row.some((cell) => String(cell ?? "").trim() !== "");
        if (!hasContent) return;

        const category = normalizeCategory(parseCell(row, "category"));
        const genderRaw = parseCell(row, "gender");
        const gender = normalizeGender(genderRaw);
        const p1FirstName = parseCell(row, "p1_first_name");
        const p2FirstName = parseCell(row, "p2_first_name");
        const constraints = parseCell(row, "constraints");

        if (!p1FirstName || !p2FirstName || !category || !gender) {
          rowErrors.push(`Fila ${rowIndex}: faltan datos obligatorios.`);
          return;
        }

        pairs.push({
          player1: {
            first_name: p1FirstName,
            last_name: "",
            category,
            gender,
          },
          player2: {
            first_name: p2FirstName,
            last_name: "",
            category,
            gender,
          },
          schedule_constraints: constraints ? constraints : "sin restricciones horarias",
        });
      });

      if (pairs.length === 0) {
        throw new Error("No se encontraron parejas validas para importar.");
      }

      let created = 0;
      let failed = 0;
      for (const pair of pairs) {
        try {
          await api(`/tournaments/${tournamentId}/teams/pair`, {
            method: "POST",
            body: pair,
          });
          created += 1;
        } catch (err: any) {
          failed += 1;
          if (rowErrors.length < 5) {
            rowErrors.push(err?.message ?? "Error al importar una fila.");
          }
        }
      }

      setImportSummary({ total: pairs.length, created, failed });
      if (rowErrors.length > 0) {
        setImportError(rowErrors.slice(0, 5).join(" "));
      }
      await load({ silent: true });
    } catch (err: any) {
      setImportError(err?.message ?? "No se pudo importar el archivo.");
    } finally {
      setImportingPairs(false);
    }
  }
  async function generateGroupsWithAi(payload: {
    teams_per_group_by_division: { category: string; gender: string; teams_per_group: number }[];
    schedule_windows: {
      date: string;
      start_time: string;
      end_time: string;
    }[];
    match_duration_minutes: number;
    courts_count: number;
  }) {
    const controller = new AbortController();
    aiGenerateAbortRef.current = controller;
    setGeneratingGroups(true);
    setError(null);
  
    try {
      const generation = await api<GenerateGroupsResponse>(
        `/tournaments/${tournamentId}/groups/generate`,
        {
          method: "POST",
          body: payload,
          signal: controller.signal,
        }
      );
      const tGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(tGroups);
      return generation;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        throw err;
      }
      setError(err instanceof Error ? err.message : "No se pudieron generar las zonas.");
      throw err;
    } finally {
      if (aiGenerateAbortRef.current === controller) {
        aiGenerateAbortRef.current = null;
      }
      setGeneratingGroups(false);
    }
  }

  function cancelGenerateGroupsWithAi() {
    aiGenerateAbortRef.current?.abort();
  }

  async function generateGroupsManual(payload: {
    teams_per_group: number;
    groups: { name?: string; team_ids: number[] }[];
  }) {
    setGeneratingGroups(true);
    setError(null);

    try {
      await api<GenerateGroupsResponse>(
        `/tournaments/${tournamentId}/groups/generate-manual`,
        {
          method: "POST",
          body: payload,
        }
      );
      const tGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(tGroups);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron guardar las zonas manuales."
      );
      throw err;
    } finally {
      setGeneratingGroups(false);
    }
  }

  async function startTournament() {
    setStartingTournament(true);
    setError(null);
  
    try {
      const res = await api<StartTournamentResponse>(`/tournaments/${tournamentId}/start`, {
        method: "POST",
        body: {},
      });
  
      setStatus(res.status);
      await load({ silent: true });
      setStartSuccessModalOpen(true);
      setStartSuccessCopyMessage(null);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo iniciar la competencia.");
    } finally {
      setStartingTournament(false);
    }
  }  

  function getPublicViewerLink() {
    return `${window.location.origin}/viewer/tournaments/${tournamentId}`;
  }

  async function copyStartedTournamentLink() {
    const url = getPublicViewerLink();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt("Copiá este link público:", url);
      }
      setStartSuccessCopyMessage("Link público copiado. Ya podés compartirlo.");
    } catch {
      setStartSuccessCopyMessage("No se pudo copiar el link. Prueba de nuevo.");
    }
  }
  
  async function deleteTournament() {
    setDeletingTournament(true);
    setError(null);
  
    try {
      await api(
        `/tournaments/${tournamentId}`,
        { method: "DELETE" }
      );
  
      // volver al listado
      router.replace("/tournaments");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar la competencia.");
    } finally {
      setDeletingTournament(false);
    }
  }

  async function updateTournament() {
    if (!tournament) return;
    if (!editName.trim()) {
      setEditError("El nombre de la competencia es obligatorio.");
      return;
    }
    const parsedMatchDuration = Number(editMatchDurationMinutes);
    const parsedCourtsCount = Number(editCourtsCount);
    if (editCompetitionType === "tournament") {
      if (!Number.isFinite(parsedMatchDuration) || parsedMatchDuration <= 0) {
        setEditError("La duracion del partido debe ser mayor a 0.");
        return;
      }
    }
    if (editCompetitionType === "tournament" || editCompetitionType === "flash") {
      if (!Number.isFinite(parsedCourtsCount) || parsedCourtsCount <= 0) {
        setEditError("La cantidad de canchas debe ser mayor a 0.");
        return;
      }
    }
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api<Tournament>(`/tournaments/${tournamentId}`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          competition_type: editCompetitionType,
          description: fixedDescriptionByType[editCompetitionType],
          location: editLocation.trim() ? editLocation.trim() : null,
          start_date: editStartDate || null,
          match_duration_minutes:
            editCompetitionType === "tournament"
              ? Math.trunc(parsedMatchDuration)
              : null,
          courts_count:
            editCompetitionType === "tournament" || editCompetitionType === "flash"
              ? Math.trunc(parsedCourtsCount)
              : 1,
        },
      });

      setTournament(updated);
      setEditOpen(false);
    } catch (err: any) {
      setEditError(err?.message ?? "No se pudo actualizar la competencia.");
    } finally {
      setSavingEdit(false);
    }
  }

  const formattedStartDate = formatDate(tournament?.start_date);
  const formattedEndDate = formatDate(tournament?.end_date);
  const tournamentDates =
    formattedStartDate && formattedEndDate
      ? `${formattedStartDate} - ${formattedEndDate}`
      : formattedStartDate || "Sin fecha definida";
  const locationLink =
    tournament?.location && tournament.location.startsWith("http")
      ? tournament.location
      : null;
  const getTeamGroup = (teamId: number) =>
    groups.find((g) => g.teams?.some((t) => t.id === teamId)) ?? null;
  const teamCategories = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      team.players?.forEach((player) => {
        if (player.category) values.add(player.category);
      });
    });
    return Array.from(values).sort();
  }, [teams]);
  const teamGenders = useMemo(() => {
    const values = new Set<string>();
    teams.forEach((team) => {
      team.players?.forEach((player) => {
        if (player.gender) values.add(player.gender);
      });
    });
    return Array.from(values).sort();
  }, [teams]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    teams.forEach((team) => {
      const category = team.players?.[0]?.category;
      if (!category) return;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return counts;
  }, [teams]);
  const genderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    teams.forEach((team) => {
      const gender = team.players?.[0]?.gender;
      if (!gender) return;
      counts.set(gender, (counts.get(gender) ?? 0) + 1);
    });
    return counts;
  }, [teams]);
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const groupMatch =
        teamsGroupFilter === "all" ||
        getTeamGroup(team.id)?.id === teamsGroupFilter;
      const category = team.players?.[0]?.category ?? null;
      const categoryMatch =
        teamsCategoryFilter === "all" || category === teamsCategoryFilter;
      const gender = team.players?.[0]?.gender ?? null;
      const genderMatch =
        teamsGenderFilter === "all" || gender === teamsGenderFilter;
      if (!groupMatch || !categoryMatch || !genderMatch) return false;
      const query = teamsNameQuery.trim().toLowerCase();
      if (!query) return true;
      const names =
        team.players
          ?.map((player) => player.name.toLowerCase())
          .join(" ") ?? "";
      return names.includes(query);
    });
  }, [teams, teamsGroupFilter, teamsCategoryFilter, teamsGenderFilter, teamsNameQuery, groups]);
  const normalizeTime = (value: string | null | undefined, fallback: string) =>
    value ? value.slice(0, 5) : fallback;
  const defaultStartDate =
    tournament?.start_date ?? new Date().toISOString().slice(0, 10);
  const defaultStartTime = normalizeTime(tournament?.start_time, "18:00");
  const defaultEndTime = normalizeTime(tournament?.end_time, "23:00");
  const defaultMatchDurationMinutes = tournament?.match_duration_minutes ?? 90;
  const defaultCourtsCount = tournament?.courts_count ?? 1;
  const competitionType = (tournament?.competition_type ?? "tournament") as CompetitionType;
  const competitionTypeDisplayLabel =
    competitionType === "league"
      ? "Liga"
      : competitionType === "flash"
      ? "Relámpago"
      : "Torneo";
  const startLabel =
    competitionType === "league"
      ? "Iniciar liga"
      : competitionType === "flash"
      ? "Iniciar relámpago"
      : "Iniciar torneo";
  const minTeamsRequired = competitionType === "flash" ? 2 : 1;
  const hasRequiredTeams = teams.length >= minTeamsRequired;
  const hasGeneratedGroups = groups.length > 0;
  const hasRequiredGroups = groups.length > 0;
  const canStartTournament =
    status === "upcoming" && hasRequiredGroups && hasRequiredTeams;

  const scrollToSection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const scrollToStartChecklist = useCallback(() => {
    scrollToSection("start-tournament-section");
  }, [scrollToSection]);

  const readinessItems = [
    {
      key: "teams",
      label: `Carga las parejas al ${competitionType === "league" ? "liga" : competitionType === "flash" ? "relámpago" : "torneo"}`,
      done: hasRequiredTeams,
      countInPending: true,
      actionLabel: "Cargar pareja",
      onAction: openPairModal,
      secondaryActionLabel: "Importar parejas",
      onSecondaryAction: () => importInputRef.current?.click(),
      secondaryDisabled: status !== "upcoming" || importingPairs,
    },
    {
      key: "groups",
      label:
        competitionType === "flash"
          ? hasGeneratedGroups
            ? "Zonas creadas"
            : "Crea las zonas"
          : hasGeneratedGroups
          ? "Zonas generadas"
          : "Genera las zonas",
      done: hasGeneratedGroups,
      countInPending: true,
      actionLabel:
        competitionType === "tournament"
          ? "Zonas manualmente"
          : competitionType === "flash"
          ? "Crear zonas"
          : "Ir a zonas",
      onAction: () => {
        if (groupsPanelRef.current) {
          groupsPanelRef.current.openGenerateModal();
          return;
        }
        scrollToSection("groups-panel");
      },
    },
    {
      key: "status",
      label: "Inicia la competencia",
      done: canStartTournament,
      countInPending: false,
      actionLabel: startLabel,
      onAction: startTournament,
    },
  ];
  const pendingReadinessCount = readinessItems.filter(
    (item) => item.countInPending !== false && !item.done
  ).length;
  const readinessDoneCount = readinessItems.filter((item) => item.done).length;
  const readinessProgress = Math.round(
    (readinessDoneCount / readinessItems.length) * 100
  );
  const nextReadinessItem =
    readinessItems.find((item) => !item.done && item.key !== "status") ??
    readinessItems.find((item) => !item.done) ??
    null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
<h1 className="text-3xl font-semibold">Detalle de la competencia</h1>
          <p className="text-sm text-zinc-300">Equipos, zonas y estado general.</p>
          <div className="space-y-1">

            <div
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5"
              aria-label={`Formato actual: ${competitionTypeDisplayLabel}`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                <CompetitionTypeIcon type={competitionType} className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold text-zinc-800">
                {competitionTypeDisplayLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1">
            <button
              type="button"
              aria-current="page"
              disabled
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
            >
              Resumen
            </button>
            <button
              type="button"
              onClick={() => router.push(`/tournaments/${tournamentId}/matches`)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Partidos
            </button>
            <button
              type="button"
              onClick={() => router.push(`/tournaments/${tournamentId}/playoffs`)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Playoffs
            </button>
          </div>
          <Button variant="secondary" onClick={() => router.push("/tournaments")}>
            Volver a competencias
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="bg-white/95">
          <div className="p-6 text-sm text-zinc-600">Cargando...</div>
        </Card>
      ) : (
        <>
          <Modal
            open={editOpen}
            title="Editar competencia"
            onClose={() => setEditOpen(false)}
          >
            <div className="space-y-3">
              <Input
                placeholder="Nombre de la competencia"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">
                  Tipo de competencia
                </label>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
                  {competitionTypeDisplayLabel}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">Reglas de la competencia</label>
                <RulesSummary type={editCompetitionType} />
                <p className="text-xs text-zinc-400">
                  Estas reglas son fijas según el formato de la competencia.
                </p>
              </div>
              <Input
                placeholder="Link de Google Maps"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500">
                  Fecha de inicio
                </label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
                <p className="text-xs text-zinc-400">
                  Si la dejas vacia, se completa con la fecha del primer partido que programes.
                </p>
              </div>
              {(editCompetitionType === "tournament" || editCompetitionType === "flash") && (
                <div className="grid gap-2 md:grid-cols-2">
                  {editCompetitionType === "tournament" && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-500">
                        Duracion del partido (min)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={editMatchDurationMinutes}
                        onChange={(e) => setEditMatchDurationMinutes(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-500">
                      Canchas simultaneas
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={editCourtsCount}
                      onChange={(e) => setEditCourtsCount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {editError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {editError}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={updateTournament}
                  disabled={savingEdit || !editName.trim()}
                >
                  {savingEdit ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={pairOpen}
            title="Agregar pareja"
            onClose={() => setPairOpen(false)}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Jugador 1
                </div>
                <Input
                  placeholder="Nombre"
                  value={p1FirstName}
                  onChange={(e) => setP1FirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Jugador 2
                </div>
                <Input
                  placeholder="Nombre"
                  value={p2FirstName}
                  onChange={(e) => setP2FirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Categoría
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={pairCategory}
                  onChange={(e) => setPairCategory(e.target.value)}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Género</div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={pairGender}
                  onChange={(e) => setPairGender(e.target.value)}
                >
                  <option value="">Seleccionar género</option>
                  {genders.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Limitantes de horarios
                </div>
                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={pairHasScheduleRestrictions}
                    onChange={(e) => setPairHasScheduleRestrictions(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                  />
                  <span>Esta pareja tiene restricciones horarias</span>
                </label>
                {pairHasScheduleRestrictions ? (
                  <textarea
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                    placeholder="Ej: viernes despues de las 19 y sábado sin problemas"
                    value={pairScheduleConstraints}
                    onChange={(e) => setPairScheduleConstraints(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Sin problemas de horarios.
                  </div>
                )}
              </div>

              {pairError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {pairError}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setPairOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createPair} disabled={pairSaving}>
                  {pairSaving ? "Guardando..." : "Guardar pareja"}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={editPairOpen}
            title="Editar pareja"
            onClose={() => setEditPairOpen(false)}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Jugador 1</div>
                <Input
                  placeholder="Nombre"
                  value={editP1FirstName}
                  onChange={(e) => setEditP1FirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Jugador 2</div>
                <Input
                  placeholder="Nombre"
                  value={editP2FirstName}
                  onChange={(e) => setEditP2FirstName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Categoría
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={editPairCategory}
                  onChange={(e) => setEditPairCategory(e.target.value)}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">Género</div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={editPairGender}
                  onChange={(e) => setEditPairGender(e.target.value)}
                >
                  <option value="">Seleccionar género</option>
                  {genders.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-zinc-900">
                  Limitantes de horarios
                </div>
                <label className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={editPairHasScheduleRestrictions}
                    onChange={(e) => setEditPairHasScheduleRestrictions(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                  />
                  <span>Esta pareja tiene restricciones horarias</span>
                </label>
                {editPairHasScheduleRestrictions ? (
                  <textarea
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                    placeholder="Ej: viernes despues de las 19 y sábado sin problemas"
                    value={editScheduleConstraints}
                    onChange={(e) => setEditScheduleConstraints(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Sin problemas de horarios.
                  </div>
                )}
              </div>

              {editPairError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {editPairError}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setEditPairOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveEditPair} disabled={editPairSaving}>
                  {editPairSaving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={confirmDeleteModalOpen}
            onClose={() => { setConfirmDeleteModalOpen(false); setDeleteConfirmName(""); }}
            className="max-w-sm"
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="space-y-1">
                <div className="text-base font-semibold text-zinc-900">Eliminar competencia</div>
                <p className="text-sm text-zinc-500">
                  Esta acción es <span className="font-semibold text-zinc-700">permanente e irreversible</span>. Se eliminarán todos los equipos, jugadores y partidos asociados.
                </p>
              </div>

              {/* Confirmation input */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-500">
                  Para confirmar, escribí el nombre de la competencia:{" "}
                  <span className="font-semibold text-zinc-800 select-all">{tournament?.name}</span>
                </label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={tournament?.name ?? ""}
                  autoComplete="off"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirmDeleteModalOpen(false);
                    setDeleteConfirmName("");
                    deleteTournament();
                  }}
                  disabled={deletingTournament || deleteConfirmName !== tournament?.name}
                  className="w-full gap-2 !border-red-300 !bg-red-50 !text-red-700 hover:!bg-red-100 disabled:!opacity-40"
                >
                  {deletingTournament && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" aria-hidden />
                  )}
                  {deletingTournament ? "Eliminando..." : "Eliminar competencia"}
                </Button>
                <button
                  type="button"
                  onClick={() => { setConfirmDeleteModalOpen(false); setDeleteConfirmName(""); }}
                  className="text-xs text-zinc-400 hover:text-zinc-600 text-center py-1 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Modal>

          <Modal
            open={teamToDelete !== null}
            onClose={() => setTeamToDelete(null)}
            className="max-w-sm"
          >
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="text-base font-semibold text-zinc-900">Eliminar pareja</div>
                <p className="text-sm text-zinc-500">
                  {(() => {
                    const team = teams.find((t) => t.id === teamToDelete);
                    const name = team
                      ? `${team.players?.[0]?.name ?? "Jugador"} / ${team.players?.[1]?.name ?? "Jugador"}`
                      : `#${teamToDelete}`;
                    return <>¿Deseas eliminar a la pareja <span className="font-semibold text-zinc-700">{name}</span>?</>;
                  })()}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={confirmDeleteTeam}
                  disabled={deletingTeamId === teamToDelete}
                  className="w-full gap-2 !border-red-300 !bg-red-50 !text-red-700 hover:!bg-red-100 disabled:!opacity-40"
                >
                  {deletingTeamId === teamToDelete && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" aria-hidden />
                  )}
                  Eliminar pareja
                </Button>
                <button
                  type="button"
                  onClick={() => setTeamToDelete(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 text-center py-1 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </Modal>

          <Modal
            open={confirmStartModalOpen}
            onClose={() => setConfirmStartModalOpen(false)}
            className="max-w-sm"
          >
            <div className="space-y-5">
              {/* Hero */}
              <div className="rounded-xl bg-zinc-700 px-5 py-6 text-white space-y-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    {competitionTypeDisplayLabel}
                  </div>
                  <div className="text-2xl font-black leading-tight">{tournament?.name}</div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-300">
                  <span><span className="font-semibold text-white">{teams.length}</span> parejas</span>
                  {competitionType !== "league" && (
                    <span><span className="font-semibold text-white">{tournament?.courts_count ?? "-"}</span> canchas</span>
                  )}
                  {competitionType === "tournament" && (
                    <span><span className="font-semibold text-white">{groups.length}</span> zonas</span>
                  )}
                </div>
              </div>

              {/* Warning */}
              <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {competitionType === "flash"
                    ? "Se va a generar el listado de partidos por cancha. Una vez iniciado, no vas a poder modificar las parejas."
                    : competitionType === "league"
                    ? "Una vez iniciada, no vas a poder editar las parejas."
                    : "Una vez iniciado, no vas a poder editar jugadores ni parejas."}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setConfirmStartModalOpen(false);
                    startTournament();
                  }}
                  disabled={startingTournament}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  {startingTournament && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400/40 border-t-zinc-600" aria-hidden />
                  )}
                  {startingTournament ? "Iniciando..." : `Iniciar ${competitionTypeDisplayLabel.toLowerCase()}`}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmStartModalOpen(false)} className="w-full">
                  Cancelar
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            open={startSuccessModalOpen}
            onClose={() => setStartSuccessModalOpen(false)}
            className="max-w-sm"
          >
            <div className="space-y-5">
              {/* Hero */}
              <div className="rounded-xl bg-zinc-700 px-5 py-6 text-white space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm font-semibold text-emerald-400">Competencia iniciada</span>
                </div>
                <div>
                  <div className="text-2xl font-black leading-tight">{tournament?.name ?? `#${tournamentId}`}</div>
                  <div className="text-sm text-zinc-400 mt-1">Ya está en juego.</div>
                </div>
              </div>

              {/* Link */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Compartí con los jugadores</div>
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <span className="flex-1 text-xs text-zinc-600 truncate">{getPublicViewerLink()}</span>
                  <button
                    type="button"
                    onClick={copyStartedTournamentLink}
                    className="shrink-0 text-xs font-semibold text-zinc-700 hover:text-zinc-900 border border-zinc-300 rounded-lg px-2 py-1 bg-white hover:bg-zinc-50 transition-colors"
                  >
                    Copiar
                  </button>
                </div>
                {startSuccessCopyMessage && (
                  <div className="text-xs text-emerald-600">{startSuccessCopyMessage}</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    router.push(`/tournaments/${tournamentId}/matches`);
                    setStartSuccessModalOpen(false);
                  }}
                >
                  Ver partidos
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    router.push(`/viewer/tournaments/${tournamentId}`);
                    setStartSuccessModalOpen(false);
                  }}
                >
                  Abrir vista pública
                </Button>
                <button
                  type="button"
                  onClick={() => setStartSuccessModalOpen(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 text-center py-1 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </Modal>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {status === "upcoming" && (
            <Card className="bg-white/95">
              <div id="start-tournament-section" className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-800">
                      Checklist para iniciar {competitionType === "league" ? "liga" : competitionType === "flash" ? "relámpago" : "torneo"}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {pendingReadinessCount === 0
                        ? `Todo listo. Ya podés ${startLabel.toLowerCase()}.`
                        : `Faltan ${pendingReadinessCount} requisito(s) para iniciar.`}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>Progreso de inicio</span>
                      <span>
                        {readinessDoneCount}/{readinessItems.length}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${readinessProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {readinessItems.map((item, index) => {
                    const isNextStep = nextReadinessItem?.key === item.key && !item.done;
                    const isLocked = !item.done && !isNextStep;

                    // Status step always shows the start button (enabled or not)
                    if (item.key === "status") {
                      return (
                        <div
                          key={item.key}
                          className={`rounded-xl px-4 py-4 flex items-center gap-4 ${
                            canStartTournament
                              ? "border-2 border-zinc-800 bg-white shadow-sm"
                              : "border border-zinc-200 bg-zinc-50 opacity-50 select-none"
                          }`}
                        >
                          <div className="shrink-0 text-5xl font-black text-zinc-400 leading-none w-10 text-center">{index + 1}</div>
                          <div className="flex-1 flex flex-col gap-2 min-w-0">
                            <div className="text-sm font-semibold text-zinc-900">{item.label}</div>
                            {canStartTournament ? (
                              <Button
                                onClick={() => setConfirmStartModalOpen(true)}
                                disabled={startingTournament}
                                variant="secondary"
                                className="w-full"
                              >
                                {startingTournament ? "Iniciando..." : startLabel}
                              </Button>
                            ) : (
                              <span className="text-xs text-zinc-400">Completa los pasos previos</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (item.done) {
                      return (
                        <div
                          key={item.key}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex items-center gap-4"
                        >
                          <div className="shrink-0 text-5xl font-black text-emerald-400 leading-none w-10 text-center">{index + 1}</div>
                          <div className="flex-1 flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm font-semibold text-emerald-800">{item.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isLocked) {
                      return (
                        <div
                          key={item.key}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 flex items-center gap-4 opacity-50 select-none"
                        >
                          <div className="shrink-0 text-5xl font-black text-zinc-400 leading-none w-10 text-center">{index + 1}</div>
                          <div className="flex-1 flex flex-col gap-1 min-w-0">
                            <span className="text-sm text-zinc-500">{item.label}</span>
                          </div>
                        </div>
                      );
                    }


                    return (
                      <div
                        key={item.key}
                        className="rounded-xl border-2 border-zinc-800 bg-white shadow-sm px-4 py-4 flex items-center gap-4"
                      >
                        <div className="shrink-0 text-5xl font-black text-zinc-400 leading-none w-10 text-center">{index + 1}</div>
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                          <div className="text-sm font-semibold text-zinc-900">{item.label}</div>
                          {item.key === "groups" && competitionType === "tournament" ? (
                            <div className="grid w-full gap-2 md:grid-cols-2">
                              <Button
                                onClick={item.onAction}
                                variant="secondary"
                                className="w-full"
                              >
                                {item.actionLabel}
                              </Button>
                              <Button
                                onClick={() => groupsPanelRef.current?.openGenerateAiModal()}
                                variant="secondary"
                                className="w-full"
                              >
                                Zonas con IA
                              </Button>
                            </div>
                          ) : (
                            <Button
                              onClick={item.onAction}
                              variant="secondary"
                              className="w-full"
                            >
                              {item.actionLabel}
                            </Button>
                          )}
                          {item.secondaryActionLabel && item.onSecondaryAction && (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={item.onSecondaryAction}
                                disabled={item.secondaryDisabled}
                                className="text-xs text-zinc-500 underline hover:text-zinc-700 text-center disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                o {item.secondaryActionLabel}
                              </button>
                              {item.key === "teams" ? (
                                <HelpTooltip text={IMPORT_PAIRS_TOOLTIP} />
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          <Card className="bg-white/95">
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                  <div className="text-xl font-semibold text-zinc-900">
                    {tournament?.name ?? `Competencia #${tournamentId}`}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={status} />
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                      {tournamentDates}
                    </span>
                    {tournament?.location && (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
                        {locationLink ? (
                          <a
                            href={locationLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-700 underline"
                          >
                            Ver ubicación
                          </a>
                        ) : (
                          tournament.location
                        )}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowRules(v => !v)}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-700 transition-colors"
                    >
                      Reglas de la competencia
                      <svg className={`h-3 w-3 transition-transform ${showRules ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {showRules && <RulesSummary type={competitionType} />}
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  <div className="space-y-2">

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button variant="secondary" onClick={openEditModal} disabled={status !== "upcoming"}>
                        Editar competencia
                      </Button>
                      <Button variant="secondary" onClick={copyPublicLink}>
                        Copiar link público
                      </Button>
                    </div>
                    {copyMessage && (
                      <div className="text-right text-xs text-zinc-500">{copyMessage}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Create Team */}
            <div id="teams-section" className="md:col-span-2">
              <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-zinc-900">Parejas</span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                      {filteredTeams.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={openPairModal}
                      disabled={status !== "upcoming"}
                    >
                      Agregar pareja
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => importInputRef.current?.click()}
                      disabled={status !== "upcoming" || importingPairs}
                    >
                      {importingPairs ? "Importando..." : "Importar parejas"}
                    </Button>
                    <HelpTooltip text={IMPORT_PAIRS_TOOLTIP} className="self-center" />
                    <button
                      type="button"
                      onClick={downloadImportTemplate}
                      className="text-xs font-semibold text-zinc-500 underline decoration-dotted hover:text-zinc-700"
                    >
                      Descargar template
                    </button>
                  </div>
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={handleImportFile}
                />
                {importingPairs && (
                  <div
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
                    role="status"
                    aria-live="polite"
                  >
                    <span>Importando parejas... esto puede tardar unos segundos.</span>
                  </div>
                )}
                {importSummary && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    Importadas {importSummary.created} de {importSummary.total}. Fallidas:{" "}
                    {importSummary.failed}.
                  </div>
                )}
                {importError && (
                  <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-xs text-red-800">
                    {importError}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {groups.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-zinc-500">
                        Filtrar por zona
                      </label>
                      <select
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                        value={teamsGroupFilter}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTeamsGroupFilter(value === "all" ? "all" : Number(value));
                        }}
                      >
                        <option value="all">Todas</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name.replace(/^Group\s+/i, "Grupo ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {teamCategories.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-zinc-500">
                        Categoria
                      </label>
                      <select
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                        value={teamsCategoryFilter}
                        onChange={(e) =>
                          setTeamsCategoryFilter(
                            e.target.value === "all" ? "all" : e.target.value
                          )
                        }
                      >
                        <option value="all">Todas</option>
                        {teamCategories.map((category) => (
                          <option key={category} value={category}>
                            {category} ({categoryCounts.get(category) ?? 0})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {teamGenders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-zinc-500">
                        Genero
                      </label>
                      <select
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                        value={teamsGenderFilter}
                        onChange={(e) =>
                          setTeamsGenderFilter(
                            e.target.value === "all" ? "all" : e.target.value
                          )
                        }
                      >
                        <option value="all">Todos</option>
                        {teamGenders.map((gender) => {
                          const label =
                            genders.find((g) => g.value === gender)?.label ?? gender;
                          return (
                            <option key={gender} value={gender}>
                              {label} ({genderCounts.get(gender) ?? 0})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}
                  <Input
                    value={teamsNameQuery}
                    onChange={(e) => setTeamsNameQuery(e.target.value)}
                    placeholder="Buscar jugador"
                    className="w-48"
                  />
                </div>
                <div className={`space-y-2 pr-1 ${filteredTeams.length > 0 ? "max-h-64 overflow-y-auto" : ""}`}>
                  

                  {filteredTeams.length === 0 ? (
                    teams.length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-10 text-center">
                        <svg className="h-10 w-10 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                        </svg>
                        <div>
                          <div className="text-sm font-semibold text-zinc-700">Aún no hay parejas cargadas</div>
                          <div className="text-xs text-zinc-400 mt-0.5">Agregá la primera pareja para empezar</div>
                        </div>
                        {status === "upcoming" && (
                          <div className="flex flex-col items-center gap-2">
                            <Button onClick={openPairModal}>+ Agregar primera pareja</Button>
                            <button
                              type="button"
                              onClick={() => importInputRef.current?.click()}
                              className="text-xs text-zinc-500 underline hover:text-zinc-700"
                            >
                              o importar desde Excel/CSV
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-600">No hay equipos para el filtro seleccionado.</div>
                    )
                  ) : (
                    <div className="space-y-2">
                      {filteredTeams.map((team) => {
                        const isPending = !!team.pending;
                        return (
                          <div
                            key={team.id}
                            className="rounded-2xl border border-zinc-200 bg-white p-3 flex items-start justify-between gap-3"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {team.players?.[0]?.name ?? "Jugador"} / {team.players?.[1]?.name ?? "Jugador"}
                                {isPending && (
                                  <span className="ml-2 text-xs text-amber-600">
                                    Creando...
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {(() => {
                                  const group = getTeamGroup(team.id);
                                  if (!group) return "Grupo: Sin asignar";
                                  const label = group.name.replace(/^Group\s+/i, "");
                                  return `Grupo ${label}`;
                                })()}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {(() => {
                                  const category = team.players?.[0]?.category ?? "—";
                                  const genderValue = team.players?.[0]?.gender ?? null;
                                  const genderLabel =
                                    genders.find((g) => g.value === genderValue)?.label ??
                                    genderValue ??
                                    "—";
                                  return `Categoria: ${category} · ${genderLabel}`;
                                })()}
                              </div>
                              {team.schedule_constraints && (
                                <div className="text-xs text-zinc-500">
                                  Limitantes: {team.schedule_constraints}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={status !== "upcoming" || isPending}
                                onClick={() => openEditPairModal(team)}
                                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Editar pareja"
                                title="Editar pareja"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M4 20h4l10-10a2.5 2.5 0 0 0-4-4L4 16v4Z"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M13 7l4 4"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={deletingTeamId === team.id || isPending}
                                onClick={() => deleteTeam(team.id)}
                                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label="Eliminar pareja"
                                title="Eliminar pareja"
                              >
                                <svg
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M9 3h6m-8 4h10m-9 3v8m4-8v8m4-8v8M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    </div>
                  )}
                </div>
              </div>
              </Card>
            </div>

            {/* Zonas / Grupos */}
            <div id="groups-panel" className="md:col-span-2">
            <GroupsPanel
              ref={groupsPanelRef}
              tournamentId={tournamentId}
              competitionType={competitionType}
              status={status}
              groups={groups}
              teams={teams}
              setGroups={setGroups}
              teamsPerGroup={teamsPerGroup}
              setTeamsPerGroup={setTeamsPerGroup}
              generating={generatingGroups}
              onGenerateWithAi={generateGroupsWithAi}
              onCancelGenerateWithAi={cancelGenerateGroupsWithAi}
              onGenerateManual={generateGroupsManual}
              defaultStartDate={defaultStartDate}
              defaultStartTime={defaultStartTime}
              defaultEndTime={defaultEndTime}
              defaultMatchDurationMinutes={defaultMatchDurationMinutes}
              defaultCourtsCount={defaultCourtsCount}
              onAllGroupsGenerated={scrollToStartChecklist}
            />

            </div>
            
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmDeleteModalOpen(true)}
              disabled={deletingTournament}
              className="text-xs text-red-400 border border-red-200 rounded-lg px-3 py-1.5 hover:border-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deletingTournament ? "Eliminando..." : "Eliminar competencia"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
