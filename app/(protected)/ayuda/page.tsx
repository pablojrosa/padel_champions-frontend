"use client";

import { useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";

const faqs: { question: string; answer: React.ReactNode[] }[] = [
  {
    question: "¿Como empiezo a usar la app?",
    answer: [
      <>
        👤 Creá tu cuenta desde{" "}
        <Link className="text-zinc-900 underline" href="/register">
          /register
        </Link>{" "}
        y luego ingresá en{" "}
        <Link className="text-zinc-900 underline" href="/login">
          /login
        </Link>
        .
      </>,
      "🏆 Entrá a Torneos para crear tu primer torneo.",
    ],
  },
  {
    question: "¿Como cargo parejas?",
    answer: [
      "👥 En el detalle del torneo, tocá “Agregar pareja”.",
      "✍️ Cargá nombre, apellido y categoría de ambos jugadores.",
      "✅ Guardar y confirmar que la pareja aparece en la lista.",
    ],
  },
  {
    question: "¿Como creo un torneo?",
    answer: [
      "🧭 Ir a Torneos y completar los datos básicos.",
      "📌 Guardar y abrir el detalle del torneo.",
    ],
  },
  {
    question: "¿Como genero zonas?",
    answer: [
      "🧩 Definí equipos por zona y generá grupos automáticamente.",
      "↔️ Si hace falta, mové equipos entre zonas.",
    ],
  },
  {
    question: "¿Como inicio el torneo?",
    answer: [
      "✅ Verificá que existan equipos y zonas.",
      "▶️ Presioná “Iniciar torneo”.",
      "📣 Se habilita la carga de resultados.",
    ],
  },
  {
    question: "¿Como cargo resultados?",
    answer: [
      "🧾 Entrá a Partidos y buscá la pestaña Programados.",
      "🗓️ Si falta, programá el partido con fecha y hora.",
      "🏁 Cargá los sets y guardá el resultado.",
    ],
  },
  {
    question: "¿Como comparto el torneo con jugadores?",
    answer: [
      "🔗 Usá “Copiar link público” desde el detalle del torneo.",
      "🌐 La vista pública no requiere registro.",
    ],
  },
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Ayuda</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Guía rápida para empezar a organizar torneos.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
          >
            Volver
          </Link>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={faq.question}>
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
                    isOpen ? "max-h-64 pb-5 opacity-100" : "max-h-0 pb-0 opacity-0"
                  }`}
                >
                  <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
                    {faq.answer.map((item) => (
                      <li key={String(item)}>{item}</li>
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
