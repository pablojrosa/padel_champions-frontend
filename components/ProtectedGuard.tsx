"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getIsAdmin, getToken } from "@/lib/auth";

export default function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const redirectPath = useMemo(() => {
    const token = getToken();
    if (!token) {
      return `/login?next=${encodeURIComponent(pathname)}`;
    }

    const isAdmin = getIsAdmin();
    if (isAdmin && !pathname.startsWith("/admin")) {
      return "/admin";
    }
    if (!isAdmin && pathname.startsWith("/admin")) {
      return "/dashboard";
    }

    return null;
  }, [pathname]);

  useEffect(() => {
    if (!redirectPath) return;
    router.replace(redirectPath);
  }, [redirectPath, router]);

  if (redirectPath) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-sm text-zinc-600">Cargando...</div>
      </div>
    );
  }

  return <>{children}</>;
}
