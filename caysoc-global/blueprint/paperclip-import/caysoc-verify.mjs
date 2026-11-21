#!/usr/bin/env node
const API = "http://127.0.0.1:3100/api";
const get = async (p) => (await fetch(API + p)).json();

const companies = await get("/companies");
const list = Array.isArray(companies) ? companies : companies.companies;
const c = list.find((x) => /caysoc/i.test(x.name));
console.log("company:", c.id, c.name, c.issuePrefix, c.status, c.brandColor);
console.log("requireBoardApproval:", c.requireBoardApprovalForNewAgents);

const agentsRaw = await get(`/companies/${c.id}/agents`);
const agents = Array.isArray(agentsRaw) ? agentsRaw : agentsRaw.agents;
console.log("agents:", agents.length);
for (const a of agents) {
  console.log(`  ${a.name} | ${a.role} | ${a.adapterType} | model=${a.adapterConfig?.model ?? "-"} | status=${a.status}`);
}

const routinesRaw = await get(`/companies/${c.id}/routines`);
const routines = Array.isArray(routinesRaw) ? routinesRaw : routinesRaw.routines;
console.log("routines:", routines.length);
for (const r of routines) {
  const tRaw = await get(`/routines/${r.id}/triggers`);
  const triggers = Array.isArray(tRaw) ? tRaw : tRaw.triggers;
  console.log(`  ${r.title} | assignee=${r.assigneeAgentId ? "set" : "-"} | triggers=${triggers.length} ${JSON.stringify(triggers.map((x) => `${x.kind}:${x.cronExpression || ""}:${x.enabled}`))}`);
}
