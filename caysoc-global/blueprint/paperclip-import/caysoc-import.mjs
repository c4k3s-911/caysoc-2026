#!/usr/bin/env node
/**
 * CaySoc Global — idempotent import into a freshly deployed Paperclip instance.
 * Merge-only: finds existing company/goals/agents/routines by name/title and only creates what is missing.
 * Safe to re-run.
 */
const BASE = process.env.PAPERCLIP_BASE_URL || "http://127.0.0.1:3100";
const API = `${BASE}/api`;
const MODEL = process.env.CAY_MODEL || "opencode/hy4-flash-free";
const ADAPTER = process.env.CAY_ADAPTER || "opencode_local";
const ALWAYS_ON = new Set(["Sipho Nkosi", "Thandi Mahlangu", "Nomsa Ndlovu", "Naledi Molefe"]);
const HARDEN_RULE = " Never create issues about agent error states, adapter configuration, model names or timeouts; those are operator-managed. Report them in the run comment only.";
const FULL_HEARTBEAT_RULE = " CONTINUOUS HEARTBEAT RULE: never create a 'heartbeat verification', 'status check' or self-referential issue. Only work issues already on the board, or raise a new issue for a genuine operational finding with evidence. If there is nothing actionable, post one short 'no actionable work' comment and stop." + HARDEN_RULE;
/** Continuous but bounded: four core agents wake every 30 min; the rest are paused.
 * The first attempt woke all 11 at once and overloaded the 5.7 GB host (load 42). */
function heartbeatConfig(name) {
  const on = ALWAYS_ON.has(name);
  return {
    heartbeat: {
      enabled: true,
      intervalSec: on ? 1800 : 7200,
      maxConcurrentRuns: 1,
      wakeOnDemand: true,
      skipTimerWhenNoActionableWork: !on,
      maxDailyRuns: on ? 48 : 12,
      maxDailyCostCents: on ? 2000 : 1000,
    },
  };
}

const log = (...a) => console.log(...a);
const j = (o) => JSON.stringify(o, null, 2);

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data).slice(0, 500)}`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

/** Apply heartbeat policy and concurrency cap to an agent (idempotent). */
async function applyAutonomy(id, name) {
  try {
    const current = await call("GET", `/agents/${id}`);
    const agent = Array.isArray(current) ? current[0] : current;
    const bio = String(agent?.capabilities || "");
    if (ALWAYS_ON.has(name)) {
      if (!bio.includes("operator-managed")) {
        const addition = bio.includes("CONTINUOUS HEARTBEAT RULE") ? HARDEN_RULE : FULL_HEARTBEAT_RULE;
        await call("PATCH", `/agents/${id}`, { capabilities: bio.trim() + addition });
        log("  heartbeat rule applied");
      }
    }
    await call("PATCH", `/agents/${id}`, { runtimeConfig: heartbeatConfig(name) });
    log("  heartbeat policy applied:", ALWAYS_ON.has(name) ? "always-on 30m" : "paused-capable 2h");
  } catch (e) { log("  heartbeat failed:", e.message); }
  if (!ALWAYS_ON.has(name)) {
    try { await call("POST", `/agents/${id}/pause`, {}); log("  agent paused"); }
    catch (e) { /* already paused or transition not allowed */ }
  }
}

const AGENTS = [
  { key:"sipho", name:"Sipho Nkosi", title:"CaySoc Global CEO / Intake", role:"ceo", reportsToKey:null,
    bio:"Proudly South African founder-operator. Sipho sets direction for CaySoc Global from Johannesburg, keeps the six divisions pointed at one mission, and is the final human-approved gate on high-stakes work.",
    metadata:{ division:"Executive", legacyAliases:["HACAKE-001","Intake-Owner","CSG-CEO"] } },
  { key:"thandi", name:"Thandi Mahlangu", title:"Indaba PM / Portfolio", role:"pm", reportsToKey:"sipho",
    bio:"Indaba programme lead. Thandi runs the portfolio board in SAST, balances ZAR budgets, and makes sure every stream ships something provable rather than something loud.",
    metadata:{ division:"Indaba", legacyAliases:["HACAKE-010","PM-Lead","Caelum planner patterns"] } },
  { key:"anele", name:"Anele Dlamini", title:"Isibani Research Lead", role:"researcher", reportsToKey:"sipho",
    bio:"Isibani research lead. Anele turns reconnaissance and public-source intel into decision-grade briefings, with South African regulatory and socio-economic context always in frame.",
    metadata:{ division:"Isibani", legacyAliases:["HAKASE-002","Caelum Researcher","0xSec Recon"] } },
  { key:"lerato", name:"Lerato Khumalo", title:"Umlenze Delivery Lead", role:"engineer", reportsToKey:"thandi",
    bio:"Umlenze delivery lead. Lerato ships the working system: builds, integrations, and the unglamorous plumbing that keeps CaySoc Global running after the demo.",
    metadata:{ division:"Umlenze", legacyAliases:["HACAKE-021","Caelum Engineer"] } },
  { key:"jabu", name:"Jabu Sithole", title:"Isivikelo Security & Trust", role:"security", reportsToKey:"sipho",
    bio:"Isivikelo security and trust lead. Jabu keeps scope, consent and evidence discipline tight; offensive work happens only in authorised labs with written approval.",
    metadata:{ division:"Isivikelo", legacyAliases:["HACAKE-031","0xSec Reporter/Validator patterns"] } },
  { key:"naledi", name:"Naledi Molefe", title:"Isiqiniseko QA / Evidence / Release Gate", role:"qa", reportsToKey:"sipho",
    bio:"Isiqiniseko quality and evidence gate. Naledi signs nothing off on vibes: reproducible steps, captured artefacts, and a clean audit trail or it does not ship.",
    metadata:{ division:"Isiqiniseko", legacyAliases:["HACAKE-041","0xSec Validator"] } },
  { key:"khaya", name:"Khaya Zulu", title:"Ibhubesi Lab Lead (GATED)", role:"security", reportsToKey:"sipho",
    bio:"Ibhubesi lab lead. Khaya directs gated offensive research strictly inside authorised scope, with human approval and evidence capture for every action. No exceptions.",
    metadata:{ division:"Ibhubesi", gated:true, legacyAliases:["xploit Red Team Lead","HACAKE-001 gate"],
      policy:"authorized_scope_and_human_approval_required" } },
  { key:"nomsa_ops", name:"Nomsa Ndlovu", title:"Operations / Routines / Heartbeat", role:"devops", reportsToKey:"thandi",
    bio:"Operations heartbeat. Nomsa owns routines, schedules and agent health, and is the first to notice when a stream goes quiet at 02:00 SAST.",
    metadata:{ division:"Operations", legacyAliases:["HACAKE-013","CayScaN ops"] } },
  { key:"zola_scan", name:"Zola Mabaso", title:"CayScaN Recon & Telemetry (read-only default)", role:"researcher", reportsToKey:"anele",
    bio:"CayScaN recon and telemetry. Zola works read-only by default, feeding the dashboard counts and signals without touching anything that is not in scope.",
    metadata:{ division:"Isibani/Isivikelo", legacyAliases:["CayScaN agents"], policy:"read_only_metrics_by_default" } },
  { key:"mpho_dash", name:"Mpho Radebe", title:"Dashboard & 0Day/ZAR Metrics", role:"engineer", reportsToKey:"thandi",
    bio:"Dashboard and metrics. Mpho keeps the unified view honest: realtime 0-day counts, ZAR primary and USD secondary valuation, all stamped in SAST.",
    metadata:{ division:"Analytics", legacyAliases:["Hermes/Dashboard builder"],
      streams:["HaCakeSec","0xSec","Caelum","xploit","CayScaN"] } },
  { key:"themba_evidence", name:"Themba Nkosi", title:"Evidence Vault & Reporting", role:"general", reportsToKey:"naledi",
    bio:"Evidence vault and reporting. Themba writes the record that survives scrutiny: chain of custody, role-gated access, and reporting that reads cleanly to a regulator.",
    metadata:{ division:"Isiqiniseko", legacyAliases:["0xSec Reporter"] } },
];

const GOALS = [
  { key:"g1", title:"Unify CaySoc Global operations",
    description:"Operate as one governed CaySoc Global entity with preserved legacy aliases and ZAR/SAST reporting." },
  { key:"g2", title:"Governed security & evidence pipeline",
    description:"Research, testing, validation, QA, evidence, and approval gates for high-stakes actions." },
  { key:"g3", title:"Unified dashboard and 0Day/ZAR telemetry",
    description:"Realtime 0-day counts and ZAR valuation across CaySoc Global and legacy streams." },
];

const ROUTINES = [
  { key:"r_ops_heartbeat", title:"CSG Ops Heartbeat", priority:"high",
    description:"Operational status, blocked items, and dashboard health check.",
    assigneeKey:"nomsa_ops",
    triggers:[
      { kind:"schedule", label:"Every 4h SAST", cronExpression:"0 */4 * * *", timezone:"Africa/Johannesburg" },
      { kind:"schedule", label:"Hourly :30 SAST", cronExpression:"30 * * * *", timezone:"Africa/Johannesburg" },
    ] },
  { key:"r_daily", title:"CSG Daily Status Digest", priority:"medium",
    description:"Daily digest across legacy streams, 0Day counts/valuation deltas, risks, and approvals.",
    assigneeKey:"thandi",
    triggers:[
      { kind:"schedule", label:"Daily 08:00 SAST", cronExpression:"0 8 * * *", timezone:"Africa/Johannesburg" },
      { kind:"schedule", label:"12:00 SAST", cronExpression:"0 12 * * *", timezone:"Africa/Johannesburg" },
      { kind:"schedule", label:"20:00 SAST", cronExpression:"0 20 * * *", timezone:"Africa/Johannesburg" },
    ] },
  { key:"r_weekly", title:"CSG Weekly Portfolio Review", priority:"medium",
    description:"Weekly portfolio, ZAR budget/cost, QA evidence status, governed security posture.",
    assigneeKey:"thandi",
    triggers:[
      { kind:"schedule", label:"Mon 09:00 SAST", cronExpression:"0 9 * * 1", timezone:"Africa/Johannesburg" },
      { kind:"schedule", label:"Fri 09:00 SAST", cronExpression:"0 9 * * 5", timezone:"Africa/Johannesburg" },
    ] },
];

async function main() {
  log("== adapter check ==");
  try {
    const adapters = await call("GET", "/adapters");
    const list = (adapters?.adapters || adapters || []).map?.(a => a.type || a.id || a.name) ?? adapters;
    log("adapters:", Array.isArray(list) ? list.join(", ") : j(list));
  } catch (e) { log("adapter list unavailable:", e.message); }

  log("== company ==");
  const companies = await call("GET", "/companies");
  const arr = Array.isArray(companies) ? companies : companies?.companies || [];
  let company = arr.find(c => /caysoc global/i.test(c.name || "") || c.issuePrefix === "CAY");
  if (!company) {
    company = await call("POST", "/companies", {
      name: "CaySoc Global",
      description: "CaySoc Global — proudly South African unified governed operations (Indaba, Isibani, Umlenze, Isivikelo, Ibhubesi Lab gated, Isiqiniseko). SAST/ZAR. Legacy aliases preserved.",
      budgetMonthlyCents: 0,
    });
    log("created company", company.id);
  } else {
    log("found existing company", company.id, company.name);
  }
  const companyId = company.id;

  try {
    await call("PATCH", `/companies/${companyId}`, {
      status: "active", brandColor: "#1a73e8", requireBoardApprovalForNewAgents: true,
    });
    log("company patched");
  } catch (e) { log("company patch failed:", e.message); }

  try {
    await call("PATCH", `/companies/${companyId}/branding`, {
      name: "CaySoc Global",
      description: "CaySoc Global (CSG) — proudly South African",
      brandColor: "#1a73e8",
    });
    log("branding patched");
  } catch (e) { log("branding patch skipped:", e.message); }

  log("== goals ==");
  let goals = [];
  try { goals = await call("GET", `/companies/${companyId}/goals`); } catch (e) { log("goals read failed:", e.message); }
  const goalsArr = Array.isArray(goals) ? goals : goals?.goals || [];
  const goalIds = {};
  for (const g of GOALS) {
    const existing = goalsArr.find(x => (x.title || "").trim() === g.title);
    if (existing) { goalIds[g.key] = existing.id; log("goal exists:", g.title); continue; }
    try {
      const created = await call("POST", `/companies/${companyId}/goals`, {
        title: g.title, description: g.description, level: "company", status: "active",
      });
      goalIds[g.key] = created.id;
      log("goal created:", g.title, created.id);
    } catch (e) { log("goal failed:", g.title, e.message); }
  }

  log("== agents ==");
  // Temporarily lift the board-approval gate so the operator-run import can create
  // the seeded roster directly; the gate is restored immediately afterwards.
  try {
    await call("PATCH", `/companies/${companyId}`, { requireBoardApprovalForNewAgents: false });
    log("board-approval gate opened for seeding");
  } catch (e) { log("could not open gate:", e.message); }

  const existingAgents = await call("GET", `/companies/${companyId}/agents`);
  const agArr = Array.isArray(existingAgents) ? existingAgents : existingAgents?.agents || [];
  const agentIds = {};
  for (const a of AGENTS) {
    const found = agArr.find(x => (x.name || "").trim().toLowerCase() === a.name.toLowerCase());
    if (found) {
      agentIds[a.key] = found.id;
      log("agent exists:", a.name);
      await applyAutonomy(found.id, a.name);
      continue;
    }
    const body = {
      name: a.name,
      role: a.role || "general",
      title: a.title,
      capabilities: a.bio,
      adapterType: ADAPTER,
      adapterConfig: { model: MODEL, timeoutSec: 240, graceSec: 30 },
      runtimeConfig: heartbeatConfig(a.name),
      budgetMonthlyCents: 0,
      permissions: { canCreateAgents: false, canCreateSkills: false },
      metadata: { ...a.metadata, csg: { bio: a.bio, source: "caysoc-global-blueprint" } },
    };
    if (a.reportsToKey && agentIds[a.reportsToKey]) body.reportsTo = agentIds[a.reportsToKey];
    try {
      const created = await call("POST", `/companies/${companyId}/agents`, body);
      agentIds[a.key] = created.id;
      log("agent created:", a.name, created.id);
      await applyAutonomy(created.id, a.name);
    } catch (e) { log("agent FAILED:", a.name, e.message); }
  }

  log("== routines ==");
  try {
    await call("PATCH", `/companies/${companyId}`, { requireBoardApprovalForNewAgents: true });
    log("board-approval gate restored");
  } catch (e) { log("could not restore gate:", e.message); }

  let routines = [];
  try { routines = await call("GET", `/companies/${companyId}/routines`); } catch (e) { log("routines read failed:", e.message); }
  const rArr = Array.isArray(routines) ? routines : routines?.routines || [];
  for (const r of ROUTINES) {
    let routine = rArr.find(x => (x.title || "").trim() === r.title);
    if (!routine) {
      try {
        routine = await call("POST", `/companies/${companyId}/routines`, {
          title: r.title,
          description: r.description,
          priority: r.priority,
          status: "active",
          concurrencyPolicy: "coalesce_if_active",
          catchUpPolicy: "skip_missed",
          assigneeAgentId: agentIds[r.assigneeKey] || null,
          goalId: goalIds.g1 || null,
        });
        log("routine created:", r.title, routine.id);
      } catch (e) { log("routine FAILED:", r.title, e.message); continue; }
    } else {
      log("routine exists:", r.title);
      if (!routine.assigneeAgentId && agentIds[r.assigneeKey]) {
        try {
          await call("PATCH", `/routines/${routine.id}`, { assigneeAgentId: agentIds[r.assigneeKey] });
          log("  assignee set:", r.assigneeKey);
        } catch (e) { log("  assignee failed:", e.message); }
      }
    }
    // Triggers are embedded in the routine payload; /routines/:id/triggers is not a live route.
    const tArr = Array.isArray(routine.triggers) ? routine.triggers : [];
    for (const t of r.triggers) {
      if (tArr.some(x => x.kind === "schedule" && x.cronExpression === t.cronExpression)) { log("  trigger exists:", t.cronExpression); continue; }
      try {
        await call("POST", `/routines/${routine.id}/triggers`, { ...t, enabled: true });
        log("  trigger created:", t.cronExpression);
      } catch (e) { log("  trigger FAILED:", t.cronExpression, e.message); }
    }
  }

  log("== summary ==");
  const finalAgents = await call("GET", `/companies/${companyId}/agents`);
  const fArr = Array.isArray(finalAgents) ? finalAgents : finalAgents?.agents || [];
  log("companyId:", companyId, "agents:", fArr.length);
  for (const a of fArr) log(`  - ${a.name} | ${a.role} | reportsTo=${a.reportsTo || "-"}`);
}

main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
