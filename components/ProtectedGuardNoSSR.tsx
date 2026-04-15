"use client";

import dynamic from "next/dynamic";

const ProtectedGuard = dynamic(() => import("@/components/ProtectedGuard"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen grid place-items-center">
      <div className="text-sm text-zinc-600">Cargando...</div>
    </div>
  ),
});

export default ProtectedGuard;
