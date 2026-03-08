"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

function getStatusMeta(status?: UserProfile["status"]) {
  if (status === "active") {
    return {
      label: "Cuenta activa",
      chipClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
      dotClass: "bg-emerald-500",
    };
  }

  return {
    label: "Cuenta inactiva",
    chipClass: "border-amber-200 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-500",
  };
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "CP";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function getRemainingDaysLabel(activeUntil?: string | null) {
  if (!activeUntil) return "Sin fecha disponible";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${activeUntil}T00:00:00`);
  const diff = target.getTime() - todayStart.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return "La cuenta ya venció";
  if (days === 0) return "La cuenta vence hoy";
  if (days === 1) return "Te queda 1 día activo";
  return `Te quedan ${days} días activos`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [clubName, setClubName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!success) return;

    const timeoutId = window.setTimeout(() => {
      setSuccess(null);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [success]);

  useEffect(() => {
    if (!editingName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [editingName]);

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await api<UserProfile>("/profile", {
        method: "PUT",
        body: {
          club_name: clubName.trim() || null,
        },
      });
      setProfile(updated);
      setClubName(updated.club_name ?? "");
      setEditingName(false);
      setSuccess("Nombre actualizado.");
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

  const currentLogo = profile?.club_logo_url ?? null;
  const clubDisplayName = clubName.trim() || profile?.club_name || "Tu club";
  const statusMeta = getStatusMeta(profile?.status);
  const remainingDaysLabel = getRemainingDaysLabel(profile?.active_until);

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border border-white/10 bg-gradient-to-br from-white via-white to-emerald-50 ring-0">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_60%)] md:block" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Ajustes
                </div>
                <h1 className="text-3xl font-semibold text-zinc-950 md:text-4xl">
                  Perfil del club
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-zinc-600">
                  Configura el nombre y el logo de tu club para que los jugadores
                  te reconozcan.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${statusMeta.chipClass}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.dotClass}`} />
                  {statusMeta.label}
                </div>
                {profile?.email ? (
                  <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-600">
                    {profile.email}
                  </div>
                ) : null}
              </div>
            </div>

            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Volver
            </Button>
          </div>

          <div className="relative mt-8">
            <div className="rounded-[32px] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                <div className="space-y-4">
                  <div className="relative flex h-80 w-80 max-w-full items-center justify-center overflow-hidden rounded-[36px] border border-white/10 bg-white/10 shadow-[0_18px_50px_rgba(255,255,255,0.08)]">
                    {currentLogo ? (
                      <Image
                        src={currentLogo}
                        alt={clubDisplayName}
                        width={320}
                        height={320}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-5xl font-semibold tracking-[0.18em] text-white/90">
                        {getInitials(clubDisplayName)}
                      </span>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setImageViewerOpen(true)}
                        disabled={!currentLogo}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Visualizar
                      </button>

                      <button
                        type="button"
                        onClick={openLogoPicker}
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/18 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/28"
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 3.487a2.1 2.1 0 113.03 2.908L8.7 18.088l-4.2 1.005 1.12-4.084L16.862 3.487z"
                          />
                        </svg>
                        Modificar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-emerald-300/80">
                      Vista previa
                    </div>
                    {editingName ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={nameInputRef}
                          value={clubName}
                          onChange={(e) => setClubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveProfile();
                            }
                            if (e.key === "Escape") {
                              setClubName(profile?.club_name ?? "");
                              setEditingName(false);
                            }
                          }}
                          className="min-w-[240px] flex-1 rounded-2xl border border-white/15 bg-white px-4 py-3 text-2xl font-semibold text-zinc-950 outline-none focus:border-emerald-400"
                          aria-label="Nombre del club"
                        />
                        <button
                          type="button"
                          onClick={saveProfile}
                          disabled={saving}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-50"
                          aria-label="Guardar nombre"
                        >
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setClubName(profile?.club_name ?? "");
                            setEditingName(false);
                          }}
                          disabled={saving}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15 disabled:opacity-50"
                          aria-label="Cancelar edición"
                        >
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 6l12 12M18 6L6 18"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-semibold">{clubDisplayName}</h2>
                        <button
                          type="button"
                          onClick={() => setEditingName(true)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                          aria-label="Editar nombre del club"
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 3.487a2.1 2.1 0 113.03 2.908L8.7 18.088l-4.2 1.005 1.12-4.084L16.862 3.487z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {error ? (
                    <div className="max-w-xl rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                      {error}
                    </div>
                  ) : null}

                  {success ? (
                    <div className="max-w-xl rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      {success}
                    </div>
                  ) : null}

                  <div className="max-w-xl rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                      Vigencia actual
                    </div>
                    <div className="mt-3 text-3xl font-semibold text-white">
                      {loading ? "Cargando..." : remainingDaysLabel}
                    </div>
                    {profile?.active_until ? (
                      <div className="mt-2 text-sm text-zinc-300">
                        Activa hasta el {profile.active_until}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <input
        ref={logoFileInputRef}
        key={logoInputKey}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleLogoFileChange}
        className="hidden"
      />

      <Modal
        open={imageViewerOpen}
        title="Imagen del club"
        onClose={() => setImageViewerOpen(false)}
        className="max-w-3xl"
      >
        {currentLogo ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <Image
                src={currentLogo}
                alt={clubDisplayName}
                width={1200}
                height={900}
                unoptimized
                className="h-auto max-h-[70vh] w-full object-contain"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setImageViewerOpen(false)}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Este club todavía no tiene una imagen cargada.
          </div>
        )}
      </Modal>

      <Modal
        open={logoModalOpen}
        title="Preview del logo"
        onClose={closeLogoModal}
        className="max-w-xl"
      >
        <div className="space-y-4">
          {logoPreviewUrl ? (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
              <Image
                src={logoPreviewUrl}
                alt="Preview del logo"
                width={880}
                height={680}
                unoptimized
                className="h-[340px] w-full object-contain"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Selecciona una imagen para previsualizar.
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
