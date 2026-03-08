"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { UserProfile } from "@/lib/types";

const TOTAL_STEPS = 3;

function getOnboardingStorageKey(userId: number) {
  return `pc_onboarding_completed_${userId}`;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function FirstLoginOnboarding() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [clubName, setClubName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState(
    "Tu cuenta ya quedo lista para seguir completando el perfil cuando quieras."
  );

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const data = await api<UserProfile>("/profile");
        setProfile(data);
        setClubName(data.club_name ?? "");

        const alreadyCompleted =
          typeof window !== "undefined" &&
          window.localStorage.getItem(getOnboardingStorageKey(data.id)) === "1";
        const hasBasicInfo = Boolean(data.club_name?.trim() || data.club_logo_url);

        if (!alreadyCompleted && !hasBasicInfo) {
          setStep(1);
          setOpen(true);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace("/login");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile]);

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) return;
    setError(null);
    setLogoFile(selected);
  }

  function openLogoPicker() {
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    logoInputRef.current?.click();
  }

  function markOnboardingCompleted() {
    if (typeof window === "undefined" || !profile) return;
    window.localStorage.setItem(getOnboardingStorageKey(profile.id), "1");
  }

  async function handleStepTwoSubmit() {
    if (!profile) return;

    setSaving(true);
    setError(null);

    try {
      let updatedProfile = profile;
      const normalizedClubName = clubName.trim();
      const shouldSaveName = normalizedClubName !== (profile.club_name ?? "");

      if (shouldSaveName) {
        updatedProfile = await api<UserProfile>("/profile", {
          method: "PUT",
          body: {
            club_name: normalizedClubName || null,
          },
        });
      }

      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        updatedProfile = await api<UserProfile>("/profile/logo", {
          method: "POST",
          body: formData,
        });
      }

      setProfile(updatedProfile);

      if (normalizedClubName || logoFile) {
        setConfirmationMessage("Guardamos tu informacion basica correctamente.");
      } else {
        setConfirmationMessage(
          "Tu cuenta ya quedo lista. Podras completar estos datos mas adelante desde el perfil."
        );
      }

      setStep(3);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "No se pudo guardar la informacion del club."));
    } finally {
      setSaving(false);
    }
  }

  function finishOnboarding() {
    markOnboardingCompleted();
    setOpen(false);
  }

  if (loading || !open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      closeOnEscape={false}
      showCloseButton={false}
      title={`Paso ${step} de ${TOTAL_STEPS}`}
      className="max-w-2xl"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, index) => {
              const currentStep = index + 1;
              const isActive = currentStep <= step;
              return (
                <div
                  key={currentStep}
                  className={`h-2 flex-1 rounded-full ${
                    isActive ? "bg-emerald-500" : "bg-zinc-200"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-zinc-950">
                Bienvenido a ProvoPadel
              </h2>
              <p className="text-sm leading-6 text-zinc-600">
                Te vamos a guiar en una configuracion inicial rapida para que tu
                club quede listo desde el primer ingreso.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
              En menos de un minuto podras dejar cargado el nombre de tu club y
              su imagen principal.
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Comenzar</Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-zinc-950">
                Completa la informacion basica de tu club
              </h2>
              <p className="text-sm leading-6 text-zinc-600">
                Puedes agregar ahora el nombre del club y una imagen para empezar
                con una identidad mas prolija.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-900">
                  Nombre del club
                </label>
                <Input
                  value={clubName}
                  onChange={(event) => setClubName(event.target.value)}
                  placeholder="Ej: Club Padel Norte"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-zinc-900">
                  Imagen del club
                </label>

                <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 md:flex-row md:items-center">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-white text-xs text-zinc-500">
                    {logoPreviewUrl ? (
                      <Image
                        src={logoPreviewUrl}
                        alt="Preview del logo del club"
                        width={96}
                        height={96}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center">Sin imagen</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={openLogoPicker}>
                        Seleccionar imagen
                      </Button>
                      {logoFile ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            if (logoInputRef.current) {
                              logoInputRef.current.value = "";
                            }
                            setLogoFile(null);
                          }}
                        >
                          Quitar imagen
                        </Button>
                      ) : null}
                    </div>

                    <p className="text-xs text-zinc-500">
                      Formatos permitidos: JPG, PNG o WEBP. Tamano maximo: 5MB.
                    </p>
                    {logoFile ? (
                      <p className="text-xs text-zinc-700">
                        Archivo seleccionado: {logoFile.name}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={saving}>
                Volver
              </Button>
              <Button onClick={handleStepTwoSubmit} disabled={saving}>
                {saving ? "Guardando..." : "Guardar y continuar"}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-zinc-950">
                Felicitaciones
              </h2>
              <p className="text-sm leading-6 text-zinc-600">
                {confirmationMessage}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Ya completaste tu informacion basica. Ahora puedes comenzar a
              crear tus competencias. Cuando quieras, tambien puedes ajustar
              estos datos desde la seccion de perfil del club.
            </div>

            <div className="flex justify-between gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Volver
              </Button>
              <Button onClick={finishOnboarding}>Empezar ahora</Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
