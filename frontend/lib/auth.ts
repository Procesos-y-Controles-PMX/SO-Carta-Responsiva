"use client";

import { useEffect, useState } from "react";
import type { CrUsuario } from "./types/db";

const SESSION_KEY = "cr_session";

function temporaryAdminUser(user: CrUsuario): CrUsuario {
  return { ...user, rol: "admin", nombre_completo: null };
}

function getSessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function clearLegacySession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export type LoginResult =
  | { ok: true; user: CrUsuario }
  | { ok: false; message: string };

export async function loginByEmailPassword(
  email: string,
  password: string
): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      user?: CrUsuario;
      message?: string;
    };

    if (!response.ok || !payload.ok || !payload.user) {
      return {
        ok: false,
        message: payload.message ?? "Credenciales inválidas o usuario inactivo.",
      };
    }

    const store = getSessionStore();
    if (!store) {
      return { ok: false, message: "No se pudo guardar la sesión en el navegador." };
    }
    clearLegacySession();
    const user = temporaryAdminUser(payload.user);
    store.setItem(SESSION_KEY, JSON.stringify(user));
    return { ok: true, user };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor de autenticación." };
  }
}

export function saveSessionUser(user: CrUsuario): void {
  clearLegacySession();
  getSessionStore()?.setItem(SESSION_KEY, JSON.stringify(temporaryAdminUser(user)));
}

export async function logout(): Promise<void> {
  clearLegacySession();
  getSessionStore()?.removeItem(SESSION_KEY);
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Client session is already cleared; server cookie will expire naturally.
  }
}

export function getCurrentUser(): CrUsuario | null {
  const store = getSessionStore();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CrUsuario & { password?: string };
    if (parsed.password !== undefined) {
      const { password: _p, ...user } = parsed;
      return temporaryAdminUser(user as CrUsuario);
    }
    return temporaryAdminUser(parsed);
  } catch {
    return null;
  }
}

export function useAuth(): { user: CrUsuario | null; loading: boolean } {
  const [user, setUser] = useState<CrUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clearLegacySession();
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  return { user, loading };
}

export function userCanAccessSucursal(user: CrUsuario, idSucursal: string): boolean {
  if (user.rol === "admin") return true;
  return user.id_sucursal === idSucursal;
}
