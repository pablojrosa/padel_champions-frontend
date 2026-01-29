"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type {
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketStatus,
} from "@/lib/types";

export default function AdminSupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus>("open");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [statusEdit, setStatusEdit] = useState<SupportTicketStatus>("open");
  const [tagsEdit, setTagsEdit] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const firstResponseMinutes = useMemo(() => {
    if (!selected || selected.messages.length === 0) return null;
    const firstUser = selected.messages.find(
      (message) => message.author_type === "user"
    );
    const firstAdmin = selected.messages.find(
      (message) => message.author_type === "admin"
    );
    if (!firstUser || !firstAdmin) return null;
    const start = new Date(firstUser.created_at).getTime();
    const end = new Date(firstAdmin.created_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.round((end - start) / 60000);
  }, [selected]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  async function loadTickets() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await api<SupportTicket[]>("/admin/support/tickets");
      setTickets(data);
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
      setError(err?.message ?? "No se pudieron cargar los tickets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const totals = { open: 0, pending: 0, closed: 0 };
    tickets.forEach((ticket) => {
      if (ticket.status === "open") totals.open += 1;
      else if (ticket.status === "pending") totals.pending += 1;
      else totals.closed += 1;
    });
    return totals;
  }, [tickets]);

  const sorted = useMemo(() => {
    const base = tickets.filter((ticket) => ticket.status === statusFilter);
    const direction = sortOrder === "desc" ? -1 : 1;
    return [...base].sort((a, b) => {
      const aKey = a.last_message_at ?? a.updated_at;
      const bKey = b.last_message_at ?? b.updated_at;
      const compare = aKey.localeCompare(bKey);
      if (compare !== 0) return compare * direction;
      return (a.id - b.id) * direction;
    });
  }, [tickets, statusFilter, sortOrder]);

  async function openTicket(ticket: SupportTicket) {
    setSelectedId(ticket.id);
    setReplyBody("");
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await api<SupportTicketDetail>(
        `/admin/support/tickets/${ticket.id}`
      );
      setSelected(data);
      setStatusEdit(data.status);
      setTagsEdit(data.tags?.join(", ") ?? "");
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
      setDetailError(err?.message ?? "No se pudo cargar el ticket");
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveTicketUpdates() {
    if (!selected) return;
    setSaving(true);
    setDetailError(null);
    try {
      const tags = tagsEdit
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const updated = await api<SupportTicket>(
        `/admin/support/tickets/${selected.id}`,
        {
          method: "PUT",
          body: {
            status: statusEdit,
            tags: tags.length ? tags : [],
          },
        }
      );
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setDetailError(err?.message ?? "No se pudo actualizar el ticket");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setSendingReply(true);
    setDetailError(null);
    try {
      const created = await api<SupportMessage>(
        `/admin/support/tickets/${selected.id}/messages`,
        {
          method: "POST",
          body: { body: replyBody.trim() },
        }
      );
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              status: prev.status === "closed" ? "closed" : "pending",
              last_message_at: created.created_at,
              messages: [...prev.messages, created],
            }
          : prev
      );
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === selected.id
            ? {
                ...ticket,
                status: ticket.status === "closed" ? "closed" : "pending",
                last_message_at: created.created_at,
              }
            : ticket
        )
      );
      setReplyBody("");
    } catch (err: any) {
      setDetailError(err?.message ?? "No se pudo enviar la respuesta");
    } finally {
      setSendingReply(false);
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
            <h1 className="text-3xl font-semibold">Soporte</h1>
            <p className="text-sm text-zinc-300">
              Gestioná tickets y respondé mensajes de clientes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-white/95 lg:col-span-1">
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-zinc-900">Bandeja</div>
              <select
                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              >
                <option value="desc">Más nuevos</option>
                <option value="asc">Más viejos</option>
              </select>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("open")}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === "open"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                Abiertos
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
                  {counts.open}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === "pending"
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-amber-200 text-amber-600 hover:bg-amber-50"
                }`}
              >
                En espera
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                  {counts.pending}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("closed")}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  statusFilter === "closed"
                    ? "border-zinc-300 bg-zinc-100 text-zinc-700"
                    : "border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Cerrados
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] text-zinc-700">
                  {counts.closed}
                </span>
              </button>
            </div>
            {loading ? (
              <div className="text-sm text-zinc-600">Cargando tickets...</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text-zinc-600">
                No hay tickets {statusFilter === "open"
                  ? "abiertos"
                  : statusFilter === "pending"
                  ? "en espera"
                  : "cerrados"}
                .
              </div>
            ) : (
              <div className="space-y-3">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {sorted.map((ticket) => {
                  const statusStyles =
                    ticket.status === "closed"
                      ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                      : ticket.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200";
                  const isSelected = selectedId === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => openTicket(ticket)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{ticket.subject}</div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : statusStyles
                          }`}
                        >
                          {ticket.status === "open"
                            ? "Abierto"
                            : ticket.status === "pending"
                            ? "En espera"
                            : "Cerrado"}
                        </span>
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isSelected ? "text-white/70" : "text-zinc-500"
                        }`}
                      >
                        Último mensaje:{" "}
                        {formatDateTime(ticket.last_message_at ?? ticket.updated_at)}
                      </div>
                      <div
                        className={`mt-1 text-xs ${
                          isSelected ? "text-white/70" : "text-zinc-500"
                        }`}
                      >
                        {(ticket.user_club_name || "Sin club") +
                          ` · ${ticket.user_email ?? "Sin email"}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="bg-white/95 lg:col-span-2">
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-zinc-900">Conversación</div>
              {selected && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                    selected.status === "closed"
                      ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                      : selected.status === "pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {selected.status === "open"
                    ? "Abierto"
                    : selected.status === "pending"
                    ? "En espera"
                    : "Cerrado"}
                </span>
              )}
            </div>

            {detailLoading ? (
              <div className="text-sm text-zinc-600">Cargando ticket...</div>
            ) : selected ? (
              <div className="space-y-4">
                {detailError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {detailError}
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-zinc-900">
                      {selected.subject}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {(selected.user_club_name || "Sin club") +
                        ` · ${selected.user_email ?? "Sin email"}`}
                    </div>
                    {firstResponseMinutes !== null && (
                      <div className="text-xs text-zinc-500">
                        Tiempo de primera respuesta: {firstResponseMinutes} min
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>Creado: {formatDateTime(selected.created_at)}</div>
                    <div>Actualizado: {formatDateTime(selected.updated_at)}</div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600">
                      Estado
                    </label>
                    <select
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                      value={statusEdit}
                      onChange={(e) =>
                        setStatusEdit(e.target.value as SupportTicketStatus)
                      }
                    >
                      <option value="open">Abierto</option>
                      <option value="pending">En espera</option>
                      <option value="closed">Cerrado</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-600">
                      Etiquetas (separadas por coma)
                    </label>
                    <Input
                      value={tagsEdit}
                      onChange={(e) => setTagsEdit(e.target.value)}
                      placeholder="facturacion, bug, idea"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button onClick={saveTicketUpdates} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-zinc-900">Historial</div>
                  {selected.messages.length === 0 ? (
                    <div className="text-sm text-zinc-500">
                      No hay mensajes todavía.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selected.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-xl border px-4 py-3 ${
                            message.author_type === "admin"
                              ? "border-amber-200 bg-amber-50"
                              : "border-zinc-200 bg-white"
                          }`}
                        >
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                            {message.author_type === "admin"
                              ? "Respuesta"
                              : "Cliente"}
                          </div>
                          <div className="mt-1 text-sm text-zinc-800">
                            {message.body}
                          </div>
                          <div className="mt-2 text-xs text-zinc-400">
                            {formatDateTime(message.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">
                    Responder
                  </label>
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                    placeholder="Escribí una respuesta..."
                  />
                  <div className="flex items-center justify-end">
                    <Button
                      onClick={sendReply}
                      disabled={sendingReply || !replyBody.trim()}
                    >
                      {sendingReply ? "Enviando..." : "Enviar respuesta"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-600">
                Seleccioná un ticket para ver la conversación.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
