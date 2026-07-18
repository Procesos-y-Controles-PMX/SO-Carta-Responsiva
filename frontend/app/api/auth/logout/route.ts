import { NextResponse } from "next/server";
import { clearServerSession } from "@/lib/server-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearServerSession(response);
  return response;
}
