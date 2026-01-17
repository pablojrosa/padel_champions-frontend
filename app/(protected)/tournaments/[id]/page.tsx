"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError, apiMaybe } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Player, Team, Tournament } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import GroupsPanel from "@/components/GroupsPanel";
import type { TournamentGroupOut } from "@/lib/types";
import type {
  TournamentStatus,
  TournamentStatusResponse,
  GenerateGroupsResponse,
  TournamentGroup,
  StartTournamentResponse,
} from "@/lib/types";


type IdParam = { id: string };

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
  const [p1LastName, setP1LastName] = useState("");
  const [p1Category, setP1Category] = useState("");
  const [p2FirstName, setP2FirstName] = useState("");
  const [p2LastName, setP2LastName] = useState("");
  const [p2Category, setP2Category] = useState("");

  // Delete team from tournament
  const [deletingTeamId, setDeletingTeamId] = useState<number | null>(null);

  // Status + Groups
  const [status, setStatus] = useState<TournamentStatus>("upcoming");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [groups, setGroups] = useState<TournamentGroupOut[]>([]);
  const [teamsPerGroup, setTeamsPerGroup] = useState<number>(2);
  const [generatingGroups, setGeneratingGroups] = useState(false);

  const [startingTournament, setStartingTournament] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
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
  const [editP1Category, setEditP1Category] = useState("");
  const [editP2FirstName, setEditP2FirstName] = useState("");
  const [editP2LastName, setEditP2LastName] = useState("");
  const [editP2Category, setEditP2Category] = useState("");

  const categories = ["7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"];


function hydrateTeams(rawTeams: Team[], players: Player[]): UiTeam[] {
  const playersById = new Map(players.map((p) => [p.id, p]));

  return rawTeams.map((team) => ({
    ...team,
    players: (team.players || [])
      .map((p) => playersById.get(p.id))
      .filter((p): p is Player => !!p)
      .map((p) => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
      })),
  }));
}

type TeamApi = {
  id: number;
  players: { id: number; first_name: string; last_name: string | null }[];
};

function mapTeamsFromApi(rawTeams: TeamApi[], tournamentId: number): UiTeam[] {
  return rawTeams.map((team) => ({
    id: team.id,
    tournament_id: tournamentId,
    players: team.players.map((p) => ({
      id: p.id,
      name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
    })),
  }));
}

async function load() {
  setLoading(true);
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

  } catch (err: any) {
    if (err instanceof ApiError && err.status === 401) {
      clearToken();
      router.replace("/login");
      return;
    }
    setError(err?.message ?? "Failed to load tournament");
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);


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
    setEditDescription(tournament.description ?? "");
    setEditLocation(tournament.location ?? "");
    setEditError(null);
    setEditOpen(true);
  }
  async function deleteTeam(teamId: number) {
    const team = teams.find((t) => t.id === teamId);
    if (team?.pending) return;
  
    const confirmed = window.confirm(
      `¿Eliminar el equipo #${teamId}?\n\nLos jugadores seguirán registrados en el torneo.`
    );
  
    if (!confirmed) return;
  
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
      setError(err?.message ?? "Failed to delete team");
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
    setP1LastName("");
    setP1Category("");
    setP2FirstName("");
    setP2LastName("");
    setP2Category("");
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
    setEditP1Category(p1?.category ?? "");
    setEditP2FirstName(p2?.first_name ?? "");
    setEditP2LastName(p2?.last_name ?? "");
    setEditP2Category(p2?.category ?? "");
    setEditPairError(null);
    setEditPairOpen(true);
  }

  async function saveEditPair() {
    if (!editTeamId || !editP1Id || !editP2Id) return;
    if (
      !editP1FirstName.trim() ||
      !editP1LastName.trim() ||
      !editP1Category ||
      !editP2FirstName.trim() ||
      !editP2LastName.trim() ||
      !editP2Category
    ) {
      setEditPairError("Completá los datos de ambos jugadores.");
      return;
    }

    setEditPairSaving(true);
    setEditPairError(null);
    try {
      const updated = await api<{ id: number; players: Player[] }>(
        `/tournaments/${tournamentId}/teams/${editTeamId}`,
        {
          method: "PATCH",
          body: {
            players: [
              {
                player_id: editP1Id,
                first_name: editP1FirstName.trim(),
                last_name: editP1LastName.trim(),
                category: editP1Category,
              },
              {
                player_id: editP2Id,
                first_name: editP2FirstName.trim(),
                last_name: editP2LastName.trim(),
                category: editP2Category,
              },
            ],
          },
        }
      );

      setTeams((prev) =>
        prev.map((team) => {
          if (team.id !== updated.id) return team;
          const mappedPlayers = updated.players.map((p) => ({
            id: p.id,
            name: `${p.first_name} ${p.last_name ?? ""}`.trim(),
          }));
          return { ...team, players: mappedPlayers };
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
      !p1LastName.trim() ||
      !p1Category ||
      !p2FirstName.trim() ||
      !p2LastName.trim() ||
      !p2Category
    ) {
      setPairError("Completá los datos de ambos jugadores.");
      return;
    }

    const tempId = -Date.now();
    const optimisticTeam: UiTeam = {
      id: tempId,
      tournament_id: tournamentId,
      pending: true,
      players: [
        { id: tempId * 10 - 1, name: `${p1FirstName.trim()} ${p1LastName.trim()}`.trim() },
        { id: tempId * 10 - 2, name: `${p2FirstName.trim()} ${p2LastName.trim()}`.trim() },
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
              last_name: p1LastName.trim(),
              category: p1Category,
            },
            player2: {
              first_name: p2FirstName.trim(),
              last_name: p2LastName.trim(),
              category: p2Category,
            },
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
      setError(err?.message ?? "Failed to create team");
    } finally {
      setPairSaving(false);
    }
  }
  async function generateGroups() {
    setGeneratingGroups(true);
    setError(null);
  
    try {
      const res = await api<GenerateGroupsResponse>(
        `/tournaments/${tournamentId}/groups/generate`,
        {
          method: "POST",
          body: { teams_per_group: teamsPerGroup },
        }
      );
      const tGroups = await api<TournamentGroupOut[]>(
        `/tournaments/${tournamentId}/groups`
      );
      setGroups(tGroups);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate groups");
    } finally {
      setGeneratingGroups(false);
    }
  }

  async function startTournament() {
    const confirmed = window.confirm(
      "¿Iniciar torneo?\n\nUna vez iniciado, no vas a poder editar jugadores/equipos."
    );
    if (!confirmed) return;
  
    setStartingTournament(true);
    setError(null);
  
    try {
      const res = await api<StartTournamentResponse>(`/tournaments/${tournamentId}/start`, {
        method: "POST",
        body: {},
      });
  
      setStatus(res.status);
    } catch (err: any) {
      setError(err?.message ?? "Failed to start tournament");
    } finally {
      setStartingTournament(false);
    }
  }  
  
  async function deleteTournament() {
    const confirmed = window.confirm(
      "¿Estás seguro de que querés eliminar este torneo?\n\nSe borrarán jugadores y equipos asociados."
    );
  
    if (!confirmed) return;
  
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
      setError(err?.message ?? "Failed to delete tournament");
    } finally {
      setDeletingTournament(false);
    }
  }

  async function updateTournament() {
    if (!tournament) return;
    if (!editName.trim()) {
      setEditError("El nombre del torneo es obligatorio.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api<Tournament>(`/tournaments/${tournamentId}`, {
        method: "PATCH",
        body: {
          name: editName.trim(),
          description: editDescription.trim() ? editDescription.trim() : null,
          location: editLocation.trim() ? editLocation.trim() : null,
        },
      });

      setTournament(updated);
      setEditOpen(false);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to update tournament");
    } finally {
      setSavingEdit(false);
    }
  }

  const tournamentDates =
    tournament?.start_date && tournament?.end_date
      ? `${tournament.start_date} - ${tournament.end_date}`
      : tournament?.start_date || "—";
  const locationLink =
    tournament?.location && tournament.location.startsWith("http")
      ? tournament.location
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Gestion
          </div>
          <h1 className="text-3xl font-semibold">Detalle del torneo</h1>
          <p className="text-sm text-zinc-300">Equipos, zonas y estado general.</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push("/tournaments")}
          >
            Volver
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              variant="secondary"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="sr-only">Opciones</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="12" cy="5" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="19" r="2" fill="currentColor" />
              </svg>
            </Button>
            {menuOpen && (
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    setMenuOpen(false);
                    openEditModal();
                  }}
                >
                  Editar torneo
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    router.push(`/tournaments/${tournamentId}/matches`);
                    setMenuOpen(false);
                  }}
                >
                  Partidos
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    router.push(`/tournaments/${tournamentId}/playoffs`);
                    setMenuOpen(false);
                  }}
                >
                  Playoffs
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    deleteTournament();
                  }}
                >
                  {deletingTournament ? "Eliminando..." : "Eliminar torneo"}
                </button>
              </div>
            )}
          </div>
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
            title="Editar torneo"
            onClose={() => setEditOpen(false)}
          >
            <div className="space-y-3">
              <Input
                placeholder="Nombre del torneo"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <textarea
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                placeholder="Descripcion / reglas del torneo"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
              <Input
                placeholder="Ubicacion o link de Google Maps"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
              />

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
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Nombre"
                    value={p1FirstName}
                    onChange={(e) => setP1FirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Apellido"
                    value={p1LastName}
                    onChange={(e) => setP1LastName(e.target.value)}
                  />
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={p1Category}
                  onChange={(e) => setP1Category(e.target.value)}
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
                <div className="text-sm font-medium text-zinc-900">
                  Jugador 2
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Nombre"
                    value={p2FirstName}
                    onChange={(e) => setP2FirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Apellido"
                    value={p2LastName}
                    onChange={(e) => setP2LastName(e.target.value)}
                  />
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={p2Category}
                  onChange={(e) => setP2Category(e.target.value)}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
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
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Nombre"
                    value={editP1FirstName}
                    onChange={(e) => setEditP1FirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Apellido"
                    value={editP1LastName}
                    onChange={(e) => setEditP1LastName(e.target.value)}
                  />
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={editP1Category}
                  onChange={(e) => setEditP1Category(e.target.value)}
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
                <div className="text-sm font-medium text-zinc-900">Jugador 2</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Nombre"
                    value={editP2FirstName}
                    onChange={(e) => setEditP2FirstName(e.target.value)}
                  />
                  <Input
                    placeholder="Apellido"
                    value={editP2LastName}
                    onChange={(e) => setEditP2LastName(e.target.value)}
                  />
                </div>
                <select
                  className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={editP2Category}
                  onChange={(e) => setEditP2Category(e.target.value)}
                >
                  <option value="">Seleccionar categoría</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
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

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card className="bg-white/95">
          <div className="p-6 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="text-xl font-semibold text-zinc-900">
                {tournament?.name ?? `Torneo #${tournamentId}`}
              </div>
              <div className="text-sm text-zinc-600">{tournamentDates}</div>
              {tournament?.location && (
                <div className="text-sm text-zinc-600">
                  {locationLink ? (
                    <a
                      href={locationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-900 underline"
                    >
                      Ver ubicacion
                    </a>
                  ) : (
                    tournament.location
                  )}
                </div>
              )}
              {tournament?.description && (
                <div className="text-sm text-zinc-600">
                  {tournament.description}
                </div>
              )}
              <div className="pt-1">
                <StatusBadge status={status} />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="secondary" onClick={copyPublicLink}>
                  Copiar link publico
                </Button>
                <Button
                  onClick={startTournament}
                  disabled={startingTournament || status !== "upcoming" || groups.length === 0 || teams.length < 1}
                  className="whitespace-nowrap"
                >
                  {startingTournament ? "Iniciando..." : "Iniciar torneo"}
                </Button>
              </div>
              {copyMessage && (
                <div className="text-xs text-zinc-500">{copyMessage}</div>
              )}
            </div>
          </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Create Team */}
            <div className="md:col-span-2">
              <Card className="bg-white/95">
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">Cargar parejas</div>
                    <div className="text-xs text-zinc-600">
                      Cargá los datos de ambos jugadores y creá el equipo.
                    </div>
                  </div>
                  <Button
                    onClick={openPairModal}
                    disabled={status !== "upcoming"}
                  >
                    Agregar pareja
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                  <span>Parejas</span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                    {teams.length}
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  

                  {teams.length === 0 ? (
                    <div className="text-sm text-zinc-600">No hay equipos creados.</div>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => {
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
                                  const group = groups.find((g) =>
                                    g.teams?.some((t) => t.id === team.id)
                                  );
                                  if (!group) return "Grupo: Sin asignar";
                                  const label = group.name.replace(/^Group\s+/i, "");
                                  return `Grupo ${label}`;
                                })()}
                              </div>
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
            <div className="md:col-span-2">
            <GroupsPanel
              tournamentId={tournamentId}
              status={status}
              groups={groups}
              setGroups={setGroups}
              teamsPerGroup={teamsPerGroup}
              setTeamsPerGroup={setTeamsPerGroup}
              generating={generatingGroups}
              onGenerate={generateGroups}
            />

            </div>
            
          </div>
        </>
      )}
    </div>
  );
}
