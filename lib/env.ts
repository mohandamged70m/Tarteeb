/** Fail closed at runtime. A credential-free build is allowed for CI only. */
export function productionConfigErrors(env: Record<string, string | undefined> = process.env): string[] {
  const errors: string[] = [];
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!env[key]?.trim()) errors.push(`${key} is required`);
  }
  if ((env.APP_SECRET?.trim().length ?? 0) < 32) errors.push("APP_SECRET must contain at least 32 characters");
  for (const key of ["APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    try {
      const url = new URL(env[key] ?? "");
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        errors.push(`${key} must be an HTTPS origin`);
      }
    } catch { errors.push(`${key} must be an HTTPS origin`); }
  }
  return errors;
}

export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (productionConfigErrors().length) throw new Error("Production configuration is incomplete. Run npm run check:env.");
}
