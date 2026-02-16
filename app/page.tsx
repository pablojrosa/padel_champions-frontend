import Image from "next/image";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import { getPublishedBlogPosts } from "@/lib/blogPosts";

const quarterfinalMatches = [
  {
    id: "qf-1",
    pairs: ["Agustín Tapia & Arturo Coello", "Javi Garrido & Lucas Bergamini"],
    winnerIndex: 0,
    delay: "0.2s",
  },
  {
    id: "qf-2",
    pairs: ["Ale Galán & Federico Chingotto", "Coki Nieto & Jon Sanz"],
    winnerIndex: 0,
    delay: "1s",
  },
  {
    id: "qf-3",
    pairs: ["Franco Stupaczuk & Mike Yanguas", "Juan Lebrón & Leo Augsburger"],
    winnerIndex: 0,
    delay: "1.8s",
  },
  {
    id: "qf-4",
    pairs: ["Paquito Navarro & Fran Guerrero", "Momo González & Martín Di Nenno"],
    winnerIndex: 1,
    delay: "2.6s",
  },
];

const semifinalMatches = [
  {
    id: "sf-1",
    pairs: ["Agustín Tapia & Arturo Coello", "Ale Galán & Federico Chingotto"],
    winnerIndex: 0,
    delay: "3.4s",
  },
  {
    id: "sf-2",
    pairs: ["Franco Stupaczuk & Mike Yanguas", "Momo González & Martín Di Nenno"],
    winnerIndex: 0,
    delay: "4.2s",
  },
];

const finalMatch = {
  pairs: ["Agustín Tapia & Arturo Coello", "Franco Stupaczuk & Mike Yanguas"],
  winnerIndex: 0,
  delay: "5s",
};

const quarterfinalTops = [44, 162, 280, 398];
const semifinalTops = [103, 339];
const finalTop = 221;
const featuredBlogPosts = getPublishedBlogPosts().slice(0, 3);
const demoVideoEmbedUrl = "https://www.youtube-nocookie.com/embed/UCb0Px29TDs";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-blobs blob-1 absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="ambient-blobs blob-2 absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="ambient-blobs blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      <LandingHeader />

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8 md:pt-10">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-400">
            Organizar los mejores torneos.
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Gestioná tus torneos de pádel <span className="text-emerald-400">como nadie</span>.
          </h1>
          <p className="text-base text-zinc-300 md:text-lg">
          Planillas impresas, WhatsApp explotado, resultados a mano. No va más. <br />
          <span className="text-emerald-400">Organizá como un profesional.</span>
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
              <div className="text-lg font-semibold text-white">En minutos</div>
              Tu torneo está listo y <br />publicado
            </div>
            <div>
              <div className="text-lg font-semibold text-white">En segundos</div>
              Armá las zonas.
            </div>
            <div>
              <div className="text-lg font-semibold text-white">En 1 click</div>
              Para compartir el torneo <br />con los jugadores.
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
              <div className="text-sm font-semibold text-zinc-100">Programación de partidos</div>
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
              Programá partidos en segundos con fecha, hora y cancha.
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30 md:p-8">
          <div className="mb-5 space-y-2">
            <span className="text-sm font-semibold text-emerald-300/90">
              Demo en video
            </span>
            <h2 className="text-2xl font-semibold md:text-3xl">
              Mira como se usa ProvoPadel en minutos
            </h2>
            <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
              Un recorrido rapido de como crear torneos, gestionar resultados y compartir toda la informacion con los jugadores.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 shadow-xl shadow-black/30">
            <div className="aspect-video">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={demoVideoEmbedUrl}
                title="Demo de ProvoPadel en YouTube"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Armar las zonas sin dolor de cabeza",
              body: "Sabemos que programar los partidos es un infierno. Por eso lo hacemos por vos.",
            },
            {
              title: "Grilla de partidos en segundos",
              body: "Todos los partidos se generan automáticamente. Solo cargas los resultados y listo.",
            },
            {
              title: "Que te exploten el WhatsApp del club?",
              body: "Nunca mas, Solo compartís el link con la info del torneo a los jugadores. ",
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
        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-6 shadow-2xl shadow-black/30 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-emerald-300/90">
                Se acabó responder mensajes de WhatsApp.
              </span>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Esto ven los jugadores.
              </h2>
              <p className="max-w-2xl text-sm text-zinc-400 md:text-base">
                Solo actualizar los resultados y automáticamente los resultados se actualizan en la grilla.
              </p>
            </div>
          </div>

          <div className="mt-8 md:hidden">
            <div className="rounded-2xl border border-zinc-800/90 bg-zinc-950/75 p-4">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Cuartos</p>
                  <div className="space-y-3">
                    {quarterfinalMatches.map((match) => (
                      <article
                        key={`mobile-${match.id}`}
                        className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3"
                      >
                        <div className="space-y-2 text-xs">
                          {match.pairs.map((pair, index) => (
                            <div
                              key={`mobile-${match.id}-${pair}`}
                              className={
                                index === match.winnerIndex
                                  ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                                  : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                              }
                              style={
                                index === match.winnerIndex
                                  ? { animationDelay: match.delay }
                                  : undefined
                              }
                            >
                              <span>{pair}</span>
                              {index === match.winnerIndex ? (
                                <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                                  Avanza
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Semis</p>
                  <div className="space-y-3">
                    {semifinalMatches.map((match) => (
                      <article
                        key={`mobile-${match.id}`}
                        className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3"
                      >
                        <div className="space-y-2 text-xs">
                          {match.pairs.map((pair, index) => (
                            <div
                              key={`mobile-${match.id}-${pair}`}
                              className={
                                index === match.winnerIndex
                                  ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                                  : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                              }
                              style={
                                index === match.winnerIndex
                                  ? { animationDelay: match.delay }
                                  : undefined
                              }
                            >
                              <span>{pair}</span>
                              {index === match.winnerIndex ? (
                                <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                                  Avanza
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Final</p>
                  <article className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3">
                    <div className="space-y-2 text-xs">
                      {finalMatch.pairs.map((pair, index) => (
                        <div
                          key={`mobile-final-${pair}`}
                          className={
                            index === finalMatch.winnerIndex
                              ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                              : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                          }
                          style={
                            index === finalMatch.winnerIndex
                              ? { animationDelay: finalMatch.delay }
                              : undefined
                          }
                        >
                          <span>{pair}</span>
                          {index === finalMatch.winnerIndex ? (
                            <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                              Gana
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="bracket-champion mt-3 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-100">
                      Campeones: Agustín Tapia & Arturo Coello
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 hidden overflow-x-auto pb-2 md:block">
            <div className="relative h-[520px] min-w-[980px] rounded-2xl border border-zinc-800/90 bg-zinc-950/75 p-4">
              <p className="absolute left-6 top-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Cuartos
              </p>
              <p className="absolute left-[366px] top-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Semis
              </p>
              <p className="absolute left-[706px] top-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Final
              </p>

              {quarterfinalMatches.map((match, matchIndex) => (
                <article
                  key={match.id}
                  className="absolute left-6 w-[280px] rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3"
                  style={{ top: quarterfinalTops[matchIndex] }}
                >
                  <div className="space-y-2 text-xs">
                    {match.pairs.map((pair, index) => (
                      <div
                        key={pair}
                        className={
                          index === match.winnerIndex
                            ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                            : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                        }
                        style={
                          index === match.winnerIndex
                            ? { animationDelay: match.delay }
                            : undefined
                        }
                      >
                        <span>{pair}</span>
                        {index === match.winnerIndex ? (
                          <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                            Avanza
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}

              {semifinalMatches.map((match, matchIndex) => (
                <article
                  key={match.id}
                  className="absolute left-[366px] w-[280px] rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3"
                  style={{ top: semifinalTops[matchIndex] }}
                >
                  <div className="space-y-2 text-xs">
                    {match.pairs.map((pair, index) => (
                      <div
                        key={pair}
                        className={
                          index === match.winnerIndex
                            ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                            : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                        }
                        style={
                          index === match.winnerIndex
                            ? { animationDelay: match.delay }
                            : undefined
                        }
                      >
                        <span>{pair}</span>
                        {index === match.winnerIndex ? (
                          <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                            Avanza
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </article>
              ))}

              <article
                className="absolute left-[706px] w-[252px] rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-3"
                style={{ top: finalTop }}
              >
                <div className="space-y-2 text-xs">
                  {finalMatch.pairs.map((pair, index) => (
                    <div
                      key={pair}
                      className={
                        index === finalMatch.winnerIndex
                          ? "bracket-winner flex h-9 items-center justify-between rounded-md border border-zinc-700/80 px-3 text-zinc-100"
                          : "flex h-9 items-center justify-between rounded-md border border-zinc-800 bg-zinc-900/70 px-3 text-zinc-400"
                      }
                      style={
                        index === finalMatch.winnerIndex
                          ? { animationDelay: finalMatch.delay }
                          : undefined
                      }
                    >
                      <span>{pair}</span>
                      {index === finalMatch.winnerIndex ? (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-200">
                          Gana
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="bracket-champion mt-3 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-100">
                  Campeones: Agustín Tapia & Arturo Coello
                </div>
              </article>

              <div className="bracket-line absolute left-[304px] top-[90px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[304px] top-[208px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[334px] top-[90px] h-[118px] w-px" />
              <div
                className="bracket-line bracket-line-active absolute left-[334px] top-[149px] h-px w-[32px]"
                style={{ animationDelay: "3.4s" }}
              />
              <div className="bracket-node absolute left-[331px] top-[146px]" />

              <div className="bracket-line absolute left-[304px] top-[326px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[304px] top-[444px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[334px] top-[326px] h-[118px] w-px" />
              <div
                className="bracket-line bracket-line-active absolute left-[334px] top-[385px] h-px w-[32px]"
                style={{ animationDelay: "4.2s" }}
              />
              <div className="bracket-node absolute left-[331px] top-[382px]" />

              <div className="bracket-line absolute left-[646px] top-[149px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[646px] top-[385px] h-px w-[30px]" />
              <div className="bracket-line absolute left-[676px] top-[149px] h-[236px] w-px" />
              <div
                className="bracket-line bracket-line-active absolute left-[676px] top-[267px] h-px w-[30px]"
                style={{ animationDelay: "5s" }}
              />
              <div className="bracket-node absolute left-[673px] top-[264px]" />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 md:px-8">
        <div className="mb-16 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-emerald-300/90">
                Blog para clubes de padel
              </span>
              <h2 className="text-2xl font-semibold md:text-3xl">
                Gestion de torneos de padel: guias reales para el dia a dia
              </h2>
              <p className="max-w-3xl text-sm text-zinc-400 md:text-base">
                Estrategias concretas para anunciar torneos, anotar parejas,
                coordinar horarios y canchas, y responder consultas sin que el
                WhatsApp del club colapse.
              </p>
            </div>
            <Link
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
              href="/blog"
            >
              Ver todos los articulos
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {featuredBlogPosts.map((post) => (
              <article
                key={post.slug}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 transition duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:shadow-lg hover:shadow-black/30"
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
                <h3 className="mt-3 text-lg font-semibold text-zinc-100">
                  {post.title}
                </h3>
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
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
          <h2 className="text-2xl font-semibold">Empezá tu torneo ahora</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Creá tu cuenta y armá tu primer torneo con parejas, grupos y partidos en minutos.
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
