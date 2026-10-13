// Branding verification against a running server (default http://localhost:3101).
const B = process.env.SMOKE_BASE ?? "http://localhost:3101";
const out = [];
async function get(p) {
  for (let i = 0; i < 20; i++) {
    try {
      return await fetch(B + p);
    } catch {
      await new Promise((s) => setTimeout(s, 1000));
    }
  }
  throw new Error("server never came up");
}
let r = await get("/tarteeb-logo-white.svg");
out.push(`logo-white: ${r.status} ${r.headers.get("content-type")}`);
r = await get("/tarteeb-icon-white.svg");
out.push(`icon-white: ${r.status} ${r.headers.get("content-type")}`);
r = await get("/tarteeb-logo-black.svg");
out.push(`logo-black: ${r.status}`);
r = await get("/icon.svg");
const iconText = await r.text();
out.push(`favicon /icon.svg: ${r.status} ${r.headers.get("content-type")} hasTile=${iconText.includes("#0A0A0A")}`);
r = await get("/login");
const html = await r.text();
out.push(`login 200: ${r.status === 200}`);
out.push(`login has logo img: ${html.includes("/tarteeb-logo-white.svg")}`);
out.push("login logo alt: " + html.includes('alt="Tarteeb"'));
out.push("login favicon link: " + /rel="icon"/.test(html));
out.push("login old sitename text gone: " + !html.includes(">Tarteeb</p>"));
out.push("login explicit dimensions: " + (html.includes('width="') && html.includes('height="')));
r = await fetch(B + "/", { redirect: "manual" });
out.push(`unauth / behavior preserved (redirect-or-200): ${[307, 308].includes(r.status) || r.status === 200}`);
console.log(out.join("\n"));
