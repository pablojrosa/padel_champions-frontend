"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  function getErrorMessage(err: unknown, fallback: string) {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error && err.message) return err.message;
    return fallback;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api<UserProfile>("/profile");
        setProfile(data);
        setClubName(data.club_name ?? "");
        setClubLocation(data.club_location ?? "");
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(getErrorMessage(err, "No se pudo cargar el perfil"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const localUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(localUrl);
    return () => URL.revokeObjectURL(localUrl);
  }, [logoFile]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        club_name: clubName.trim() || null,
        club_location: clubLocation.trim() || null,
      };
      const updated = await api<UserProfile>("/profile", {
        method: "PUT",
        body: payload,
      });
      setProfile(updated);
      setSuccess("Perfil actualizado.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo guardar el perfil"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      const updated = await api<UserProfile>("/profile/logo", {
        method: "POST",
        body: formData,
      });
      setProfile(updated);
      setLogoFile(null);
      setLogoModalOpen(false);
      setLogoInputKey((prev) => prev + 1);
      setSuccess("Logo actualizado.");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo subir el logo"));
    } finally {
      setUploadingLogo(false);
    }
  }

  const currentLogo = profile?.club_logo_url ?? null;

  function openLogoPicker() {
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = "";
      logoFileInputRef.current.click();
    }
  }

  function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setLogoFile(selected);
    setLogoModalOpen(true);
  }

  function closeLogoModal() {
    if (uploadingLogo) return;
    setLogoModalOpen(false);
    setLogoFile(null);
    setLogoInputKey((prev) => prev + 1);
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

            <div className="space-y-3">
              <div className="text-sm font-medium">Logo del club</div>
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={clubName || profile?.club_name || "Logo del club"}
                  className="h-20 w-20 rounded-xl border border-zinc-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-500">
                  Sin logo
                </div>
              )}
              <input
                ref={logoFileInputRef}
                key={logoInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <Button onClick={openLogoPicker}>Seleccionar imagen</Button>
              <div className="text-xs text-zinc-500">
                Formatos permitidos: JPG, PNG, WEBP. Tamano maximo: 5MB.
              </div>
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

      <Modal
        open={logoModalOpen}
        title="Preview del logo"
        onClose={closeLogoModal}
        className="max-w-xl"
      >
        <div className="space-y-4">
          {logoPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <img
                src={logoPreviewUrl}
                alt="Preview del logo"
                className="h-[340px] w-full object-contain"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Seleccioná una imagen para previsualizar.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={openLogoPicker} disabled={uploadingLogo}>
              Seleccionar otra
            </Button>
            <Button onClick={uploadLogo} disabled={!logoFile || uploadingLogo}>
              {uploadingLogo ? "Subiendo..." : "Cargar imagen"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
