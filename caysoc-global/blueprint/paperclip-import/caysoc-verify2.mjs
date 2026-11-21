#!/usr/bin/env node
const API = "http://127.0.0.1:3100/api";
const get = async (p) => (await fetch(API + p)).json();

const companies = await get("/companies");
const list = Array.isArray(companies) ? companies : companies.companies;
const c = list.find((x) => /caysoc/i.test(x.name));
const routinesRaw = await get(`/companies/${c.id}/routines`);
const routines = Array.isArray(routinesRaw) ? routinesRaw : routinesRaw.routines;
for (const r of routines) {
  const t = await get(`/routines/${r.id}/triggers`);
  const arr = Array.isArray(t) ? t : t.triggers || t.items || t.data || [];
  console.log(`${r.title} | assignee=${r.assigneeAgentId || "-"} | status=${r.status}`);
  if (!Array.isArray(t)) console.log("   raw keys:", Object.keys(t));
  for (const x of arr) console.log(`   - ${x.kind} ${x.cronExpression || ""} ${x.timezone || ""} enabled=${x.enabled}`);
  if (arr.length === 0) console.log("   (no triggers parsed) raw:", JSON.stringify(t).slice(0, 300));
}
