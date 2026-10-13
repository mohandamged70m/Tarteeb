// Verify authenticated chrome (sidebar + mobile header logo links).
const B = process.env.SMOKE_BASE ?? "http://localhost:3101";
const email = `brand-${Date.now().toString(36)}@example.com`;
let cookie = "";
async function api(path, opts = {}) {
  const r = await fetch(B + path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}), cookie },
    redirect: "manual",
  });
  const sc = r.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return r;
}
await api("/api/auth/signup", {
  method: "POST",
  body: JSON.stringify({ email, password: "password123", displayName: "B" }),
});
const r = await api("/");
const html = await r.text();
const checks = [
  `home 200: ${r.status === 200}`,
  "sidebar logo img: " + html.includes("/tarteeb-logo-white.svg"),
  "home-link aria-label: " + html.includes('aria-label="Tarteeb home"'),
  "home-link href: " + html.includes('href="/"'),
  "mobile header present: " + html.includes("md:hidden"),
  "no leftover sitename spans: " + (!html.includes(">Tarteeb</span>") && !html.includes(">Tarteeb</p>")),
];
console.log(checks.join("\n"));
