import "server-only";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import type { CrUsuario } from "@/lib/types/db";

const SESSION_COOKIE = "cr_server_session";
const SESSION_ISSUER = "carta-responsiva";
const SESSION_TTL = "8h";

function sessionSecret(): Uint8Array {
  const value = (
    process.env.CR_SESSION_SECRET ??
    process.env.PORTAL_HANDOFF_SECRET ??
    ""
  ).trim();
  if (!value) {
    throw new Error("CR_SESSION_SECRET or PORTAL_HANDOFF_SECRET is not configured");
  }
  return new TextEncoder().encode(value);
}

async function createSessionToken(user: CrUsuario): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(sessionSecret());
}

export async function attachServerSession(
  response: NextResponse,
  user: CrUsuario
): Promise<void> {
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function getServerSessionUser(): Promise<CrUsuario | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      issuer: SESSION_ISSUER,
    });
    const user = payload.user as CrUsuario | undefined;
    return user?.id && user.email
      ? { ...user, rol: "admin", nombre_completo: null }
      : null;
  } catch {
    return null;
  }
}

export function clearServerSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
