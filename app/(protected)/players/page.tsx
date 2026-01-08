"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import type { Player } from "@/lib/types";
import { useRouter } from "next/navigation";
import { clearToken } from "@/lib/auth";

export default function PlayersPage() {
  const router = useRouter();

  const [items, setItems] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const sorted = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)), [items]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Player[]>("/players");
      setItems(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.message ?? "Failed to load players");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPlayer() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Player>("/players", { method: "POST", body: { name } });
      setItems((prev) => [created, ...prev]);
      setName("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create player");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: number) {
    setSavingId(id);
    setError(null);
    try {
      const updated = await api<Player>(`/players/${id}`, {
        method: "PUT",
        body: { name: editingName },
      });
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditingName("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update player");
    } finally {
      setSavingId(null);
    }
  }

  async function deletePlayer(id: number) {
    const ok = window.confirm("¿Seguro que querés eliminar este jugador?");
    if (!ok) return;

    setError(null);
    try {
      await api<void>(`/players/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete player");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Players</h1>
        <p className="text-sm text-zinc-600">Cargá y mantené tu lista de jugadores.</p>
      </div>

      <Card>
        <div className="p-5 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row">
            <Input placeholder="Nombre del jugador" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={createPlayer} disabled={creating || !name.trim()} className="md:w-40">
              {creating ? "Creando..." : "Crear"}
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-5">
          {loading ? (
            <div className="text-sm text-zinc-600">Cargando jugadores...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-zinc-600">No hay jugadores todavía.</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3"
                >
                  {editingId === p.id ? (
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                  ) : (
                    <div className="text-sm font-medium">{p.name}</div>
                  )}

                  <div className="flex items-center gap-2">
                    {editingId === p.id ? (
                      <>
                        <Button
                          onClick={() => saveEdit(p.id)}
                          disabled={savingId === p.id || !editingName.trim()}
                        >
                          {savingId === p.id ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditingName("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditingName(p.name);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => deletePlayer(p.id)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
