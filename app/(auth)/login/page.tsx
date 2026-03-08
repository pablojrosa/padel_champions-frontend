"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LandingHeader from "@/components/LandingHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import GoogleAuthButton from "@/components/GoogleAuthButton";
import { resolvePostAuthPath, setToken } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");
  const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function normalizeLoginError(message: string | null | undefined) {
    const value = (message ?? "").trim();
    if (!value) return "No se pudo iniciar sesion.";
    if (/incorrect email or password/i.test(value)) {
      return "Email o contrasena incorrectos.";
    }
    if (/use google sign-in for this account/i.test(value)) {
      return "Esta cuenta usa acceso con Google.";
    }
    if (/login failed/i.test(value)) {
      return "No se pudo iniciar sesion.";
    }
    return value;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
  
    try {
      const body = new URLSearchParams();
      body.append("username", email); 
      body.append("password", password);
  
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }
      );
  
      if (!res.ok) {
        const err = await res.json();
        throw new Error(normalizeLoginError(err.detail || "No se pudo iniciar sesion."));
      }
  
      const data: LoginResponse = await res.json();
  
      const isAdmin = Boolean(data.is_admin);
      setToken(data.access_token, isAdmin);
      router.replace(resolvePostAuthPath(isAdmin, next));
    } catch (err: unknown) {
      setError(
        normalizeLoginError(err instanceof Error ? err.message : undefined)
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-24 h-64 w-64 rounded-full bg-emerald-500/20 blur-[120px]" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      <LandingHeader showAuthActions={false} />

      <div className="relative z-10 grid min-h-[calc(100vh-104px)] place-items-center px-6 pb-8 pt-6">
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Acceso
            </div>
            <h1 className="text-3xl font-semibold">Login</h1>
            <p className="text-sm text-zinc-300">
              Accede para gestionar tus torneos.
            </p>
          </div>

          <Card className="bg-white/95">
            <form onSubmit={onSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-800">Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-800">Password</label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Ingresando..." : "Ingresar"}
              </Button>

              {googleEnabled && (
                <>
                  <div className="flex items-center gap-3 pt-1 text-xs uppercase tracking-[0.25em] text-zinc-400">
                    <div className="h-px flex-1 bg-zinc-200" />
                    <span>o</span>
                    <div className="h-px flex-1 bg-zinc-200" />
                  </div>

                  <GoogleAuthButton mode="login" nextPath={next} />
                </>
              )}

              <div className="flex items-center justify-center gap-6 pt-1">
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline"
                  onClick={() => router.push("/reset-password")}
                >
                  Olvidé mi contraseña
                </button>

                <button
                  type="button"
                  className="text-sm text-zinc-600 underline"
                  onClick={() => router.push("/register")}
                >
                  Crear cuenta
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
