"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import TournamentFlowDemo from "@/components/help/TournamentFlowDemo";

const faqs: { question: string; answer: React.ReactNode[] }[] = [
  {
    question: "¿Como uso la navegacion Resumen / Partidos / Playoffs?",
    answer: [
      "Usá esas 3 pestañas como navegacion principal de gestion del torneo.",
      "Resumen: configuracion general, checklist y zonas.",
      "Partidos: programacion y carga de resultados.",
      "Playoffs: armado de llaves y seguimiento de etapas finales.",
    ],
  },
  {
    question: "¿Como cargo parejas rapido?",
    answer: [
      "Desde el detalle del torneo, sección Cargar parejas: Agregar pareja para carga manual.",
      "Tambien podés usar Importar parejas para subir archivo CSV/XLS/XLSX.",
      "Si necesitás formato, usá Descargar template antes de importar.",
    ],
  },
  {
    question: "¿Como generar zonas manualmente de forma correcta?",
    answer: [
      "Elegí Cantidad de zonas (1 a 20) y luego asigná parejas por grupo.",
      "Cada zona usada debe tener al menos 2 parejas y mantener misma categoria/genero.",
      "Al agregar parejas seleccionadas, el sistema te mueve a la siguiente zona vacia para agilizar la carga.",
    ],
  },
  {
    question: "¿Que valida el modal de Generar zonas con IA?",
    answer: [
      "Fechas y horarios completos por dia.",
      "Sin fechas repetidas ni rangos horarios invalidos.",
      "Factibilidad de agenda: slots disponibles vs partidos requeridos.",
      "Semaforo de capacidad (OK, Justo, Insuficiente) para decidir antes de generar.",
    ],
  },
  {
    question: "¿Por que a veces no me deja generar zonas nuevamente?",
    answer: [
      "Cuando ya está el 100% de zonas posibles generadas, el sistema bloquea una nueva generacion.",
      "En ese caso, podés continuar con Partidos o ajustar parejas moviendolas entre zonas existentes.",
    ],
  },
  {
    question: "¿Como inicio el torneo sin perder pasos importantes?",
    answer: [
      "Usá el Checklist para iniciar torneo dentro de Resumen.",
      "Requisitos minimos: al menos 1 pareja cargada y zonas generadas.",
      "Cuando Estado listo para iniciar esté en Listo, podés tocar Iniciar torneo.",
    ],
  },
  {
    question: "¿Como programo partidos y cargo resultados?",
    answer: [
      "Entrá a Partidos y usá las pestañas Faltan programar / Programados / Jugados.",
      "Programá fecha, hora y cancha para cada partido.",
      "Luego cargá sets para guardar el resultado y avanzar el torneo.",
    ],
  },
  {
    question: "¿Como funciona Playoffs?",
    answer: [
      "Podés generar instancias automaticamente cuando corresponde.",
      "Si hace falta, podés armar cruces manuales por instancia.",
      "También podés abrir la grilla para visualizar y planificar horarios.",
    ],
  },
  {
    question: "¿Donde quedaron las acciones sensibles como eliminar torneo?",
    answer: [
      "La accion Eliminar torneo está al final de la pantalla de Resumen.",
      "Vas a verla dentro de un bloque separado llamado Zona de peligro.",
      "Esto reduce clics accidentales y mejora la seguridad operativa.",
    ],
  },
  {
    question: "¿Como comparto el torneo y edito datos generales?",
    answer: [
      "En Resumen, en Acciones del torneo, podés usar Editar torneo y Copiar link publico.",
      "El link publico sirve para compartir el estado del torneo sin login.",
    ],
  },
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Centro de ayuda
            </div>
            <h1 className="text-3xl font-semibold">Ayuda</h1>
            <p className="text-sm text-zinc-400">
              Guia actualizada con el flujo real de gestion de torneos.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Volver al tablero
          </Link>
        </div>

        <Card className="mt-6 bg-white/95">
          <div className="p-5">
            <div className="text-sm font-semibold text-zinc-900">Atajos utiles</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/dashboard"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Ir a Dashboard
              </Link>
              <Link
                href="/tournaments"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Ir a Torneos
              </Link>
              <Link
                href="/players"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Ir a Jugadores
              </Link>
              <Link
                href="/soporte"
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Ir a Soporte
              </Link>
            </div>
          </div>
        </Card>

        <div className="mt-6">
          <TournamentFlowDemo />
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={faq.question} className="bg-white/95">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-3 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-zinc-900">
                    {faq.question}
                  </span>
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
                <div
                  className={`overflow-hidden px-5 transition-all ${
                    isOpen ? "max-h-[28rem] pb-5 opacity-100" : "max-h-0 pb-0 opacity-0"
                  }`}
                >
                  <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                    {faq.answer.map((item, answerIndex) => (
                      <li key={`${faq.question}-${answerIndex}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
