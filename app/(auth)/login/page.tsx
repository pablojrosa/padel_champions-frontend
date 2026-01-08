"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";

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
  
      setToken(data.access_token);
      router.replace(next);
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
      <div className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Login</h1>
          <p className="text-sm text-zinc-600">Accedé para gestionar tus torneos.</p>
        </div>

        <Card>
          <form onSubmit={onSubmit} className="p-5 space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Password</label>
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
              {submitting ? "Ingresando..." : "Login"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-zinc-700 underline"
              onClick={() => router.push("/register")}
            >
              Crear cuenta
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
