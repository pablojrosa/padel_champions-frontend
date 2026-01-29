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

type PaymentFormState = {
  userId: string;
  paidAt: string;
  planMonths: string;
  expiresAt: string;
  amount: string;
  notes: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<PaymentFormState>({
    userId: "",
    paidAt: todayISO(),
    planMonths: "1",
    expiresAt: "",
    amount: "",
    notes: "",
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PaymentFormState>({
    userId: "",
    paidAt: "",
    planMonths: "",
    expiresAt: "",
    amount: "",
    notes: "",
  });

  const sorted = useMemo(
    () =>
      [...payments].sort(
        (a, b) => b.paid_at.localeCompare(a.paid_at) || b.id - a.id
      ),
    [payments]
  );

  async function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);

    try {
      const [paymentData, userData] = await Promise.all([
        api<AdminPayment[]>("/admin/payments"),
        api<AdminUser[]>("/admin/users"),
      ]);
      setPayments(paymentData);
      setUsers(userData);
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
      setError(err?.message ?? "No se pudieron cargar pagos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm({
      userId: "",
      paidAt: todayISO(),
      planMonths: "1",
      expiresAt: "",
      amount: "",
      notes: "",
    });
  }

  async function createPayment() {
    if (!form.userId || !form.paidAt) return;
    setCreating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        user_id: Number(form.userId),
        paid_at: form.paidAt,
        plan_months: Number(form.planMonths || 1),
        amount: form.amount ? Number(form.amount) : null,
        currency: "ARS",
        notes: form.notes.trim() || null,
      };
      if (form.expiresAt) {
        payload.expires_at = form.expiresAt;
      }

      const created = await api<AdminPayment>("/admin/payments", {
        method: "POST",
        body: payload,
      });
      setPayments((prev) => [created, ...prev]);
      setCreateOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? "No se pudo crear el pago");
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(id: number) {
    if (!editForm.userId || !editForm.paidAt) return;
    setSavingId(id);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        user_id: Number(editForm.userId),
        paid_at: editForm.paidAt,
        currency: "ARS",
        notes: editForm.notes.trim() || null,
      };
      if (editForm.planMonths.trim()) {
        payload.plan_months = Number(editForm.planMonths);
      }
      if (editForm.amount.trim()) {
        payload.amount = Number(editForm.amount);
      } else if (editForm.amount === "") {
        payload.amount = null;
      }
      if (editForm.expiresAt) {
        payload.expires_at = editForm.expiresAt;
      }
      const updated = await api<AdminPayment>(`/admin/payments/${id}`, {
        method: "PUT",
        body: payload,
      });
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingId(null);
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar el pago");
    } finally {
      setSavingId(null);
    }
  }

  async function deletePayment(id: number) {
    const ok = window.confirm("¿Seguro que querés eliminar este pago?");
    if (!ok) return;
    setError(null);
    try {
      await api<void>(`/admin/payments/${id}`, { method: "DELETE" });
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo eliminar el pago");
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
            <Button variant="secondary" onClick={() => router.push("/admin")}>
              Volver al backoffice
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
            <h1 className="text-3xl font-semibold">Pagos</h1>
            <p className="text-sm text-zinc-300">
              Registrá pagos y vencimientos de tus clientes.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setCreateOpen(true)}>
            Nuevo pago
          </Button>
        </div>
      </div>

      <Modal
        open={createOpen}
        title="Nuevo pago"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-zinc-900">
                Cliente
              </label>
              <select
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 focus:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                value={form.userId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, userId: e.target.value }))
                }
                required
              >
                <option value="">Seleccionar cliente</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.club_name || "Sin club") + ` (${user.email})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Fecha de pago
              </label>
              <Input
                value={form.paidAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paidAt: e.target.value }))
                }
                type="date"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Meses del plan
              </label>
              <Input
                value={form.planMonths}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, planMonths: e.target.value }))
                }
                type="number"
                min="1"
                placeholder="Ej: 1, 3, 6"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Vencimiento manual
              </label>
              <Input
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expiresAt: e.target.value }))
                }
                type="date"
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">
                Monto (ARS)
              </label>
              <Input
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="Ej: 15000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-600">Notas</label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Opcional"
              />
            </div>
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
              onClick={createPayment}
              disabled={creating || !form.userId || !form.paidAt}
            >
              {creating ? "Guardando..." : "Crear pago"}
            </Button>
          </div>
        </div>
      </Modal>

      <Card className="bg-white/95">
        <div className="p-6">
          {loading ? (
            <div className="text-sm text-zinc-600">Cargando pagos...</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-zinc-600">No hay pagos todavía.</div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              {sorted.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3"
                >
                  {editingId === payment.id ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Cliente
                        </label>
                        <select
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                          value={editForm.userId}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              userId: e.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Seleccionar cliente</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {(user.club_name || "Sin club") + ` (${user.email})`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Fecha de pago
                        </label>
                        <Input
                          value={editForm.paidAt}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              paidAt: e.target.value,
                            }))
                          }
                          type="date"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Meses del plan
                        </label>
                        <Input
                          value={editForm.planMonths}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              planMonths: e.target.value,
                            }))
                          }
                          type="number"
                          min="1"
                          placeholder="Meses"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Vencimiento manual
                        </label>
                        <Input
                          value={editForm.expiresAt}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              expiresAt: e.target.value,
                            }))
                          }
                          type="date"
                          placeholder="Vence manual"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Monto (ARS)
                        </label>
                        <Input
                          value={editForm.amount}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              amount: e.target.value,
                            }))
                          }
                          placeholder="Monto (ARS)"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-600">
                          Notas
                        </label>
                        <Input
                          value={editForm.notes}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Notas"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-zinc-800">
                        {payment.user_email || `Usuario #${payment.user_id}`}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {payment.user_club_name || "Sin club"} · Pago{" "}
                        {payment.paid_at} · Vence {payment.expires_at}
                      </div>
                      {payment.plan_months && (
                        <div className="text-xs text-zinc-400">
                          Plan: {payment.plan_months} mes(es)
                        </div>
                      )}
                      {payment.amount && (
                        <div className="text-xs text-zinc-400">
                          Monto: {payment.amount} {payment.currency}
                        </div>
                      )}
                      {payment.notes && (
                        <div className="text-xs text-zinc-400">{payment.notes}</div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-2 self-end">
                    {editingId === payment.id ? (
                      <>
                        <Button
                          onClick={() => saveEdit(payment.id)}
                          disabled={savingId === payment.id || !editForm.userId}
                        >
                          {savingId === payment.id ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null);
                            setEditForm({
                              userId: "",
                              paidAt: "",
                              planMonths: "",
                              expiresAt: "",
                              amount: "",
                              notes: "",
                            });
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditingId(payment.id);
                            setEditForm({
                              userId: String(payment.user_id),
                              paidAt: payment.paid_at ?? "",
                              planMonths: payment.plan_months
                                ? String(payment.plan_months)
                                : "",
                              expiresAt: payment.expires_at ?? "",
                              amount: payment.amount ? String(payment.amount) : "",
                              notes: payment.notes ?? "",
                            });
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => deletePayment(payment.id)}
                        >
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
