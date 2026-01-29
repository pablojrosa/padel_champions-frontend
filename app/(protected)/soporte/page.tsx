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

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replySending, setReplySending] = useState(false);

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
    try {
      const data = await api<SupportTicket[]>("/support/tickets");
      setTickets(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
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

  const sorted = useMemo(
    () =>
      [...tickets].sort(
        (a, b) =>
          (b.last_message_at ?? b.updated_at).localeCompare(
            a.last_message_at ?? a.updated_at
          ) || b.id - a.id
      ),
    [tickets]
  );

  function statusLabel(status: SupportTicketStatus) {
    if (status === "closed") return "Cerrado";
    if (status === "pending") return "En espera";
    return "Abierto";
  }

  function statusStyles(status: SupportTicketStatus) {
    if (status === "closed") return "bg-zinc-100 text-zinc-600 border-zinc-200";
    if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  async function openTicket(ticketId: number) {
    setSelectedId(ticketId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await api<SupportTicketDetail>(`/support/tickets/${ticketId}`);
      setDetail(data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setDetailError(err?.message ?? "No se pudo cargar el ticket");
    } finally {
      setDetailLoading(false);
    }
  }

  async function createTicket() {
    if (!subject.trim() || !message.trim()) return;
    setCreating(true);
    setSubmitError(null);
    try {
      const created = await api<SupportTicketDetail>("/support/tickets", {
        method: "POST",
        body: {
          subject: subject.trim(),
          message: message.trim(),
        },
      });
      const nextTicket: SupportTicket = {
        id: created.id,
        user_id: created.user_id,
        subject: created.subject,
        status: created.status,
        tags: created.tags ?? null,
        created_at: created.created_at,
        updated_at: created.updated_at,
        last_message_at: created.last_message_at ?? null,
        user_email: created.user_email ?? null,
        user_club_name: created.user_club_name ?? null,
      };
      setTickets((prev) => [nextTicket, ...prev]);
      setSubject("");
      setMessage("");
      setSelectedId(created.id);
      setDetail(created);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      setSubmitError(err?.message ?? "No se pudo enviar el ticket");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply() {
    if (!selectedId || !replyBody.trim()) return;
    setReplySending(true);
    setDetailError(null);
    try {
      const created = await api<SupportMessage>(
        `/support/tickets/${selectedId}/messages`,
        {
          method: "POST",
          body: { body: replyBody.trim() },
        }
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              status: "open",
              last_message_at: created.created_at,
              messages: [...prev.messages, created],
            }
          : prev
      );
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === selectedId
            ? {
                ...ticket,
                status: "open",
                last_message_at: created.created_at,
              }
            : ticket
        )
      );
      setReplyBody("");
    } catch (err: any) {
      setDetailError(err?.message ?? "No se pudo enviar el mensaje");
    } finally {
      setReplySending(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
            Soporte
          </div>
          <h1 className="text-3xl font-semibold">Tus consultas</h1>
          <p className="text-sm text-zinc-300">
            Creá tickets, revisá respuestas y seguí la conversación.
          </p>
        </div>
      </div>

      <Card className="bg-white/95">
        <div className="p-6 space-y-4">
          <div>
            <div className="text-lg font-semibold text-zinc-900">
              Nuevo ticket
            </div>
            <div className="text-sm text-zinc-600">
              Describí tu consulta y te respondemos por acá.
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto"
              maxLength={200}
            />
            <div className="md:col-span-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribí tu mensaje..."
                rows={4}
                className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
              />
            </div>
          </div>
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </div>
          )}
          <div className="flex items-center justify-end">
            <Button
              onClick={createTicket}
              disabled={creating || !subject.trim() || !message.trim()}
            >
              {creating ? "Enviando..." : "Crear ticket"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="bg-white/95 lg:col-span-1">
          <div className="p-6 space-y-4">
            <div className="text-lg font-semibold text-zinc-900">Bandeja</div>
            {loading ? (
              <div className="text-sm text-zinc-600">Cargando tickets...</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text-zinc-600">
                Todavía no abriste tickets.
              </div>
            ) : (
              <div className="space-y-3">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {sorted.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedId === ticket.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">
                        {ticket.subject}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          selectedId === ticket.id
                            ? "border-white/20 bg-white/10 text-white"
                            : statusStyles(ticket.status)
                        }`}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-xs ${
                        selectedId === ticket.id ? "text-white/70" : "text-zinc-500"
                      }`}
                    >
                      Último mensaje:{" "}
                      {formatDateTime(ticket.last_message_at ?? ticket.updated_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="bg-white/95 lg:col-span-2">
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-lg font-semibold text-zinc-900">
                Conversación
              </div>
              {detail && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles(
                    detail.status
                  )}`}
                >
                  {statusLabel(detail.status)}
                </span>
              )}
            </div>

            {detailLoading ? (
              <div className="text-sm text-zinc-600">Cargando conversación...</div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-800">
                    {detail.subject}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Creado: {formatDateTime(detail.created_at)}
                  </div>
                </div>

                {detailError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {detailError}
                  </div>
                )}

                <div className="space-y-2">
                  {detail.messages.length === 0 ? (
                    <div className="text-sm text-zinc-600">
                      No hay mensajes todavía.
                    </div>
                  ) : (
                    detail.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`rounded-xl border px-4 py-3 ${
                          msg.author_type === "admin"
                            ? "border-amber-200 bg-amber-50"
                            : "border-zinc-200 bg-white"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          {msg.author_type === "admin" ? "Soporte" : "Vos"}
                        </div>
                        <div className="mt-1 text-sm text-zinc-800">
                          {msg.body}
                        </div>
                        <div className="mt-2 text-xs text-zinc-400">
                          {formatDateTime(msg.created_at)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {detail.status === "closed" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    El ticket se ha marcado como resuelto. Si tenés otra consulta,
                    creá un nuevo ticket.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-900">
                      Responder
                    </label>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20"
                      placeholder="Escribí tu respuesta..."
                    />
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={sendReply}
                        disabled={replySending || !replyBody.trim()}
                      >
                        {replySending ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>
                )}
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
