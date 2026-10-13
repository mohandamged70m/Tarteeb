import { createClient } from "@supabase/supabase-js";

const devBuckets = new Map<string, { count: number; expires: number }>();

/** Database-atomic buckets work across serverless instances; memory is dev-only. */
export async function consumeRateLimit(identity: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const window = Math.floor(now / (windowSeconds * 1000));
  const bytes = new TextEncoder().encode(`${process.env.APP_SECRET ?? "dev"}:${identity}:${windowSeconds}:${window}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const key = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const expires = (window + 1) * windowSeconds * 1000;
  const retryAfter = Math.max(1, Math.ceil((expires - now) / 1000));
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.rpc("consume_rate_limit", { p_key: key, p_limit: limit, p_expires_at: new Date(expires).toISOString() });
    if (error) throw new Error("Rate limiter unavailable");
    return { allowed: data === true, retryAfter };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Production rate limiter unavailable");
  for (const [k, v] of devBuckets) if (v.expires <= now) devBuckets.delete(k);
  const bucket = devBuckets.get(key) ?? { count: 0, expires };
  bucket.count++;
  devBuckets.set(key, bucket);
  return { allowed: bucket.count <= limit, retryAfter };
}
