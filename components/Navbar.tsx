"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "./ui/Button";
import { clearToken } from "@/lib/auth";

export default function Navbar() {
  const router = useRouter();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 md:px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold">
          Padel Champions
        </Link>
        <nav className="flex items-center gap-2">
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/players">
            Players
          </Link>
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/tournaments">
            Tournaments
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              clearToken();
              router.replace("/login");
            }}
          >
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
