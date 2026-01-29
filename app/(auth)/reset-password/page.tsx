"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";

function ResetPasswordContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token");

  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [success, setSuccess] = useState<string | null>(null);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
        auth: false,
      });
      setInfo(
        res.message ||
          "Te enviamos un link para restablecer tu contraseña."
      );
      setEmail("");
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message ?? "No se pudo enviar el email");
      } else {
        setError("No se pudo enviar el email");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!password.trim()) {
      setError("Ingresá una nueva contraseña.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password: password.trim() },
        auth: false,
      });
      setSuccess(res.message || "Contraseña actualizada.");
      setPassword("");
      setConfirm("");
      setTimeout(() => router.replace("/login"), 1500);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (String(err.message).toLowerCase().includes("token")) {
          setError(
            "El link es inválido o ya venció. Pedí uno nuevo desde esta misma pantalla."
          );
        } else {
          setError(err.message ?? "No se pudo actualizar la contraseña");
        }
      } else {
        setError("No se pudo actualizar la contraseña");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Recuperar acceso
            </div>
            <h1 className="text-3xl font-semibold">
              {token ? "Crear nueva contraseña" : "Olvidé mi contraseña"}
            </h1>
            <p className="text-sm text-zinc-300">
              {token
                ? "Definí una nueva contraseña para ingresar."
                : "Te enviaremos un link válido por 10 minutos al email de tu cuenta."}
            </p>
          </div>

          <Card className="bg-white/95">
            {token ? (
              <form onSubmit={resetPassword} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-800">
                    Nueva contraseña
                  </label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-800">
                    Repetir contraseña
                  </label>
                  <Input
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    type="password"
                    required
                  />
                </div>

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

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Guardando..." : "Actualizar contraseña"}
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-zinc-600 underline"
                  onClick={() => router.push("/login")}
                >
                  Volver al login
                </button>
              </form>
            ) : (
              <form onSubmit={requestReset} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-800">
                    Email
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
                {info && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    {info}
                  </div>
                )}

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Enviando..." : "Enviar link de reset"}
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-zinc-600 underline"
                  onClick={() => router.push("/login")}
                >
                  Volver al login
                </button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
