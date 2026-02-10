import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPost } from "@/lib/blogPosts";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="ambient-blobs blob-1 absolute -left-32 top-20 h-72 w-72 rounded-full bg-emerald-500/25 blur-[120px]" />
        <div className="ambient-blobs blob-2 absolute right-0 top-0 h-96 w-96 rounded-full bg-amber-400/15 blur-[140px]" />
        <div className="ambient-blobs blob-3 absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-6 md:px-8">
        <Link className="text-lg font-semibold tracking-wide" href="/">
          provopadel.com
        </Link>
        <Link className="text-sm text-zinc-300 hover:text-white" href="/">
          Volver al inicio
        </Link>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-4xl space-y-6 px-4 pb-10 pt-4 md:px-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-zinc-500">
            <span className="text-emerald-300/80">{post.tag}</span>
            <span className="text-zinc-700">•</span>
            <span>{post.date}</span>
            <span className="text-zinc-700">•</span>
            <span>{post.readTime} lectura</span>
          </div>
          <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
            {post.title}
          </h1>
          <p className="text-base text-zinc-300 md:text-lg">{post.excerpt}</p>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-4xl space-y-8 px-4 pb-16 md:px-8">
        {post.sections.map((section) => (
          <article
            key={section.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
          >
            <h2 className="text-xl font-semibold text-zinc-100">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="mt-3 text-sm text-zinc-300">
                {paragraph}
              </p>
            ))}
            {section.bullets ? (
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                {section.bullets.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400/80" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
