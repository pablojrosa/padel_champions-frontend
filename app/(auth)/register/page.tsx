"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api("/auth/register", {
        method: "POST",
        body: { email, password },
        auth: false,
      });
      router.replace("/login");
    } catch (err: any) {
      setError(err?.message ?? "Register failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Register</h1>
          <p className="text-sm text-zinc-600">Creá tu cuenta de organizador.</p>
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
              {submitting ? "Creando..." : "Crear cuenta"}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-zinc-700 underline"
              onClick={() => router.push("/login")}
            >
              Volver a login
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
