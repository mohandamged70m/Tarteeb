import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ client: vi.fn(), limiter: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.client }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.limiter }));
import { middleware } from "@/middleware";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  mocks.limiter.mockResolvedValue({ allowed: true, retryAfter: 60 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("accepts the browser's actual same-origin loopback Host and rejects cross-origin posts", async () => {
  const make = (origin: string) => new NextRequest("http://localhost:3110/api/auth/signup", { method: "POST", headers: { host: "127.0.0.1:3110", origin } });
  const allowed = await middleware(make("http://127.0.0.1:3110"));
  expect(allowed.headers.get("x-middleware-next")).toBe("1");
  expect((await middleware(make("https://attacker.example"))).status).toBe(403);
});
it("fails production closed instead of serving the development backend", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await middleware(new NextRequest("https://app.example/login"))).status).toBe(503);
});
it("propagates refreshed Supabase cookies to downstream pages and the response", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  mocks.client.mockImplementation((_url, _key, options) => ({ auth: { getUser: async () => {
    options.cookies.setAll([{ name: "sb-token", value: "refreshed", options: { path: "/", httpOnly: true } }]);
    return { data: { user: { id: "owner" } }, error: null };
  } } }));
  const req = new NextRequest("https://app.example/orders");
  const res = await middleware(req);
  expect(req.cookies.get("sb-token")?.value).toBe("refreshed");
  expect(res.cookies.get("sb-token")?.value).toBe("refreshed");
  expect(res.headers.get("cache-control")).toBe("private, no-store");
});
it("returns retry-after when the shared assistant bucket denies a request", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  mocks.client.mockReturnValue({ auth: { getUser: async () => ({ data: { user: { id: "owner" } }, error: null }) } });
  mocks.limiter.mockResolvedValue({ allowed: false, retryAfter: 40 });
  const res = await middleware(new NextRequest("https://app.example/api/intake/message", { method: "POST" }));
  expect(res.status).toBe(429);
  expect(res.headers.get("retry-after")).toBe("40");
});
