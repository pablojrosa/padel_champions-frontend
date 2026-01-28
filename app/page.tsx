import Link from "next/link";
import { blogPostSummaries } from "@/lib/blogPosts";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-blobs blob-1 absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="ambient-blobs blob-2 absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="ambient-blobs blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <div className="text-lg font-semibold tracking-wide">Padel Champions</div>
        <nav className="flex items-center gap-3 text-sm">
          <Link className="text-zinc-300 hover:text-white" href="/login">
            Ingresar
          </Link>
          <Link
            className="rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30"
            href="/register"
          >
            Comenzar ahora
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
            Organizar un torneo dejó de ser un caos
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Gestiona tus torneos de padel con grupos, parejas y partidos.
          </h1>
          <p className="text-base text-zinc-300 md:text-lg">
            Con Padel Champions creas torneos, cargar parejas, generar los grupos y
            programas partidos en minutos.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-emerald-400"
              href="/register"
            >
              Comenzar ahora
            </Link>
            <Link
              className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
              href="/login"
            >
              Ya tengo cuenta
            </Link>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
            <div>
              <div className="text-lg font-semibold text-white">15 min</div>
              Crear y publicar el torneo
            </div>
            <div>
              <div className="text-lg font-semibold text-white">0 planillas</div>
              Todo en una sola vista
            </div>
            <div>
              <div className="text-lg font-semibold text-white">+1</div>
              Programacion simple
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-6 shadow-2xl shadow-black/40">
          <div className="space-y-5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
              Torneo en vivo
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                En curso
              </span>
            </div>
            <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 transition duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-black/30">
              <div className="text-sm font-semibold text-zinc-100">Zonas y posiciones</div>
              <div className="grid gap-2 text-xs text-zinc-400">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  Zona A · 6 equipos · 3 partidos restantes
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  Zona B · 6 equipos · 1 partido en curso
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 transition duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:bg-zinc-900/90 hover:shadow-lg hover:shadow-black/30">
              <div className="text-sm font-semibold text-zinc-100">Programacion de partidos</div>
              <div className="grid gap-2 text-xs text-zinc-400">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  17/01 · 18:00 · Cancha 2
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                  17/01 · 19:00 · Cancha 3
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-500 transition duration-300 hover:border-emerald-400/40 hover:text-emerald-200">
              Programa partidos en segundos con fecha, hora y cancha.
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Zonas y playoffs claros",
              body: "Generá grupos, cargá resultados y seguí la tabla de posiciones en tiempo real.",
            },
            {
              title: "Parejas en un click",
              body: "Cargá dos jugadores, guardá la pareja y empezá a organizar el torneo.",
            },
            {
              title: "Vista pública para jugadores",
              body: "Compartí un link donde los jugadores ven rivales, resultados y progreso sin registrarse.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-black/30"
            >
              <div className="text-base font-semibold text-zinc-100">{card.title}</div>
              <p className="mt-2 text-sm text-zinc-400">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-[0.3em] text-emerald-300/70">
              Blog
            </span>
            <h2 className="text-2xl font-semibold md:text-3xl">
              Ideas y tips para jugadores de padel
            </h2>
            <p className="text-sm text-zinc-400 md:text-base">
              Articulos, tacticas y guias para elevar el nivel del torneo.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {blogPostSummaries.map((post) => (
            <article
              key={post.slug}
              className="flex h-full flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-black/30"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
                  <span>{post.tag}</span>
                  <span className="text-zinc-700">•</span>
                  <span>{post.date}</span>
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">{post.title}</h3>
                <p className="text-sm text-zinc-400">{post.excerpt}</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
                <span>{post.readTime} lectura</span>
                {post.isPublished ? (
                  <Link
                    className="text-emerald-300 hover:text-emerald-200"
                    href={`/blog/${post.slug}`}
                  >
                    Ver articulo
                  </Link>
                ) : (
                  <span className="text-zinc-500">En preparacion</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 md:px-8">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
          <h2 className="text-2xl font-semibold">Listo para organizar tu proximo torneo?</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Crea tu cuenta y arma el torneo con parejas, zonas y partidos en minutos.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-emerald-400"
              href="/register"
            >
              Comenzar ahora
            </Link>
            <Link
              className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
              href="/login"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
