"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-20 mx-auto w-full max-w-6xl px-4 pt-6 md:px-8 md:pt-8">
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-3.5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link aria-label="Inicio" className="origin-left scale-[1.06] md:scale-100" href="/">
            <BrandLogo theme="dark" />
          </Link>

          <nav className="hidden items-center gap-3 text-sm md:flex">
            <Link className="whitespace-nowrap text-zinc-300 hover:text-white" href="/blog">
              Blog
            </Link>
            <Link className="whitespace-nowrap text-zinc-300 hover:text-white" href="/login">
              Ingresar
            </Link>
            <Link
              className="whitespace-nowrap rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/30"
              href="/register"
            >
              Comenzar ahora
            </Link>
          </nav>

          <button
            aria-controls="landing-mobile-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Cerrar menu" : "Abrir menu"}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-950/80 text-zinc-200 transition hover:border-zinc-500 md:hidden"
            onClick={() => setMenuOpen((prev) => !prev)}
            type="button"
          >
            <span className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
        </div>
      </div>
      <nav
        aria-hidden={!menuOpen}
        className={[
          "absolute left-4 right-4 top-full z-30 mt-2 grid gap-2 rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-xl shadow-black/50 md:hidden",
          "origin-top transition duration-200 ease-out",
          menuOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0",
        ].join(" ")}
        id="landing-mobile-menu"
      >
        <Link
          className="block rounded-xl border border-zinc-700 px-4 py-2.5 text-center text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
          href="/blog"
          onClick={() => setMenuOpen(false)}
        >
          Blog
        </Link>
        <Link
          className="block rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-zinc-900"
          href="/register"
          onClick={() => setMenuOpen(false)}
        >
          Comenzar ahora
        </Link>
        <Link
          className="block rounded-xl border border-zinc-700 px-4 py-2.5 text-center text-sm font-semibold text-zinc-200 hover:bg-zinc-900"
          href="/login"
          onClick={() => setMenuOpen(false)}
        >
          Ya tengo cuenta
        </Link>
      </nav>
    </header>
  );
}
