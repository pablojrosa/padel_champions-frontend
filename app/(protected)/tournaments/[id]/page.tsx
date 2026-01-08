"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api, ApiError, apiMaybe } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Player, Team, Tournament } from "@/lib/types";

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

  // Add player
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | "">("");
  const [addingPlayer, setAddingPlayer] = useState(false);

  // Create team
  const [p1, setP1] = useState<number | "">("");
  const [p2, setP2] = useState<number | "">("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const registeredIds = useMemo(() => new Set(registeredPlayers.map((p) => p.id)), [registeredPlayers]);

  const availableToRegister = useMemo(() => {
    return allPlayers.filter((p) => !registeredIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPlayers, registeredIds]);

  const registeredSorted = useMemo(
    () => [...registeredPlayers].sort((a, b) => a.name.localeCompare(b.name)),
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


  async function load() {
    setLoading(true);
    setError(null);

    try {
      // 1) tournament info (fallback: from tournaments list)
      const tournaments = await api<Tournament[]>("/tournaments");
      const found = tournaments.find((t) => t.id === tournamentId) ?? null;
      setTournament(found);

      // 2) players globales
      const players = await api<Player[]>("/players");
      setAllPlayers(players);

      // 3) registered players of tournament (optional endpoint)
      const tPlayers =
        (await apiMaybe<Player[]>(`/tournaments/${tournamentId}/players`)) ??
        // fallback: si no existe endpoint, dejamos vacío y avisamos
        [];

      setRegisteredPlayers(tPlayers);

      // 4) teams (optional endpoint)
      const tTeams = (await apiMaybe<Team[]>(`/tournaments/${tournamentId}/teams`)) ?? [];
      setTeams(tTeams);
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

  async function addPlayerToTournament() {
    if (selectedPlayerId === "") return;
  
    setAddingPlayer(true);
    setError(null);
  
    try {
      await api(
        `/tournaments/${tournamentId}/players`,
        {
          method: "POST",
          body: { player_id: selectedPlayerId },
        }
      );
  
      const addedPlayer = allPlayers.find(
        (p) => p.id === selectedPlayerId
      );
  
      if (addedPlayer) {
        setRegisteredPlayers((prev) => {
          // evitamos duplicados
          if (prev.some((p) => p.id === addedPlayer.id)) return prev;
          return [...prev, addedPlayer];
        });
      }
  
      setSelectedPlayerId("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to add player");
    } finally {
      setAddingPlayer(false);
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to create team");
    } finally {
      setCreatingTeam(false);
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
  
  

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tournament</h1>
          <p className="text-sm text-zinc-600">Detalle, jugadores y equipos.</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => router.push("/tournaments")}
          >
            Volver
          </Button>

          <Button
            variant="danger"
            onClick={deleteTournament}
            disabled={deletingTournament}
          >
            {deletingTournament ? "Eliminando..." : "Eliminar torneo"}
          </Button>
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
            <div className="p-5 space-y-1">
              <div className="text-lg font-semibold">{tournament?.name ?? `Torneo #${tournamentId}`}</div>
              <div className="text-sm text-zinc-600">{tournament?.date ?? "—"}</div>
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

                <div className="flex flex-col gap-2 md:flex-row">
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">Seleccionar jugador</option>
                    {availableToRegister.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <Button
                    onClick={addPlayerToTournament}
                    disabled={addingPlayer || selectedPlayerId === ""}
                    className="md:w-44"
                  >
                    {addingPlayer ? "Agregando..." : "Agregar"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {registeredSorted.length === 0 ? (
                    <div className="text-sm text-zinc-600">No hay jugadores registrados.</div>
                  ) : (
                    registeredSorted.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-200 p-3"
                      >
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-zinc-500">#{p.id}</div>
                      </div>
                    ))
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
                        {p.name}
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
                      {p.name}
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
                      availableForTeams.length < 2
                    }
                  >
                    {creatingTeam ? "Creando..." : "Crear equipo"}
                  </Button>
                </div>

                <div className="pt-2 border-t border-zinc-200">
                  <div className="font-medium mb-2">Teams</div>

                  {teams.length === 0 ? (
                    <div className="text-sm text-zinc-600">No hay equipos creados.</div>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <div key={team.id} className="rounded-xl border border-zinc-200 p-3">
                          <div className="text-sm font-medium">Team #{team.id}</div>
                          <div className="text-sm text-zinc-700">
                            {team.players?.[0]?.name ?? "?"} &nbsp; / &nbsp; {team.players?.[1]?.name ?? "?"}
                          </div>
                          <div className="text-xs text-zinc-500">tournament_id: {team.tournament_id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
