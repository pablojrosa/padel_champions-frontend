import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { getPublishedBlogPosts } from "@/lib/blogPosts";

const publishedPosts = getPublishedBlogPosts();

export const metadata: Metadata = {
  title: "Blog de gestion de torneos de padel para clubes | ProvoPadel",
  description:
    "Articulos sobre gestion de torneos de padel en clubes: inscripciones, parejas, horarios, canchas, resultados y operacion en tiempo real.",
  keywords: [
    "gestion de torneos de padel",
    "organizar torneo de padel",
    "software para torneos de padel",
    "club de padel",
    "inscripciones de parejas",
    "coordinacion de canchas y horarios",
  ],
  alternates: {
    canonical: "/blog",
  },
  openGraph: {
    title: "Blog de gestion de torneos de padel para clubes",
    description:
      "Buenas practicas para organizar torneos de padel en clubes sin caos operativo.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogIndexPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-blobs blob-1 absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="ambient-blobs blob-2 absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="ambient-blobs blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <Link href="/" aria-label="Inicio">
          <BrandLogo theme="dark" />
        </Link>
        <Link className="text-sm text-zinc-300 hover:text-white" href="/">
          Volver al inicio
        </Link>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 pt-4 md:px-8">
        <span className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
          Blog para clubes
        </span>
        <h1 className="mt-4 text-3xl font-semibold leading-tight md:text-5xl">
          Blog de gestion de torneos de padel
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-zinc-300 md:text-base">
          Contenido practico para organizar torneos de padel con menos mensajes,
          menos errores y mejor experiencia para jugadores y clubes.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {publishedPosts.map((post) => (
            <article
              key={post.slug}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-black/30"
            >
              {post.coverImageSrc ? (
                <div className="border-b border-zinc-800 bg-zinc-900/60">
                  <Image
                    alt={post.coverImageAlt ?? post.title}
                    className="h-44 w-full object-cover"
                    height={600}
                    src={post.coverImageSrc}
                    width={1200}
                  />
                </div>
              ) : null}
              <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                <span className="text-emerald-300/80">{post.tag}</span>
                <span className="text-zinc-700">•</span>
                <span>{post.date}</span>
                <span className="text-zinc-700">•</span>
                <span>{post.readTime}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-zinc-100">{post.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{post.excerpt}</p>
              <Link
                className="mt-4 inline-flex rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-emerald-400/40 hover:text-emerald-200"
                href={`/blog/${post.slug}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Leer articulo
              </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
