"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";

const SESSION_KEY = "cr_session";

function HandoffInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = searchParams.get("token");
    if (!token) {
      setError("Enlace de acceso incompleto. Inicia sesión de nuevo.");
      return;
    }

    (async () => {
      try {
        const response = await fetch("/api/auth/handoff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          user?: unknown;
          message?: string;
        };

        if (!response.ok || !payload.ok || !payload.user) {
          setError(payload.message ?? "No se pudo validar el acceso.");
          return;
        }

        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload.user));
        window.location.replace("/cartas");
      } catch {
        setError("No se pudo contactar al servidor.");
      }
    })();
  }, [searchParams]);

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      {error ? (
        <div className="w-full max-w-sm rounded-lg border border-red-200 bg-red-50 p-5 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
          <a
            href={portalUrl ? `${portalUrl}/login?app=carta-responsiva` : "/login"}
            className="btn-primary mt-4 inline-block"
          >
            Volver a iniciar sesión
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand"
            role="status"
            aria-label="Cargando"
          />
          <p className="text-sm text-slate-500">Entrando a Carta Responsiva...</p>
        </div>
      )}
    </main>
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <HandoffInner />
    </Suspense>
  );
}
