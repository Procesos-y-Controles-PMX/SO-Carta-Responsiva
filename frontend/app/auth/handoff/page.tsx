"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { GridLoadingScreen, NoiseField } from "@promexma/ui";

const SESSION_KEY = "cr_session";
const ENTERING = "Entrando a SO Cartas Responsivas...";

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

        const now = Date.now();
        window.sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            user: payload.user,
            issuedAt: now,
            lastActivityAt: now,
          })
        );
        window.location.replace("/cartas");
      } catch {
        setError("No se pudo contactar al servidor.");
      }
    })();
  }, [searchParams]);

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;

  if (error) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0d1117] px-6">
        <NoiseField
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_90%_80%_at_50%_40%,white,transparent)]"
        />
        <div className="relative z-10 w-full max-w-sm rounded-lg border border-red-500/30 bg-red-950/80 p-5 text-center backdrop-blur-sm">
          <AlertCircle aria-hidden="true" className="mx-auto mb-2 h-6 w-6 text-red-400" />
          <p className="text-sm text-red-200">{error}</p>
          <a
            href={portalUrl ? `${portalUrl}/login?app=carta-responsiva` : "/login"}
            className="btn-primary mt-4 inline-block"
          >
            Volver a iniciar sesión
          </a>
        </div>
      </main>
    );
  }

  return <GridLoadingScreen message={ENTERING} variant="dark" />;
}

export default function HandoffPage() {
  return (
    <Suspense fallback={<GridLoadingScreen message={ENTERING} variant="dark" />}>
      <HandoffInner />
    </Suspense>
  );
}
