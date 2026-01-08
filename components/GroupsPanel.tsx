import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { GenerateGroupsResponse, Player, Team, TournamentGroup, TournamentStatus } from "@/lib/types";

type Props = {
  status: TournamentStatus;
  teams: Team[];
  groups: TournamentGroup[];
  teamsPerGroup: number;
  setTeamsPerGroup: (n: number) => void;
  generating: boolean;
  onGenerate: () => Promise<void>;
};

export default function GroupsPanel({
  status,
  teams,
  groups,
  teamsPerGroup,
  setTeamsPerGroup,
  generating,
  onGenerate,
}: Props) {
  const disabled = status !== "upcoming";

  return (
    <Card>
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">Zonas (Groups)</div>
            <div className="text-xs text-zinc-600">
              Se generan solo cuando el torneo está <b>upcoming</b>.
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700">Equipos por zona</label>
            <select
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={teamsPerGroup}
              onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
              disabled={disabled || generating || groups.length > 0}
              title={groups.length > 0 ? "Las zonas ya fueron generadas" : undefined}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <Button
            onClick={onGenerate}
            disabled={disabled || generating || groups.length > 0 || teams.length < 2}
          >
            {generating ? "Generando..." : groups.length > 0 ? "Zonas generadas" : "Generar zonas"}
          </Button>
        </div>

        {status !== "upcoming" && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            El torneo no está en <b>upcoming</b>. No se pueden generar zonas.
          </div>
        )}

        {teams.length < 2 && (
          <div className="text-xs text-zinc-600">
            Necesitás al menos <b>2 equipos</b> para generar zonas.
          </div>
        )}

        {/* Groups list */}
        <div className="grid gap-3 md:grid-cols-2">
          {groups.length === 0 ? (
            <div className="text-sm text-zinc-600">No hay zonas generadas.</div>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{g.name}</div>
                  <div className="text-xs text-zinc-500">#{g.id}</div>
                </div>

                <div className="mt-3 space-y-2">
                  {g.teams.map((t, idx) => (
                    <div
                      key={`${g.id}-${t.team_id}-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2"
                    >
                      <div className="text-sm text-zinc-800">
                        Team #{t.team_id}
                      </div>
                      <div className="text-xs text-zinc-500">team_id</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-xs text-zinc-500">
          Nota: hoy el backend devuelve solo <code>team_id</code> por zona. Si querés mostrar nombres
          (p1/p2), después agregamos un endpoint GET groups “expandido” o resolvemos desde el estado local de teams.
        </div>
      </div>
    </Card>
  );
}
