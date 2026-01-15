"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import { clearToken } from "@/lib/auth";

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 md:px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="text-lg font-semibold tracking-wide text-zinc-800">
          Padel Champions
        </Link>
        <nav className="flex items-center gap-2 relative" ref={menuRef}>
          <Button
            variant="secondary"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            Mi cuenta
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                href="/profile"
                onClick={() => setMenuOpen(false)}
              >
                Club
              </Link>
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                href="/ayuda"
                onClick={() => setMenuOpen(false)}
              >
                Ayuda
              </Link>
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                href="/players"
                onClick={() => setMenuOpen(false)}
              >
                Players
              </Link>
              <Link
                className="block rounded-lg px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
                href="/tournaments"
                onClick={() => setMenuOpen(false)}
              >
                Tournaments
              </Link>
              <button
                type="button"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  clearToken();
                  router.replace("/");
                }}
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
