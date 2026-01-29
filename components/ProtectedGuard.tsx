"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getIsAdmin, getToken } from "@/lib/auth";

export default function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const isAdmin = getIsAdmin();
    if (isAdmin && !pathname.startsWith("/admin")) {
      router.replace("/admin");
      return;
    }
    if (!isAdmin && pathname.startsWith("/admin")) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-zinc-600">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
