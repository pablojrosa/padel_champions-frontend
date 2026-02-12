"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { AdminPayment, AdminUser } from "@/lib/types";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [clubLogoUrl, setClubLogoUrl] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editClubName, setEditClubName] = useState("");
  const [editClubLocation, setEditClubLocation] = useState("");
  const [editClubLogoUrl, setEditClubLogoUrl] = useState("");
  const [editStatusOverride, setEditStatusOverride] = useState<
    "" | "active" | "inactive"
  >("");
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [paymentsUser, setPaymentsUser] = useState<AdminUser | null>(null);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users]
  );
  const paymentsForUser = useMemo(() => {
    if (!paymentsUser) return [];
    return [...payments]
      .filter((payment) => payment.user_id === paymentsUser.id)
      .sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.id - a.id);
  }, [payments, paymentsUser]);

  async function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const data = await api<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return;
      }
      setError(err?.message ?? "No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser() {
    if (!email.trim() || !password.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const payload = {
        email: email.trim(),
        password: password.trim(),
        club_name: clubName.trim() || null,
        club_location: clubLocation.trim() || null,
        club_logo_url: clubLogoUrl.trim() || null,
      };
      const created = await api<AdminUser>("/admin/users", {
        method: "POST",
        body: payload,
      });
      setUsers((prev) => [created, ...prev]);
      setEmail("");
      setPassword("");
      setClubName("");
      setClubLocation("");
      setClubLogoUrl("");
      setCreateOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear usuario");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: number) {
    if (!editEmail.trim()) return;
    setSavingId(id);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        email: editEmail.trim(),
        club_name: editClubName.trim() || null,
        club_location: editClubLocation.trim() || null,
        club_logo_url: editClubLogoUrl.trim() || null,
        status_override: editStatusOverride ? editStatusOverride : null,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const updated = await api<AdminUser>(`/admin/users/${id}`, {
        method: "PUT",
        body: payload,
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setEditingId(null);
      setEditEmail("");
      setEditPassword("");
      setEditClubName("");
      setEditClubLocation("");
      setEditClubLogoUrl("");
      setEditStatusOverride("");
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar usuario");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(id: number) {
    const ok = window.confirm("¿Seguro que querés eliminar este usuario?");
    if (!ok) return;
    setError(null);
    try {
      await api<void>(`/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar usuario");
    }
  }

  async function loadPayments() {
    if (paymentsLoading) return;
    setPaymentsLoading(true);
    setPaymentsError(null);

    try {
      const data = await api<AdminPayment[]>("/admin/payments");
      setPayments(data);
      setPaymentsLoaded(true);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        return;
      }
      setPaymentsError(err?.message ?? "No se pudieron cargar pagos");
    } finally {
      setPaymentsLoading(false);
    }
  }

  function openPayments(user: AdminUser) {
    setPaymentsUser(user);
    setPaymentsOpen(true);
    if (!paymentsLoaded) {
      loadPayments();
    }
  }

  if (forbidden) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Administrador
          </div>
          <h1 className="text-3xl font-semibold">Acceso restringido</h1>
          <p className="text-sm text-zinc-300">
            Esta sección solo está disponible para el mail administrador.
          </p>
        </div>
        <Card className="bg-white/95">
          <div className="p-6 space-y-4">
            <div className="text-sm text-zinc-700">
              Si necesitás acceso, revisá el mail configurado en ADMIN_EMAIL.
            </div>
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Volver al dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          Administrador
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Cuentas de clientes</h1>
            <p className="text-sm text-zinc-300">
              Creá, editá y eliminá cuentas desde un solo lugar.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            Nuevo usuario
          </Button>
        </div>
      </div>

      <Modal
        open={createOpen}
        title="Nuevo usuario"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              required
            />
            <Input
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              placeholder="Nombre del club (opcional)"
            />
            <Input
              value={clubLocation}
              onChange={(e) => setClubLocation(e.target.value)}
              placeholder="Ubicación (opcional)"
            />
            <Input
              value={clubLogoUrl}
              onChange={(e) => setClubLogoUrl(e.target.value)}
              placeholder="Logo URL (opcional)"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={createUser}
              disabled={creating || !email.trim() || !password.trim()}
            >
              {creating ? "Creando..." : "Crear usuario"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={paymentsOpen}
        title={
          paymentsUser
            ? `Pagos de ${paymentsUser.club_name || paymentsUser.email}`
            : "Pagos"
        }
        onClose={() => {
          setPaymentsOpen(false);
          setPaymentsUser(null);
          setPaymentsError(null);
        }}
        className="max-w-2xl"
      >
        <div className="space-y-3">
          {paymentsError && (
            <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
              {paymentsError}
            </div>
          )}
          {paymentsLoading ? (
            <div className="text-sm text-zinc-600">Cargando pagos...</div>
          ) : paymentsUser && paymentsForUser.length === 0 ? (
            <div className="text-sm text-zinc-600">
              No hay pagos registrados para este usuario.
            </div>
          ) : (
            <div className="space-y-2">
              {paymentsForUser.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-zinc-200 bg-white p-3"
                >
                  <div className="text-sm font-semibold text-zinc-800">
                    Pago {payment.paid_at}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Vence {payment.expires_at}
                  </div>
                  {payment.plan_months ? (
                    <div className="text-xs text-zinc-400">
                      Plan: {payment.plan_months} mes(es)
                    </div>
                  ) : null}
                  {payment.amount !== null &&
                  payment.amount !== undefined &&
                  payment.amount !== "" ? (
                    <div className="text-xs text-zinc-400">
                      Monto: {payment.amount} {payment.currency}
                    </div>
                  ) : null}
                  {payment.notes ? (
                    <div className="text-xs text-zinc-400">
                      {payment.notes}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end">
            <Button variant="secondary" onClick={() => setPaymentsOpen(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      <Card className="bg-white/95">
        <div className="p-6">
          {loading ? (
            <div className="text-sm text-zinc-600">Cargando usuarios...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-zinc-600">No hay usuarios todavía.</div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              {sorted.map((user) => (
                <div
                  key={user.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3"
                >
                  {editingId === user.id ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Email"
                        type="email"
                      />
                      <Input
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Nueva password (opcional)"
                        type="password"
                      />
                      <Input
                        value={editClubName}
                        onChange={(e) => setEditClubName(e.target.value)}
                        placeholder="Nombre del club"
                      />
                      <Input
                        value={editClubLocation}
                        onChange={(e) => setEditClubLocation(e.target.value)}
                        placeholder="Ubicación"
                      />
                      <Input
                        value={editClubLogoUrl}
                        onChange={(e) => setEditClubLogoUrl(e.target.value)}
                        placeholder="Logo URL"
                      />
                      <select
                        className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                        value={editStatusOverride}
                        onChange={(e) =>
                          setEditStatusOverride(e.target.value as "" | "active" | "inactive")
                        }
                      >
                        <option value="">Estado automático</option>
                        <option value="active">Forzar activo</option>
                        <option value="inactive">Forzar inactivo</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                        {user.club_logo_url ? (
                          <img
                            src={user.club_logo_url}
                            alt={user.club_name || user.email}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-zinc-400">
                            Sin logo
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-zinc-800">
                            {user.email}
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                              user.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-zinc-100 text-zinc-700 border-zinc-200"
                            }`}
                          >
                            {user.status === "active" ? "Activo" : "Inactivo"}
                          </span>
                          {user.status_override && (
                            <span className="text-xs font-semibold text-amber-600">
                              Manual
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {user.club_name || "Sin club"} ·{" "}
                          {user.club_location || "Sin ubicación"}
                        </div>
                        {user.last_payment_expires_at && (
                          <div className="text-xs text-zinc-400">
                            Vence: {user.last_payment_expires_at}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 self-end">
                    {editingId === user.id ? (
                      <>
                        <Button
                          onClick={() => saveEdit(user.id)}
                          disabled={savingId === user.id || !editEmail.trim()}
                        >
                          {savingId === user.id ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditEmail("");
                            setEditPassword("");
                            setEditClubName("");
                            setEditClubLocation("");
                            setEditClubLogoUrl("");
                            setEditStatusOverride("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => openPayments(user)}
                        >
                          Ver pagos
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(user.id);
                            setEditEmail(user.email ?? "");
                            setEditPassword("");
                            setEditClubName(user.club_name ?? "");
                            setEditClubLocation(user.club_location ?? "");
                            setEditClubLogoUrl(user.club_logo_url ?? "");
                            setEditStatusOverride(user.status_override ?? "");
                          }}
                        >
                          Editar
                        </Button>
                        <Button variant="danger" onClick={() => deleteUser(user.id)}>
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
