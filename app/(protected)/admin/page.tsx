"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { api, ApiError } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import type { AdminMetrics, AdminPaymentsSeries } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [series, setSeries] = useState<AdminPaymentsSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSeriesLoading(true);
      setForbidden(false);
      setError(null);
      try {
        const [metricsData, seriesData] = await Promise.all([
          api<AdminMetrics>("/admin/metrics"),
          api<{ series: AdminPaymentsSeries[] }>("/admin/payments/last-30-days"),
        ]);
        setMetrics(metricsData);
        setSeries(seriesData.series ?? []);
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
        setError(err?.message ?? "No se pudieron cargar métricas");
      } finally {
        setLoading(false);
        setSeriesLoading(false);
      }
    }

    load();
  }, [router]);

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

  function getSeriesValue(item: AdminPaymentsSeries | { count?: number }) {
    const raw = (item as AdminPaymentsSeries).total ?? (item as { count?: number }).count ?? 0;
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(value) ? value : 0;
  }

  const maxTotal = series.length
    ? Math.max(...series.map((item) => getSeriesValue(item)))
    : 0;

  function formatLabel(value: string) {
    if (!value) return "";
    const date = new Date(value + "T00:00:00");
    if (Number.isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
  }

  const firstLabel = formatLabel(series[0]?.date ?? "");
  const midLabel = formatLabel(series[Math.floor(series.length / 2)]?.date ?? "");
  const lastLabel = formatLabel(series[series.length - 1]?.date ?? "");

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
          Administrador
        </div>
        <h1 className="text-3xl font-semibold">Backoffice</h1>
        <p className="text-sm text-zinc-300">
          Métricas generales y acceso a la gestión de cuentas.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/95">
          <div className="relative p-5">
            <div className="absolute right-5 top-5 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                Activos: {loading ? "..." : metrics?.active_users ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                Inactivos: {loading ? "..." : metrics?.inactive_users ?? 0}
              </span>
            </div>
            <div className="space-y-3 pt-10">
              <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                Usuarios
              </div>
              <div className="text-3xl font-semibold text-zinc-800">
                {loading ? "..." : metrics?.total_users ?? 0}
              </div>
              <div className="text-xs text-zinc-500">Total en plataforma</div>
            </div>
          </div>
        </Card>
        <Card className="bg-white/95">
          <div className="p-5 space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Facturado
            </div>
            <div className="text-3xl font-semibold text-zinc-800">
              {loading
                ? "..."
                : new Intl.NumberFormat("es-AR").format(
                    metrics?.total_revenue ?? 0
                  )}
            </div>
            <div className="text-xs text-zinc-500">Total cobrado (ARS)</div>
          </div>
        </Card>
        <Card className="bg-white/95">
          <div className="p-5 space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Costos AI
            </div>
            <div className="text-3xl font-semibold text-zinc-800">
              {loading
                ? "..."
                : new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  }).format(metrics?.ai_total_cost_usd ?? 0)}
            </div>
            <div className="text-xs text-zinc-500">Total acumulado (USD)</div>
          </div>
        </Card>
      </div>

      <Card className="bg-white/95">
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-semibold text-zinc-900">
              Pagos últimos 30 días
            </div>
          </div>

          {seriesLoading ? (
            <div className="text-sm text-zinc-600">Cargando gráfico...</div>
          ) : series.length === 0 ? (
            <div className="text-sm text-zinc-600">
              No hay pagos en los últimos 30 días.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1 h-40 items-end">
                {series.map((item) => {
                  const value = getSeriesValue(item);
                  const height = maxTotal ? (value / maxTotal) * 100 : 0;
                  const tooltipDate = formatLabel(item.date);
                  const formattedValue = new Intl.NumberFormat("es-AR").format(
                    value
                  );
                  return (
                    <div
                      key={item.date}
                      className="group relative flex-1 rounded-md bg-zinc-900/80 hover:bg-zinc-900"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    >
                      <div className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 opacity-0 shadow-sm transition group-hover:opacity-100">
                        {tooltipDate} · Total: ${formattedValue}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{firstLabel}</span>
                <span>{midLabel}</span>
                <span>{lastLabel}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

    </div>
  );
}
