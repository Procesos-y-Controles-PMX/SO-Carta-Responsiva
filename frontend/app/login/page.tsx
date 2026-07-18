"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { loginByEmailPassword } from "@/lib/auth";

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (PORTAL_URL) window.location.replace(`${PORTAL_URL}/login?app=carta-responsiva`);
  }, []);

  if (PORTAL_URL) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div
          className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand"
          role="status"
          aria-label="Cargando"
        />
      </main>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const result = await loginByEmailPassword(email, password);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    toast.success("Acceso de administrador concedido.");
    router.replace("/cartas");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md card-panel p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Promexma</p>
          <h1 className="font-display mt-2 text-2xl font-semibold uppercase tracking-tight text-slate-900">
            Carta Responsiva
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Mercancía Abordo — generación de cartas responsivas.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Correo electrónico
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="usuario@promexma.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contraseña
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5">
              <AlertCircle size={15} className="shrink-0 text-red-500" />
              <p className="text-xs font-medium text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Verificando..." : "Acceder"}
          </button>
        </form>
      </div>
    </main>
  );
}
