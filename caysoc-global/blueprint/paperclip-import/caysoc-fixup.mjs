#!/usr/bin/env node
/** Fix-up pass: set org chart (reportsTo) and routine assignees by name. Idempotent. */
const API = (process.env.PAPERCLIP_BASE_URL || "http://127.0.0.1:3100") + "/api";

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method, headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${String(text).slice(0, 300)}`);
  return data;
}

const REPORTS = {
  "Sipho Nkosi": null,
  "Thandi Mahlangu": "Sipho Nkosi",
  "Anele Dlamini": "Sipho Nkosi",
  "Lerato Khumalo": "Thandi Mahlangu",
  "Jabu Sithole": "Sipho Nkosi",
  "Naledi Molefe": "Sipho Nkosi",
  "Khaya Zulu": "Sipho Nkosi",
  "Nomsa Ndlovu": "Thandi Mahlangu",
  "Zola Mabaso": "Anele Dlamini",
  "Mpho Radebe": "Thandi Mahlangu",
  "Themba Nkosi": "Naledi Molefe",
};

const ROUTINE_ASSIGNEE = {
  "CSG Ops Heartbeat": "Nomsa Ndlovu",
  "CSG Daily Status Digest": "Thandi Mahlangu",
  "CSG Weekly Portfolio Review": "Thandi Mahlangu",
};

const companies = await call("GET", "/companies");
const arr = Array.isArray(companies) ? companies : companies.companies || [];
const company = arr.find(c => /caysoc global/i.test(c.name || "") || c.issuePrefix === "CAY");
if (!company) { console.error("company not found"); process.exit(1); }
const companyId = company.id;

const agents = await call("GET", `/companies/${companyId}/agents`);
const agArr = Array.isArray(agents) ? agents : agents.agents || [];
const byName = new Map(agArr.map(a => [a.name, a]));
console.log(`company ${companyId}: ${agArr.length} agents`);

for (const [name, bossName] of Object.entries(REPORTS)) {
  const agent = byName.get(name);
  if (!agent) { console.log(`  MISSING ${name}`); continue; }
  const boss = bossName ? byName.get(bossName) : null;
  const want = boss ? boss.id : null;
  if ((agent.reportsTo || null) === want) { console.log(`  ok ${name} -> ${bossName || "root"}`); continue; }
  try {
    await call("PATCH", `/agents/${agent.id}`, { reportsTo: want });
    console.log(`  set ${name} -> ${bossName || "root"}`);
  } catch (e) { console.log(`  FAIL ${name}: ${e.message}`); }
}

const routines = await call("GET", `/companies/${companyId}/routines`);
const rArr = Array.isArray(routines) ? routines : routines.routines || [];
for (const [title, agentName] of Object.entries(ROUTINE_ASSIGNEE)) {
  const routine = rArr.find(r => (r.title || "").trim() === title);
  if (!routine) { console.log(`  routine MISSING ${title}`); continue; }
  const agent = byName.get(agentName);
  if (!agent) { console.log(`  agent MISSING ${agentName}`); continue; }
  if (routine.assigneeAgentId === agent.id) { console.log(`  ok routine ${title}`); continue; }
  try {
    await call("PATCH", `/routines/${routine.id}`, { assigneeAgentId: agent.id });
    console.log(`  set routine ${title} -> ${agentName}`);
  } catch (e) { console.log(`  FAIL routine ${title}: ${e.message}`); }
}

const final = await call("GET", `/companies/${companyId}/agents`);
const fArr = Array.isArray(final) ? final : final.agents || [];
console.log("=== final org ===");
const nameById = new Map(fArr.map(a => [a.id, a.name]));
for (const a of fArr) console.log(`  ${a.name} | ${a.role} | reportsTo=${nameById.get(a.reportsTo) || "-"}`);
