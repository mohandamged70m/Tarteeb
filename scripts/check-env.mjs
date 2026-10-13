// Read local .env/.env.local without ever printing secret values.
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const env = process.env;
const errors = [];
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[key]?.trim()) errors.push(`${key} is required`);
}
if ((env.APP_SECRET?.trim().length ?? 0) < 32) errors.push("APP_SECRET must contain at least 32 characters");
for (const key of ["APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
  try {
    const url = new URL(env[key] ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) errors.push(`${key} must be an HTTPS origin`);
  } catch { errors.push(`${key} must be an HTTPS origin`); }
}
if (errors.length) {
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else console.log("Production environment configuration is valid. Verify migrations and email delivery before launch.");
