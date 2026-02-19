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

  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [first_name, setFirstName] = useState("");
  const [last_name, setLastName] = useState("");
  const [category, setCategory] = useState("");

  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const sorted = useMemo(() => [...items].sort((a, b) => a.first_name.localeCompare(b.first_name)), [items]);

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
    if (!first_name.trim() || !last_name.trim() || !category.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Player>("/players", { method: "POST", body: { first_name, last_name, category } });
      setItems((prev) => [created, ...prev]);
      setFirstName("");
      setLastName("");
      setCategory("");
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
        body: {
          first_name: editFirstName,
          last_name: editLastName,
          category: editCategory,
        },
      });
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditFirstName("");
      setEditLastName("");
      setEditCategory("");
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
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          Base de datos
        </div>
        <h1 className="text-3xl font-semibold">Jugadores</h1>
        <p className="text-sm text-zinc-300">Cargá y mantené tu lista de jugadores.</p>
      </div>

      <Card className="bg-white/95">
        <div className="p-6 space-y-4">
          <div className="text-sm font-semibold text-zinc-800">
            Nuevo jugador
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              value={first_name}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Nombre"
              required
            />

            <Input
              value={last_name}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Apellido"
              required
            />
            <select
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">Seleccionar categoría</option>
              {["8va","7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <Button
              onClick={createPlayer}
              disabled={creating || !first_name.trim() || !last_name.trim() || !category.trim()}
              className="md:w-full"
            >
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

      <Card className="bg-white/95">
        <div className="p-6">
          {loading ? (
            <div className="text-sm text-zinc-600">Cargando jugadores...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-zinc-600">No hay jugadores todavía.</div>
          ) : (
            <div className="space-y-2">
              {sorted.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
                >
                  {editingId === p.id ? (
                    <div className="flex flex-col gap-2 md:flex-row md:items-center w-full">
                      <Input
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        placeholder="Nombre"
                      />

                      <Input
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="Apellido"
                      />

                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                      >
                        <option value="">Categoría</option>
                        {["8va","7ma", "6ta", "5ta", "4ta", "3ra", "2da", "1ra"].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (

                    <div className="text-sm font-medium">
                      {p.first_name} {p.last_name}
                      <span className="ml-2 text-xs text-zinc-500">
                        ({p.category})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {editingId === p.id ? (
                      <>
                        <Button
                          onClick={() => saveEdit(p.id)}
                          disabled={
                            savingId === p.id ||
                            !editFirstName.trim() ||
                            !editLastName.trim() ||
                            !editCategory.trim()
                          }
                        >

                          {savingId === p.id ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditFirstName("");
                            setEditLastName("");
                            setEditCategory("");
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
                            setEditFirstName(p.first_name ?? "");
                            setEditLastName(p.last_name ?? "");
                            setEditCategory(p.category ?? "");

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
