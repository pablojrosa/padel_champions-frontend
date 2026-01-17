"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { Tournament } from "@/lib/types";
import { useRouter } from "next/navigation";

export default function TournamentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Tournament[]>("/tournaments");
      setItems(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.message ?? "Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTournament() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<Tournament>("/tournaments", {
        method: "POST",
        body: {
          name,
          description: description.trim() ? description.trim() : null,
          location: location.trim() ? location.trim() : null,
        },
      });
      setItems((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setLocation("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create tournament");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Tournaments</h1>
        <p className="text-sm text-zinc-300">Creá y administrá tus torneos.</p>
      </div>

      <Card>
        <div className="p-5 space-y-3">
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Nombre del torneo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
              placeholder="Descripcion / reglas del torneo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Input
              placeholder="Ubicacion o link de Google Maps"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <Button
              onClick={createTournament}
              disabled={creating || !name.trim()}
              className="md:w-40"
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

      <div className="grid gap-3 md:grid-cols-2">
        {loading ? (
          <div className="text-sm text-zinc-600">Cargando torneos...</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-zinc-600">No hay torneos todavía.</div>
        ) : (
          items.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card>
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-zinc-600">
                      {t.start_date && t.end_date
                        ? `${t.start_date} - ${t.end_date}`
                        : t.start_date || "Sin fecha"}
                    </div>
                  </div>
                  <div className="text-zinc-400">→</div>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
