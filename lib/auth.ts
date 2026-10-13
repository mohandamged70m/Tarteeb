import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { ID } from "./types";
import { localRepo } from "./repo.local";
import { supabaseRepo } from "./repo.supabase";
import type { Repo } from "./repo";
import { isSupabaseConfigured, supabaseServer } from "./supabase";
import { assertProductionConfig } from "./env";

export function getRepo(): Repo {
  assertProductionConfig();
  return isSupabaseConfigured() ? supabaseRepo : localRepo;
}

export interface Session {
  userId: ID;
  email: string;
}

const DEV_COOKIE = "tarteeb_dev_session";

function devSecret(): string {
  if (process.env.NODE_ENV === "production") throw new Error("Development sessions are disabled in production");
  return process.env.APP_SECRET ?? "dev-insecure-secret-please-change-me-0000";
}

function sign(userId: string): string {
  return createHmac("sha256", devSecret()).update(userId).digest("hex");
}

/** Dev-backend session cookie value: userId.signature (HttpOnly). */
export function makeDevSession(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function parseDevSession(value: string | undefined): ID | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function hashDevPassword(pw: string): string {
  return createHash("sha256").update("dev::" + pw).digest("hex");
}

/** Resolve the current session on the server (both backends). Null = anonymous. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies(); // Opt out of prerendering before runtime-only config checks.
  assertProductionConfig();
  if (isSupabaseConfigured()) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    const user = data.user;
    if (!user?.email) return null;
    return { userId: user.id, email: user.email };
  }
  const userId = parseDevSession(store.get(DEV_COOKIE)?.value);
  if (!userId) return null;
  const profile = await localRepo.getProfile(userId);
  if (!profile) return null;
  return { userId, email: profile.email };
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) {
    const err = new Error("unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return s;
}

export { DEV_COOKIE };
