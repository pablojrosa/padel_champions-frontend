"use client";

import { useEffect, useMemo, useState } from "react";

type DemoStep = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  primaryAction: string;
  helper: string;
};

const STEPS: DemoStep[] = [
  {
    id: "import-pairs",
    title: "Carga de parejas desde archivo",
    subtitle: "Desde Resumen, usá Importar parejas y subí CSV/XLS/XLSX.",
    route: "/tournaments/:id (Resumen)",
    primaryAction: "Importar parejas",
    helper: "Tip: primero podés descargar el template.",
  },
  {
    id: "generate-groups-ia",
    title: "Generar zonas con IA",
    subtitle: "Definí ventanas horarias y confirmá la factibilidad antes de generar.",
    route: "/tournaments/:id (Resumen > Generar zonas con IA)",
    primaryAction: "Generar zonas ahora",
    helper: "El semáforo indica si hay slots suficientes para todos los partidos.",
  },
  {
    id: "start-tournament",
    title: "Iniciar torneo desde checklist",
    subtitle: "Con parejas y zonas listas, activá el torneo en el checklist.",
    route: "/tournaments/:id (Checklist para iniciar torneo)",
    primaryAction: "Iniciar torneo",
    helper: "Si un requisito falta, el botón permanece deshabilitado.",
  },
  {
    id: "share-link",
    title: "Compartir link público",
    subtitle: "Copiá el link desde Acciones del torneo para enviarlo al club/jugadores.",
    route: "/tournaments/:id (Resumen > Acciones del torneo)",
    primaryAction: "Copiar link publico",
    helper: "El viewer no requiere login.",
  },
];

const STEP_MS = 4200;

export default function TournamentFlowDemo() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % STEPS.length);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  const step = STEPS[index];
  const percent = useMemo(() => ((index + 1) / STEPS.length) * 100, [index]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Tutorial interactivo
            </div>
            <div className="text-base font-semibold text-zinc-900">
              Flujo completo: crear y lanzar torneo
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev - 1 + STEPS.length) % STEPS.length)}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPlaying((prev) => !prev)}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              {playing ? "Pausar" : "Reproducir"}
            </button>
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev + 1) % STEPS.length)}
              className="rounded-lg border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Siguiente
            </button>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span>{step.route}</span>
            <span>
              Paso {index + 1}/{STEPS.length}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className="text-sm font-semibold text-zinc-900">{step.title}</div>
            <div className="mt-1 text-sm text-zinc-600">{step.subtitle}</div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-600">
                {step.id === "import-pairs" && "Seccion Cargar parejas"}
                {step.id === "generate-groups-ia" && "Modal Generar zonas con IA"}
                {step.id === "start-tournament" && "Checklist para iniciar torneo"}
                {step.id === "share-link" && "Acciones del torneo"}
              </div>
              <button
                type="button"
                className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white"
              >
                {step.primaryAction}
              </button>
            </div>

            <div className="mt-2 text-xs text-zinc-500">{step.helper}</div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Usá Anterior/Siguiente para navegar los pasos.
        </div>
      </div>
    </div>
  );
}
