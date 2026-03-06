"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

const faqs: { question: string; answer: React.ReactNode[] }[] = [
  {
    question: "¿Cómo uso la navegación Resumen / Partidos / Playoffs?",
    answer: [
      "Usa esas 3 pestañas como navegación principal de gestión del torneo.",
      "Resumen: configuración general, checklist y zonas.",
      "Partidos: programación y carga de resultados.",
      "Playoffs: armado de llaves y seguimiento de etapas finales.",
    ],
  },
  {
    question: "¿Cómo cargo parejas rápido?",
    answer: [
      "Desde el detalle del torneo, sección Cargar parejas: Agregar pareja para carga manual.",
      "Tambien podés usar Importar parejas para subir archivo CSV/XLS/XLSX.",
      "Si necesitás formato, usá Descargar template antes de importar.",
    ],
  },
  {
    question: "¿Cómo generar zonas manualmente de forma correcta?",
    answer: [
      "Elige Cantidad de zonas (1 a 20) y luego asigna parejas por grupo.",
      "Cada zona usada debe tener al menos 2 parejas y mantener misma categoría/género.",
      "Al agregar parejas seleccionadas, el sistema te mueve a la siguiente zona vacía para agilizar la carga.",
    ],
  },
  {
    question: "¿Qué valida el modal de Generar zonas con IA?",
    answer: [
      "Fechas y horarios completos por día.",
      "Sin fechas repetidas ni rangos horarios inválidos.",
      "Factibilidad de agenda: slots disponibles vs partidos requeridos.",
      "Semáforo de capacidad (OK, Justo, Insuficiente) para decidir antes de generar.",
    ],
  },
  {
    question: "¿Por qué a veces no me deja generar zonas nuevamente?",
    answer: [
      "Cuando ya está el 100% de zonas posibles generadas, el sistema bloquea una nueva generación.",
      "En ese caso, podés continuar con Partidos o ajustar parejas moviendolas entre zonas existentes.",
    ],
  },
  {
    question: "¿Cómo inicio el torneo sin perder pasos importantes?",
    answer: [
      "Usa el Checklist para iniciar torneo dentro de Resumen.",
      "Requisitos mínimos: al menos 1 pareja cargada y zonas generadas.",
      "Cuando Estado listo para iniciar esté en Listo, podés tocar Iniciar torneo.",
    ],
  },
  {
    question: "¿Cómo programo partidos y cargo resultados?",
    answer: [
      "Entra a Partidos y usa las pestañas Faltan programar / Programados / Jugados.",
      "Programa fecha, hora y cancha para cada partido.",
      "Luego carga sets para guardar el resultado y avanzar el torneo.",
    ],
  },
  {
    question: "¿Cómo funciona Playoffs?",
    answer: [
      "Puedes generar instancias automáticamente cuando corresponde.",
      "Si hace falta, puedes armar cruces manuales por instancia.",
      "Tambien puedes abrir la grilla para visualizar y planificar horarios.",
    ],
  },
  {
    question: "¿Dónde quedaron las acciones sensibles como eliminar torneo?",
    answer: [
      "La acción Eliminar torneo está al final de la pantalla de Resumen.",
      "Vas a verla dentro de un bloque separado llamado Zona de peligro.",
      "Esto reduce clics accidentales y mejora la seguridad operativa.",
    ],
  },
  {
    question: "¿Cómo comparto el torneo y edito datos generales?",
    answer: [
      "En Resumen, en Acciones del torneo, podés usar Editar torneo y Copiar link público.",
      "El link público sirve para compartir el estado del torneo sin login.",
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
              Preguntas frecuentes
            </div>
            <h1 className="text-3xl font-semibold">Preguntas frecuentes</h1>
            <p className="text-sm text-zinc-400">
              Guía actualizada con el flujo real de gestión de torneos.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Volver al tablero
          </Link>
        </div>

        <div className="mt-6 space-y-3">
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
