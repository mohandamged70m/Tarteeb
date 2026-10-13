import { NextResponse } from "next/server";
import { ZodType, ZodTypeDef } from "zod";

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function fail(
  code: string,
  message: string,
  opts: { status?: number; retryable?: boolean; fields?: unknown } = {}
): NextResponse {
  return NextResponse.json(
    { error: { code, message, retryable: opts.retryable ?? false, fields: opts.fields } },
    { status: opts.status ?? 400, headers: { "Cache-Control": "private, no-store" } }
  );
}

export function parseBody<Out, Def extends ZodTypeDef = ZodTypeDef, In = unknown>(
  schema: ZodType<Out, Def, In>,
  body: unknown
):
  | { ok: true; data: Out }
  | { ok: false; res: NextResponse } {
  const res = schema.safeParse(body);
  if (!res.success) {
    return {
      ok: false,
      res: fail("validation", "Invalid input.", {
        status: 400,
        fields: res.error.flatten().fieldErrors,
      }),
    };
  }
  return { ok: true, data: res.data };
}

export function httpStatus(e: unknown): number {
  if (typeof e === "object" && e !== null && "status" in e) {
    const s = (e as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return 500;
}
