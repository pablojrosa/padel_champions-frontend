"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { CATEGORY_SUGGESTIONS, normalizeCategoryValue } from "@/lib/category";
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
      setError(err?.message ?? "No se pudieron cargar los jugadores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPlayer() {
    const normalizedCategory = normalizeCategoryValue(category);
    if (!first_name.trim() || !last_name.trim() || !normalizedCategory) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Player>("/players", {
        method: "POST",
        body: { first_name, last_name, category: normalizedCategory },
      });
      setItems((prev) => [created, ...prev]);
      setFirstName("");
      setLastName("");
      setCategory("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear el jugador.");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: number) {
    const normalizedCategory = normalizeCategoryValue(editCategory);
    setSavingId(id);
    setError(null);
    try {
      const updated = await api<Player>(`/players/${id}`, {
        method: "PUT",
        body: {
          first_name: editFirstName,
          last_name: editLastName,
          category: normalizedCategory,
        },
      });
      setItems((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
      setEditFirstName("");
      setEditLastName("");
      setEditCategory("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar el jugador.");
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
      setError(err?.message ?? "No se pudo eliminar el jugador.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Base de datos
          </div>
          <h1 className="text-3xl font-semibold">Jugadores</h1>
          <p className="text-sm text-zinc-300">Cargá y mantené tu lista de jugadores.</p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Volver al tablero
        </Button>
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
            <Input
              list="player-category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: 4ta o suma 12"
              required
            />

            <Button
              onClick={createPlayer}
              disabled={creating || !first_name.trim() || !last_name.trim() || !normalizeCategoryValue(category)}
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

                      <Input
                        list="player-category-suggestions"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Ej: 4ta o suma 12"
                      />
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
                            !normalizeCategoryValue(editCategory)
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

      <datalist id="player-category-suggestions">
        {CATEGORY_SUGGESTIONS.map((categoryOption) => (
          <option key={categoryOption} value={categoryOption} />
        ))}
      </datalist>
    </div>
  );
}
