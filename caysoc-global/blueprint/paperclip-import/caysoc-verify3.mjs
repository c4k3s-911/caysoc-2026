#!/usr/bin/env node
const API = "http://127.0.0.1:3100/api";
const get = async (p) => (await fetch(API + p)).json();
const patch = async (p, b) => (await fetch(API + p, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();

const companies = await get("/companies");
const list = Array.isArray(companies) ? companies : companies.companies;
const c = list.find((x) => /caysoc/i.test(x.name));
const routinesRaw = await get(`/companies/${c.id}/routines`);
const routines = Array.isArray(routinesRaw) ? routinesRaw : routinesRaw.routines;
console.log("routine keys:", Object.keys(routines[0]));
console.log(JSON.stringify(routines[0], null, 2).slice(0, 1400));
for (const r of routines) {
  if (r.status !== "active") {
    const out = await patch(`/routines/${r.id}`, { status: "active" });
    console.log(`reactivated ${r.title} -> ${out.status}`);
  }
}
const after = await get(`/companies/${c.id}/routines`);
const arr = Array.isArray(after) ? after : after.routines;
console.log("statuses:", arr.map((r) => `${r.title}=${r.status}`).join(", "));
