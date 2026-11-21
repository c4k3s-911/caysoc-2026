#!/usr/bin/env node
const API = "http://127.0.0.1:3100/api";
const get = async (p) => (await fetch(API + p)).json();
const del = async (p) => (await fetch(API + p, { method: "DELETE" })).text();

const companies = await get("/companies");
const list = Array.isArray(companies) ? companies : companies.companies;
const c = list.find((x) => /caysoc/i.test(x.name));
const routinesRaw = await get(`/companies/${c.id}/routines`);
const routines = Array.isArray(routinesRaw) ? routinesRaw : routinesRaw.routines;

for (const r of routines) {
  const triggers = r.triggers || [];
  const seen = new Map();
  console.log(`${r.title} | status=${r.status} | triggers=${triggers.length}`);
  for (const t of triggers) {
    const key = `${t.kind}:${t.cronExpression}`;
    if (seen.has(key)) {
      const res = await del(`/routine-triggers/${t.id}`);
      console.log(`   DUP removed ${key} (${t.id}) -> ${res.slice(0, 80)}`);
    } else {
      seen.set(key, t);
      console.log(`   keep ${key} next=${t.nextRunAt || "-"} tz=${t.timezone}`);
    }
  }
}
