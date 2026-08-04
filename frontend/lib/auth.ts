"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeAccessUser } from "./access";
import type { CrUsuario } from "./types/db";
import {
  createSessionTimestamps,
  getSessionExpiryReason,
  useSessionTimeout,
  type SessionTimestamps,
} from "./session-timeout";

const SESSION_KEY = "cr_session";

type StoredSession = {
  user: CrUsuario;
  issuedAt: number;
  lastActivityAt: number;
};

function normalizeSessionUser(user: CrUsuario): CrUsuario {
  return normalizeAccessUser(user);
}

function getSessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function clearLegacySession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

function stripPassword(user: CrUsuario & { password?: string }): CrUsuario {
  if (user.password !== undefined) {
    const { password: _p, ...rest } = user;
    return normalizeSessionUser(rest as CrUsuario);
  }
  return normalizeSessionUser(user);
}

function parseStoredSession(
  raw: string
): { session: StoredSession; migrated: boolean } | null {
  try {
    const parsed = JSON.parse(raw) as
      | (CrUsuario & { password?: string })
      | (Partial<StoredSession> & { user?: CrUsuario & { password?: string } });

    if (
      parsed &&
      typeof parsed === "object" &&
      "user" in parsed &&
      parsed.user &&
      typeof (parsed as StoredSession).issuedAt === "number" &&
      typeof (parsed as StoredSession).lastActivityAt === "number"
    ) {
      const session = parsed as StoredSession;
      return {
        session: {
          user: stripPassword(session.user),
          issuedAt: session.issuedAt,
          lastActivityAt: session.lastActivityAt,
        },
        migrated: false,
      };
    }

    if (parsed && typeof parsed === "object" && "id" in parsed && "email" in parsed) {
      const timestamps = createSessionTimestamps();
      return {
        session: {
          user: stripPassword(parsed as CrUsuario & { password?: string }),
          ...timestamps,
        },
        migrated: true,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function writeSession(user: CrUsuario, timestamps: SessionTimestamps): void {
  const store = getSessionStore();
  if (!store) return;
  clearLegacySession();
  const payload: StoredSession = {
    user: normalizeSessionUser(user),
    ...timestamps,
  };
  store.setItem(SESSION_KEY, JSON.stringify(payload));
}

function clearSessionStore(): void {
  clearLegacySession();
  getSessionStore()?.removeItem(SESSION_KEY);
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
    const user = normalizeSessionUser(payload.user);
    writeSession(user, createSessionTimestamps());
    return { ok: true, user };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor de autenticación." };
  }
}

export function saveSessionUser(user: CrUsuario): void {
  const existing = getSessionTimestamps();
  writeSession(
    normalizeSessionUser(user),
    existing ?? createSessionTimestamps()
  );
}

export async function logout(): Promise<void> {
  clearSessionStore();
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Client session is already cleared; server cookie will expire naturally.
  }
}

export function getSessionTimestamps(): SessionTimestamps | null {
  const store = getSessionStore();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  const parsed = parseStoredSession(raw);
  if (!parsed) return null;
  return {
    issuedAt: parsed.session.issuedAt,
    lastActivityAt: parsed.session.lastActivityAt,
  };
}

export function setSessionTimestamps(timestamps: SessionTimestamps): void {
  const user = getCurrentUser({ skipExpiryCheck: true });
  if (!user) return;
  writeSession(user, timestamps);
}

export function getCurrentUser(options?: {
  skipExpiryCheck?: boolean;
}): CrUsuario | null {
  const store = getSessionStore();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;

  const parsed = parseStoredSession(raw);
  if (!parsed) {
    clearSessionStore();
    return null;
  }

  const { session, migrated } = parsed;

  if (!options?.skipExpiryCheck && getSessionExpiryReason(session)) {
    clearSessionStore();
    return null;
  }

  if (migrated) {
    writeSession(session.user, {
      issuedAt: session.issuedAt,
      lastActivityAt: session.lastActivityAt,
    });
  }

  return session.user;
}

export function useAuth(): { user: CrUsuario | null; loading: boolean } {
  const [user, setUser] = useState<CrUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  const expire = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  useEffect(() => {
    clearLegacySession();
    const local = getCurrentUser();
    if (local) setUser(local);

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin" });
        const payload = (await response.json()) as {
          ok?: boolean;
          user?: CrUsuario;
        };
        if (cancelled) return;
        if (response.ok && payload.ok && payload.user) {
          const synced = normalizeSessionUser(payload.user);
          saveSessionUser(synced);
          setUser(synced);
        } else if (!local) {
          setUser(null);
        }
      } catch {
        if (!cancelled && !local) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useSessionTimeout({
    enabled: Boolean(user),
    getTimestamps: getSessionTimestamps,
    setTimestamps: setSessionTimestamps,
    onExpire: () => {
      void expire();
    },
  });

  return { user, loading };
}
