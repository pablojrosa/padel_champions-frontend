"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { api } from "@/lib/api";
import { resolvePostAuthPath, setToken } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

type Mode = "login" | "register";

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            ux_mode?: "popup";
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

export default function GoogleAuthButton({
  mode,
  nextPath,
}: {
  mode: Mode;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    if (!clientId || !scriptReady || !buttonRef.current) return;

    const googleId = window.google?.accounts?.id;
    if (!googleId) return;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      if (submittingRef.current) return;
      if (!response.credential) {
        setError("No se pudo iniciar con Google.");
        return;
      }

      submittingRef.current = true;
      setError(null);

      try {
        const data = await api<LoginResponse>("/auth/google", {
          method: "POST",
          body: { credential: response.credential },
          auth: false,
        });
        const isAdmin = Boolean(data.is_admin);
        setToken(data.access_token, isAdmin);
        router.replace(resolvePostAuthPath(isAdmin, nextPath));
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "No se pudo iniciar con Google."
        );
      } finally {
        submittingRef.current = false;
      }
    };

    buttonRef.current.innerHTML = "";
    googleId.initialize({
      client_id: clientId,
      callback: handleCredential,
      ux_mode: "popup",
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleId.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text: mode === "register" ? "signup_with" : "signin_with",
      logo_alignment: "left",
      width: Math.max(
        240,
        Math.min(400, Math.round(buttonRef.current.offsetWidth || 320))
      ),
    });

    return () => {
      googleId.cancel?.();
    };
  }, [clientId, mode, nextPath, router, scriptReady]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() => setError("No se pudo cargar Google.")}
      />

      <div className="space-y-2">
        <div
          ref={buttonRef}
          className="flex min-h-11 w-full items-center justify-center"
        />
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
