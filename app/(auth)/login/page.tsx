"use client";

export const dynamic = "force-dynamic";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(err.detail || "Login failed");
      }
  
      const data: LoginResponse = await res.json();
  
      const isAdmin = Boolean(data.is_admin);
      setToken(data.access_token, isAdmin);
      let target = next || (isAdmin ? "/admin" : "/dashboard");

      if (!isAdmin && target.startsWith("/admin")) {
        target = "/dashboard";
      }
      if (isAdmin && target === "/dashboard") {
        target = "/admin";
      }

      router.replace(target);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
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
              Acceso
            </div>
            <h1 className="text-3xl font-semibold">Login</h1>
            <p className="text-sm text-zinc-300">
              Accedé para gestionar tus torneos.
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

              <button
                type="button"
                className="w-full text-sm text-zinc-600 underline"
                onClick={() => router.push("/register")}
              >
                Crear cuenta
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
