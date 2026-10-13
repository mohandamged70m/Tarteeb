import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const a = randomUUID();
const b = randomUUID();
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  await db.exec(readFileSync("supabase/migrations/0001_init.sql", "utf8"));
  // Supabase's default grants are reproduced before the hardening migration.
  await db.exec("grant all on all tables in schema public to anon, authenticated, service_role;");
  await db.exec(readFileSync("supabase/migrations/0002_public_launch.sql", "utf8"));
  await db.query("insert into auth.users(id,email) values ($1,'a@example.com'),($2,'b@example.com')", [a, b]);
}, 30000);
afterAll(() => db.close());

async function intake(user = a) {
  const conv = randomUUID(); const prop = randomUUID();
  await db.query("insert into conversations(id,user_id) values ($1,$2)", [conv, user]);
  await db.query("insert into proposals(id,user_id,conversation_id,payload,status) values ($1,$2,$3,'{}','ready')", [prop, user, conv]);
  return { conv, prop };
}
async function confirm(conv: string, prop: string, key = randomUUID(), user = a, client: string | null = null) {
  return db.query<{ id: string; created: boolean }>(`select * from confirm_intake(
    $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,null,'Landing page',null,
    '{}'::text[],'{}'::text[],null,null,'UTC',null,null,
    '[{"title":"Build","is_client_requirement":true}]'::jsonb)`, [user, conv, prop, key, client]);
}

// These execute the production SQL, rather than testing only the development store.
describe("production database boundaries", () => {
  it("denies anonymous and authenticated callers access to privileged RPCs", async () => {
    const { conv, prop } = await intake();
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      try {
        await expect(confirm(conv, prop)).rejects.toThrow(/permission denied/);
        await expect(db.query("select consume_rate_limit('forged',10,now() + interval '1 minute')")).rejects.toThrow(/permission denied/);
        await expect(db.query("select create_order_manual($1::uuid,'{}'::jsonb)", [a])).rejects.toThrow(/permission denied/);
      } finally { await db.exec("reset role"); }
    }
  });
  it("service role confirms atomically and retries return the same order, even with a fresh key", async () => {
    const { conv, prop } = await intake(); const key = randomUUID();
    await db.exec("set role service_role");
    try {
      const first = (await confirm(conv, prop, key)).rows[0];
      expect(first.created).toBe(true);
      expect((await confirm(conv, prop, key)).rows[0]).toMatchObject({ id: first.id, created: false });
      expect((await confirm(conv, prop)).rows[0]).toMatchObject({ id: first.id, created: false });
      expect((await db.query("select * from order_tasks where order_id = $1", [first.id])).rows).toHaveLength(1);
    } finally { await db.exec("reset role"); }
  });
  it("rejects proposals from a different conversation and cross-user clients", async () => {
    const x = await intake(); const y = await intake();
    await expect(confirm(x.conv, y.prop)).rejects.toThrow(/proposal not owned by conversation/);
    const client = randomUUID();
    await db.query("insert into clients(id,user_id,name) values ($1,$2,'Private client')", [client, b]);
    await expect(confirm(x.conv, x.prop, randomUUID(), a, client)).rejects.toThrow(/client not owned/);
    await expect(confirm(x.conv, x.prop, randomUUID(), b)).rejects.toThrow(/conversation not owned/);
  });
  it("rejects reuse of a confirmation key for another intake", async () => {
    const x = await intake(); const y = await intake(); const key = randomUUID();
    await confirm(x.conv, x.prop, key);
    await expect(confirm(y.conv, y.prop, key)).rejects.toThrow(/key belongs to another intake/);
  });
  it("blocks direct browser writes and hides other owners via RLS", async () => {
    await db.exec(`set request.jwt.claim.sub = '${a}'; set role authenticated;`);
    try {
      const rows = (await db.query<{ user_id: string }>("select user_id from orders")).rows;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.user_id === a)).toBe(true);
      await expect(db.query("insert into clients(user_id,name) values ($1,'Bypass')", [a])).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from ai_settings")).rejects.toThrow(/permission denied/);
    } finally { await db.exec("reset role"); }
  });
  it("rolls back a manual order when its checklist insert fails", async () => {
    const before = (await db.query("select * from orders")).rows.length;
    await expect(db.query("select create_order_manual($1,$2)", [a, { title: "Broken manual", tasks: [{ title: null }] }])).rejects.toThrow(/null value/);
    expect((await db.query("select * from orders")).rows).toHaveLength(before);
  });
  it("persists a valid manual order with checklist and activity", async () => {
    const result = await db.query<{ order: { id: string } }>("select create_order_manual($1,$2) as order", [a, {
      title: "Manual order", tasks: [{ title: "Build", isClientRequirement: true }], deliverables: ["Page"], requirements: [], timezone: "Africa/Cairo",
    }]);
    const id = result.rows[0].order.id;
    expect((await db.query("select * from order_tasks where order_id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("select * from order_activity where order_id=$1", [id])).rows).toHaveLength(1);
  });
  it("enforces shared rate limits across consecutive database requests", async () => {
    for (const allowed of [true, true, false, false]) {
      const r = await db.query<{ allowed: boolean }>("select consume_rate_limit('test-bucket',2,now() + interval '1 minute') as allowed");
      expect(r.rows[0].allowed).toBe(allowed);
    }
  });
});
