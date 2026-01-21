"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { AdminClient, PaymentRecord, PlanType, UserProfile } from "@/lib/types";

type StatusFilter = "all" | "active" | "inactive";

const emptyStats = {
  total: 0,
  active: 0,
  inactive: 0,
  expiring: 0,
};

const planLabels: Record<PlanType, string> = {
  free: "Free",
  plus: "Plus",
  pro_plus: "Pro+",
};

const planOptions: { value: PlanType; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "plus", label: "Plus" },
  { value: "pro_plus", label: "Pro+" },
];

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isWithinCurrentMonth(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const monthEnd = endOfMonth(now);
  return date >= new Date(now.getFullYear(), now.getMonth(), 1) && date <= monthEnd;
}

export default function AdminPage() {
  const router = useRouter();
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<number, string>>({});
  const [planDrafts, setPlanDrafts] = useState<Record<number, PlanType>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [paymentsOpenId, setPaymentsOpenId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editingPaymentDate, setEditingPaymentDate] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<AdminClient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await api<UserProfile>("/profile");
      if (!profile.is_superadmin) {
        router.replace("/dashboard");
        return;
      }

      const data = await api<AdminClient[]>("/admin/clients");
      setClients(data);
      setPaymentDrafts(
        data.reduce<Record<number, string>>((acc, item) => {
          acc[item.id] = toDateInput(item.last_payment_at);
          return acc;
        }, {})
      );
      setPlanDrafts(
        data.reduce<Record<number, PlanType>>((acc, item) => {
          acc[item.id] = item.plan_type;
          return acc;
        }, {})
      );
      setLastUpdated(new Date().toLocaleTimeString("es-AR"));
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err?.message ?? "No se pudieron cargar los clientes");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const stats = useMemo(() => {
    const base = { ...emptyStats };
    clients.forEach((client) => {
      base.total += 1;
      if (client.is_active) {
        base.active += 1;
      } else {
        base.inactive += 1;
      }
      const remaining = daysUntil(client.subscription_ends_at);
      if (remaining !== null && remaining >= 0 && isWithinCurrentMonth(client.subscription_ends_at)) {
        base.expiring += 1;
      }
    });
    return base;
  }, [clients]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesQuery = trimmed
        ? `${client.club_name ?? ""} ${client.email} ${client.club_location ?? ""}`
            .toLowerCase()
            .includes(trimmed)
        : true;
      const matchesStatus =
        filter === "all" ? true : filter === "active" ? client.is_active : !client.is_active;
      return matchesQuery && matchesStatus;
    });
  }, [clients, filter, query]);

  async function toggleActive(client: AdminClient) {
    setSavingId(client.id);
    setError(null);
    try {
      const updated = await api<AdminClient>(`/admin/clients/${client.id}`, {
        method: "PATCH",
        body: { is_active: !client.is_active },
      });
      setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo actualizar el estado");
    } finally {
      setSavingId(null);
    }
  }

  async function saveLastPayment(client: AdminClient) {
    setSavingId(client.id);
    setError(null);
    const draft = paymentDrafts[client.id];
    const payload = draft ? `${draft}T00:00:00` : null;
    try {
      const updated = await api<AdminClient>(`/admin/clients/${client.id}`, {
        method: "PATCH",
        body: { last_payment_at: payload },
      });
      setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (paymentsOpenId === client.id) {
        await loadPayments(client.id);
      }
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar el ultimo pago");
    } finally {
      setSavingId(null);
    }
  }

  async function savePlan(client: AdminClient) {
    setSavingId(client.id);
    setError(null);
    try {
      const updated = await api<AdminClient>(`/admin/clients/${client.id}`, {
        method: "PATCH",
        body: { plan_type: planDrafts[client.id] },
      });
      setClients((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      setError(err?.message ?? "No se pudo guardar el plan");
    } finally {
      setSavingId(null);
    }
  }

  async function loadPayments(userId: number) {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const data = await api<PaymentRecord[]>(`/admin/clients/${userId}/payments`);
      setPayments(data);
    } catch (err: any) {
      setPaymentsError(err?.message ?? "No se pudieron cargar los pagos");
    } finally {
      setPaymentsLoading(false);
    }
  }

  function openPayments(client: AdminClient) {
    setPaymentsOpenId(client.id);
    loadPayments(client.id);
  }

  function closePayments() {
    setPaymentsOpenId(null);
    setPayments([]);
    setPaymentsError(null);
    setEditingPaymentId(null);
    setEditingPaymentDate("");
  }

  function openDelete(client: AdminClient) {
    setDeleteError(null);
    setDeleteTarget(client);
  }

  function closeDelete() {
    if (deleteLoading) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api(`/admin/clients/${deleteTarget.id}`, { method: "DELETE" });
      setClients((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setPaymentDrafts((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setPlanDrafts((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      if (paymentsOpenId === deleteTarget.id) {
        closePayments();
      }
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err?.message ?? "No se pudo eliminar el club");
    } finally {
      setDeleteLoading(false);
    }
  }

  function startEditPayment(payment: PaymentRecord) {
    setEditingPaymentId(payment.id);
    setEditingPaymentDate(toDateInput(payment.paid_at));
  }

  function cancelEditPayment() {
    setEditingPaymentId(null);
    setEditingPaymentDate("");
  }

  async function savePayment(payment: PaymentRecord) {
    if (!editingPaymentDate) return;
    setPaymentsError(null);
    try {
      await api<PaymentRecord>(`/admin/payments/${payment.id}`, {
        method: "PATCH",
        body: { paid_at: `${editingPaymentDate}T00:00:00` },
      });
      await loadPayments(payment.user_id);
      setEditingPaymentId(null);
      setEditingPaymentDate("");
      await loadClients();
    } catch (err: any) {
      setPaymentsError(err?.message ?? "No se pudo actualizar el pago");
    }
  }

  async function removePayment(payment: PaymentRecord) {
    if (!window.confirm("Eliminar este pago?")) return;
    setPaymentsError(null);
    try {
      await api(`/admin/payments/${payment.id}`, { method: "DELETE" });
      await loadPayments(payment.user_id);
      await loadClients();
    } catch (err: any) {
      setPaymentsError(err?.message ?? "No se pudo eliminar el pago");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Backoffice
          </div>
          <h1 className="text-3xl font-semibold">Clientes y suscripciones</h1>
          <p className="text-sm text-zinc-300">
            Administrá cuentas, estados y vencimientos desde un solo lugar.
          </p>
        </div>
        <div className="text-xs text-zinc-400">
          {loading ? "Cargando..." : lastUpdated ? `Actualizado ${lastUpdated}` : "Actualizado"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white/95">
          <div className="p-5 space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Total</div>
            <div className="text-2xl font-semibold text-zinc-900">
              {loading ? "..." : stats.total}
            </div>
            <div className="text-xs text-zinc-500">Cuentas registradas</div>
          </div>
        </Card>
        <Card className="bg-white/95">
          <div className="p-5 space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Activas</div>
            <div className="text-2xl font-semibold text-emerald-700">
              {loading ? "..." : stats.active}
            </div>
            <div className="text-xs text-zinc-500">En uso</div>
          </div>
        </Card>
        <Card className="bg-white/95">
          <div className="p-5 space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Inactivas</div>
            <div className="text-2xl font-semibold text-zinc-700">
              {loading ? "..." : stats.inactive}
            </div>
            <div className="text-xs text-zinc-500">Sin acceso</div>
          </div>
        </Card>
        <Card className="bg-white/95">
          <div className="p-5 space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Por vencer</div>
            <div className="text-2xl font-semibold text-amber-700">
              {loading ? "..." : stats.expiring}
            </div>
            <div className="text-xs text-zinc-500">Este mes</div>
          </div>
        </Card>
      </div>

      <Card className="bg-white/95">
        <div className="p-6 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-lg font-semibold text-zinc-900">
                Lista de clientes
              </div>
              <div className="text-xs text-zinc-500">
                {filtered.length} de {clients.length} cuentas
              </div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                placeholder="Buscar por club, email o ubicacion"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="md:w-72"
              />
              <div className="flex gap-2">
                {(["all", "active", "inactive"] as StatusFilter[]).map((item) => (
                  <Button
                    key={item}
                    variant={filter === item ? "primary" : "secondary"}
                    onClick={() => setFilter(item)}
                  >
                    {item === "all" ? "Todos" : item === "active" ? "Activos" : "Inactivos"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                Cargando clientes...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                No hay clientes con esos filtros.
              </div>
            ) : (
              filtered.map((client) => {
                const remaining = daysUntil(client.subscription_ends_at);
                const isExpired = remaining !== null && remaining < 0;
                const isExpiringThisMonth =
                  remaining !== null && remaining >= 0 && isWithinCurrentMonth(client.subscription_ends_at);
                return (
                  <div
                    key={client.id}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm md:px-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">
                          Cliente #{client.id}
                        </div>
                        <div className="text-lg font-semibold text-zinc-900">
                          {client.club_name ?? "Sin club"}
                        </div>
                        <div className="text-sm text-zinc-500">{client.email}</div>
                        <div className="text-xs text-zinc-500">
                          {client.club_location ?? "Ubicacion sin definir"}
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:items-end">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-medium ${
                              client.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {client.is_active ? "Activo" : "Inactivo"}
                          </span>
                          {remaining !== null && (
                            <span
                              className={`rounded-full px-2.5 py-1 font-medium ${
                                isExpired
                                  ? "bg-red-50 text-red-600"
                                  : isExpiringThisMonth
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {isExpired
                                ? "Vencido"
                                : isExpiringThisMonth
                                ? "Vence fin de mes"
                                : "Al dia"}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Alta: {formatDate(client.created_at)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Plan: {planLabels[client.plan_type]}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Ultimo pago: {formatDate(client.last_payment_at)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Vencimiento: {formatDate(client.subscription_ends_at)}
                        </div>
                        <button
                          type="button"
                          className="text-xs text-zinc-500 underline hover:text-zinc-700"
                          onClick={() => openPayments(client)}
                        >
                          Ver todos los pagos
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-zinc-500">
                            Fecha de ultimo pago
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={paymentDrafts[client.id] ?? ""}
                              onChange={(event) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [client.id]: event.target.value,
                                }))
                              }
                              className="w-44"
                            />
                            <Button
                              variant="secondary"
                              disabled={savingId === client.id}
                              onClick={() => saveLastPayment(client)}
                              aria-label="Guardar pago"
                              className="h-10 w-10 p-0"
                            >
                              💾
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-medium text-zinc-500">Plan</div>
                          <div className="flex items-center gap-2">
                            <select
                              value={planDrafts[client.id] ?? "free"}
                              onChange={(event) =>
                                setPlanDrafts((prev) => ({
                                  ...prev,
                                  [client.id]: event.target.value as PlanType,
                                }))
                              }
                              className="h-10 w-40 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                            >
                              {planOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="secondary"
                              disabled={savingId === client.id}
                              onClick={() => savePlan(client)}
                              aria-label="Guardar plan"
                              className="h-10 w-10 p-0"
                            >
                              💾
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={client.is_active ? "secondary" : "primary"}
                          disabled={savingId === client.id}
                          onClick={() => toggleActive(client)}
                        >
                          {client.is_active ? "Desactivar" : "Activar"}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={savingId === client.id}
                          onClick={() => openDelete(client)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={paymentsOpenId !== null}
        title="Pagos registrados"
        onClose={closePayments}
      >
        {paymentsLoading ? (
          <div className="text-sm text-zinc-500">Cargando pagos...</div>
        ) : paymentsError ? (
          <div className="text-sm text-red-600">{paymentsError}</div>
        ) : payments.length === 0 ? (
          <div className="text-sm text-zinc-500">No hay pagos registrados.</div>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                      Pago
                    </div>
                    {editingPaymentId === payment.id ? (
                      <Input
                        type="date"
                        value={editingPaymentDate}
                        onChange={(event) => setEditingPaymentDate(event.target.value)}
                        className="mt-1 w-40"
                      />
                    ) : (
                      <div className="text-sm font-semibold text-zinc-900">
                        {formatDate(payment.paid_at)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingPaymentId === payment.id ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => savePayment(payment)}
                          disabled={!editingPaymentDate}
                        >
                          Guardar
                        </Button>
                        <Button variant="secondary" onClick={cancelEditPayment}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => startEditPayment(payment)}
                        >
                          Modificar
                        </Button>
                        <Button variant="danger" onClick={() => removePayment(payment)}>
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Eliminar club"
        onClose={closeDelete}
      >
        <div className="space-y-4">
          <div className="text-sm text-zinc-700">
            Estas por eliminar al club{" "}
            <span className="font-semibold text-zinc-900">
              "{deleteTarget?.club_name ?? "Sin club"}"
            </span>
            . Deseas continuar?
          </div>
          {deleteError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeDelete} disabled={deleteLoading}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
