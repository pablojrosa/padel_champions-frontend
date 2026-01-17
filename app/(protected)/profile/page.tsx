"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [clubLogoUrl, setClubLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api<UserProfile>("/profile");
        setProfile(data);
        setClubName(data.club_name ?? "");
        setClubLocation(data.club_location ?? "");
        setClubLogoUrl(data.club_logo_url ?? "");
      } catch (err: any) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err?.message ?? "No se pudo cargar el perfil");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        club_name: clubName.trim() || null,
        club_location: clubLocation.trim() || null,
        club_logo_url: clubLogoUrl.trim() || null,
      };
      const updated = await api<UserProfile>("/profile", {
        method: "PUT",
        body: payload,
      });
      setProfile(updated);
      setSuccess("Perfil actualizado.");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Ajustes
          </div>
          <h1 className="text-3xl font-semibold">Perfil del club</h1>
          <p className="text-sm text-zinc-300">
            Personalizá la info que verán tus jugadores.
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/dashboard")}>
          Volver
        </Button>
      </div>

      {loading ? (
        <Card className="bg-white/95">
          <div className="p-6 text-sm text-zinc-600">Cargando...</div>
        </Card>
      ) : (
        <Card className="bg-white/95">
          <div className="p-6 space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre del club</label>
                <Input
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="Ej: Club Padel Norte"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Ubicación</label>
                <Input
                  value={clubLocation}
                  onChange={(e) => setClubLocation(e.target.value)}
                  placeholder="Ej: Rosario, Santa Fe"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Logo (URL)</label>
              <Input
                value={clubLogoUrl}
                onChange={(e) => setClubLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {profile?.email && (
              <div className="text-xs text-zinc-500">Cuenta: {profile.email}</div>
            )}

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {success}
              </div>
            )}

            <Button onClick={saveProfile} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
