"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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

  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [registeredPlayers, setRegisteredPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add players (bulk)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Create team
  const [p1, setP1] = useState<number | "">("");
  const [p2, setP2] = useState<number | "">("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  
  // Delete player from tournament
  const [removingPlayerId, setRemovingPlayerId] = useState<number | null>(null);

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

  const registeredIds = useMemo(() => new Set(registeredPlayers.map((p) => p.id)), [registeredPlayers]);

  const availableToRegister = useMemo(() => {
    return allPlayers.filter((p) => !registeredIds.has(p.id)).sort((a, b) => a.first_name.localeCompare(b.first_name));
  }, [allPlayers, registeredIds]);

  const registeredSorted = useMemo(
    () => [...registeredPlayers].sort((a, b) => a.first_name.localeCompare(b.first_name)),
    [registeredPlayers]
  );
  // 🔹 jugadores que ya están en algún equipo
const playersInTeams = useMemo(() => {
  return new Set(
    teams.flatMap((team) => team.players?.map((p) => p.id) ?? [])
  );
}, [teams]);
const availableForTeams = useMemo(() => {
  return registeredSorted.filter(
    (p) => !playersInTeams.has(p.id)
  );
}, [registeredSorted, playersInTeams]);


function hydrateTeams(rawTeams: Team[], players: Player[]): Team[] {
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

async function load() {
  setLoading(true);
  setError(null);

  try {
    // Disparamos todas las peticiones en paralelo
    const [tournaments, statusRes, players, tPlayers, rawTeams, tGroups] = await Promise.all([
      api<Tournament[]>("/tournaments"),
      api<TournamentStatusResponse>(`/tournaments/${tournamentId}/status`),
      api<Player[]>("/players"),
      apiMaybe<Player[]>(`/tournaments/${tournamentId}/players`) || Promise.resolve([]),
      apiMaybe<Team[]>(`/tournaments/${tournamentId}/teams`) || Promise.resolve([]),
      apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) || Promise.resolve([])
    ]);

    // Una vez que todas terminan, actualizamos los estados
    const found = tournaments.find((t) => t.id === tournamentId) ?? null;
    setTournament(found);
    setStatus(statusRes.status);
    setAllPlayers(players);
    setRegisteredPlayers(tPlayers || []);
    
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

  async function addPlayersToTournament() {
    if (selectedPlayerIds.length === 0) return;
  
    setAddingPlayer(true);
    setError(null);
  
    try {
      await api(
        `/tournaments/${tournamentId}/players/bulk`,
        {
          method: "POST",
          body: { player_ids: selectedPlayerIds },
        }
      );

      const addedPlayers = allPlayers.filter((p) =>
        selectedPlayerIds.includes(p.id)
      );

      if (addedPlayers.length > 0) {
        setRegisteredPlayers((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newOnes = addedPlayers.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newOnes];
        });
      }

      setSelectedPlayerIds([]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to add player");
    } finally {
      setAddingPlayer(false);
    }
  }
  async function removePlayerFromTournament(playerId: number) {
    const player = registeredPlayers.find((p) => p.id === playerId);
  
    const isInTeam = teams.some((team) =>
      team.players?.some((p) => p.id === playerId)
    );
  
    const confirmed = window.confirm(
      isInTeam
        ? `El jugador "${player?.first_name} ${player?.last_name}" está en un equipo.\n\nSi continuás, el equipo será eliminado.\n\n¿Querés continuar?`
        : `¿Quitar al jugador "${player?.first_name} ${player?.last_name}" del torneo?`
    );
  
    if (!confirmed) return;
  
    setRemovingPlayerId(playerId);
    setError(null);
  
    try {
      await api(
        `/tournaments/${tournamentId}/players/${playerId}`,
        { method: "DELETE" }
      );
      if (groups.length > 0) {
        // Opcional: Limpiar los grupos o avisar que deben regenerarse
        // setGroups([]); 
        // O mejor, re-validar con el servidor:
        const updatedGroups = await apiMaybe<TournamentGroupOut[]>(`/tournaments/${tournamentId}/groups`) ?? [];
        setGroups(updatedGroups);
      }
  
      // 1️⃣ eliminar jugador del estado local
      setRegisteredPlayers((prev) =>
        prev.filter((p) => p.id !== playerId)
      );
  
      // 2️⃣ eliminar equipos donde estaba ese jugador
      setTeams((prev) =>
        prev.filter(
          (team) => !team.players?.some((p) => p.id === playerId)
        )
      );
    } catch (err: any) {
      setError(err?.message ?? "Failed to remove player");
    } finally {
      setRemovingPlayerId(null);
    }
  }

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
  async function deleteTeam(teamId: number) {
    const team = teams.find((t) => t.id === teamId);
  
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
  

  async function createTeam() {
    if (p1 === "" || p2 === "" || p1 === p2) return;
  
    setCreatingTeam(true);
    setError(null);
  
    try {
      const res = await api<{ team_id: number; message: string }>(
        `/tournaments/${tournamentId}/teams`,
        {
          method: "POST",
          body: { player1_id: p1, player2_id: p2 },
        }
      );
  
      const player1 = registeredPlayers.find(p => p.id === p1);
      const player2 = registeredPlayers.find(p => p.id === p2);
  
      if (!player1 || !player2) return;
  
      const newTeam = {
        id: res.team_id,
        tournament_id: tournamentId,
        players: [player1, player2],
      };

      setTeams(prev => [newTeam, ...prev]);
      setP1("");
      setP2("");

      if (groups.length > 0) {
        const updatedGroups = await api<TournamentGroupOut[]>(
          `/tournaments/${tournamentId}/groups`
        );
        setGroups(updatedGroups);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to create team");
    } finally {
      setCreatingTeam(false);
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

  const tournamentDates =
    tournament?.start_date && tournament?.end_date
      ? `${tournament.start_date} - ${tournament.end_date}`
      : tournament?.start_date || "—";
  const locationLink =
    tournament?.location && tournament.location.startsWith("http")
      ? tournament.location
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tournament</h1>
          <p className="text-sm text-zinc-300">Detalle, jugadores y equipos.</p>
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
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                  onClick={() => {
                    router.push(`/tournaments/${tournamentId}/schedule`);
                    setMenuOpen(false);
                  }}
                >
                  Cronograma
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
        <Card>
          <div className="p-5 text-sm text-zinc-600">Cargando...</div>
        </Card>
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card>
          <div className="p-5 flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-lg font-semibold">{tournament?.name ?? `Torneo #${tournamentId}`}</div>
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
              <Button variant="secondary" onClick={copyPublicLink}>
                Copiar link publico
              </Button>
              {copyMessage && (
                <div className="text-xs text-zinc-500">{copyMessage}</div>
              )}
              <Button
                onClick={startTournament}
                disabled={startingTournament || status !== "upcoming" || groups.length === 0 || teams.length < 1}
                className="whitespace-nowrap"
              >
                {startingTournament ? "Iniciando..." : "Iniciar torneo"}
              </Button>
            </div>
          </div>
          </Card>

          {/* Registered Players */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <div className="p-5 space-y-3">
                <div>
                  <div className="font-medium">Registrar jugadores al torneo</div>
                  <div className="text-xs text-zinc-600">
                    Registra jugadores al torneo.
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200">
                    {availableToRegister.length === 0 ? (
                      <div className="p-3 text-sm text-zinc-600">
                        No hay jugadores disponibles para agregar.
                      </div>
                    ) : (
                      availableToRegister.map((p) => {
                        const checked = selectedPlayerIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedPlayerIds((prev) =>
                                  e.target.checked
                                    ? [...prev, p.id]
                                    : prev.filter((id) => id !== p.id)
                                );
                              }}
                              disabled={status !== "upcoming"}
                            />
                            <span>
                              {p.first_name} {p.last_name}
                              <span className="ml-2 text-xs text-zinc-500">
                                ({p.category})
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <Button
                    onClick={addPlayersToTournament}
                    disabled={addingPlayer || selectedPlayerIds.length === 0 || status !== "upcoming"}
                    className="md:w-44"
                  >
                    {addingPlayer ? "Agregando..." : "Agregar seleccionados"}
                  </Button>
                </div>

                <div className="max-h-90 overflow-y-auto space-y-2 pr-1">
                  {registeredSorted.length === 0 ? (
                    <div className="text-sm text-zinc-600">No hay jugadores registrados.</div>
                  ) : (
                    registeredSorted.map((p) => {
                      const isInTeam = teams.some((team) =>
                        team.players?.some((tp) => tp.id === p.id)
                      );
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-zinc-200 p-3"
                        >
                          <div>
                            <div className="text-sm font-medium">{p.first_name} {p.last_name}
                            <span className="ml-2 text-xs text-zinc-500">
                              ({p.category})
                            </span>
                            </div>
                            {isInTeam && (
                              <div className="text-xs text-orange-600">
                                Asignado a un equipo
                              </div>
                            )}
                          </div>
                    
                          <Button
                            variant="danger"
                            disabled={removingPlayerId === p.id}
                            onClick={() => removePlayerFromTournament(p.id)}
                          >
                            {removingPlayerId === p.id ? "Quitando..." : "Quitar"}
                          </Button>
                        </div>
                      );
                    })
                    
                  )}
                </div>
              </div>
            </Card>

            {/* Create Team */}
            <Card>
              <div className="p-5 space-y-3">
                <div>
                  <div className="font-medium">Crear equipos</div>
                  <div className="text-xs text-zinc-600">Seleccioná 2 jugadores registrados en el torneo.</div>
                </div>

                <div className="grid gap-2">
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={p1}
                    onChange={(e) => setP1(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Jugador 1</option>
                    {availableForTeams.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                        </option>
                      ))}
                  </select>

                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={p2}
                    onChange={(e) => setP2(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Jugador 2</option>
                    {availableForTeams
                    .filter((p) => (p1 === "" ? true : p.id !== p1))
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      </option>
                    ))}

                  </select>

                  <Button
                    onClick={createTeam}
                    disabled={
                      creatingTeam ||
                      p1 === "" ||
                      p2 === "" ||
                      p1 === p2 || 
                      status !== "upcoming" ||
                      availableForTeams.length < 2
                    }
                  >
                    {creatingTeam ? "Creando..." : "Crear equipo"}
                  </Button>
                </div>
                <div className="font-medium mb-2">Teams</div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  

                  {teams.length === 0 ? (
                    <div className="text-sm text-zinc-600">No hay equipos creados.</div>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="rounded-xl border border-zinc-200 p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-medium">Team #{team.id}</div>
                            <div className="text-sm text-zinc-700">
                            {team.players?.[0]?.first_name} {team.players?.[0]?.last_name} /
                            {team.players?.[1]?.first_name} {team.players?.[1]?.last_name}

                            </div>
                            <div className="text-xs text-zinc-500">
                              tournament_id: {team.tournament_id}
                            </div>
                          </div>

                          <Button
                            variant="danger"
                            disabled={deletingTeamId === team.id}
                            onClick={() => deleteTeam(team.id)}
                          >
                            {deletingTeamId === team.id ? "Eliminando..." : "Eliminar"}
                          </Button>
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              </div>
            </Card>

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
