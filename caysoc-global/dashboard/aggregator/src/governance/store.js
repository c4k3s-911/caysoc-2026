// Governed store for scopes, approvals, findings, evidence and an append-only
// hash-chained audit log. File-backed and synchronous on mutation to keep the
// single aggregator process race-free. No third-party dependencies.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.env.GOV_DATA_DIR || './data/governance');
const DB_FILE = path.join(DATA_DIR, 'gov-store.json');
const AUDIT_FILE = path.join(DATA_DIR, 'gov-audit.jsonl');
const GENESIS = '0'.repeat(64);

const now = () => new Date().toISOString();
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const uid = p => `${p}_${crypto.randomUUID()}`;

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ scopes: [], findings: [], tokens: [], seq: 0 }, null, 2));
  }
  if (!fs.existsSync(AUDIT_FILE)) fs.writeFileSync(AUDIT_FILE, '');
}

function readDb() {
  ensure();
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { scopes: [], findings: [], tokens: [], seq: 0 }; }
}

function writeDb(db) {
  ensure();
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function lastHash() {
  ensure();
  try {
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
    if (!lines.length) return GENESIS;
    return JSON.parse(lines[lines.length - 1]).hash || GENESIS;
  } catch { return GENESIS; }
}

function audit(actor, action, entityType, entityId, details = {}) {
  ensure();
  const db = readDb();
  db.seq = Number(db.seq || 0) + 1;
  const prevHash = lastHash();
  const entry = {
    seq: db.seq,
    at: now(),
    actor: actor?.name || actor?.id || 'system',
    role: actor?.role || 'system',
    action,
    entityType,
    entityId: entityId || null,
    details,
    prevHash,
  };
  entry.hash = sha(JSON.stringify(entry));
  fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + '\n');
  writeDb(db);
  return entry;
}

function findIdentifier(db) {
  const used = db.findings.map(f => Number(String(f.identifier || '').replace(/\D/g, '')) || 0);
  return 'GOV-' + String(Math.max(0, ...used) + 1).padStart(4, '0');
}

/* ---------------- scopes ---------------- */

export function listScopes() { return readDb().scopes; }

export function getScope(id) { return readDb().scopes.find(s => s.id === id) || null; }

export function createScope(input, actor) {
  const db = readDb();
  const scope = {
    id: uid('scope'),
    name: String(input.name || 'Unnamed scope').slice(0, 200),
    owner: String(input.owner || actor?.name || 'unknown').slice(0, 120),
    purpose: String(input.purpose || '').slice(0, 1000),
    targets: (Array.isArray(input.targets) ? input.targets : []).map(t => String(t).trim()).filter(Boolean).slice(0, 100),
    tools: (Array.isArray(input.tools) ? input.tools : []).map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 100),
    window: {
      from: input.window?.from || null,
      to: input.window?.to || null,
    },
    status: 'draft',
    approval: null,
    createdAt: now(),
    updatedAt: now(),
    createdBy: actor?.name || 'system',
  };
  db.scopes.push(scope);
  writeDb(db);
  audit(actor, 'scope.created', 'scope', scope.id, { name: scope.name, targets: scope.targets.length });
  return scope;
}

export function approveScope(id, input, actor) {
  const db = readDb();
  const s = db.scopes.find(x => x.id === id);
  if (!s) return { error: 'not_found' };
  if (!s.targets.length || !s.tools.length) return { error: 'scope_needs_targets_and_tools' };
  s.approval = {
    by: String(input.by || actor?.name || 'board').slice(0, 120),
    ticket: String(input.ticket || '').slice(0, 200),
    at: now(),
  };
  s.status = 'approved';
  s.updatedAt = now();
  writeDb(db);
  audit(actor, 'scope.approved', 'scope', s.id, { by: s.approval.by, ticket: s.approval.ticket });
  return s;
}

export function revokeScope(id, actor) {
  const db = readDb();
  const s = db.scopes.find(x => x.id === id);
  if (!s) return { error: 'not_found' };
  s.status = 'revoked';
  s.updatedAt = now();
  db.tokens = db.tokens.filter(t => t.scopeId !== id);
  writeDb(db);
  audit(actor, 'scope.revoked', 'scope', s.id, {});
  return s;
}

function scopeWindowValid(s) {
  if (!s.window?.from && !s.window?.to) return true;
  const t = Date.now();
  if (s.window.from && Date.parse(s.window.from) > t) return false;
  if (s.window.to && Date.parse(s.window.to) < t) return false;
  return true;
}

export function effectiveStatus(s) {
  if (!s) return 'unknown';
  if (s.status === 'revoked' || s.status === 'draft') return s.status;
  if (s.status === 'approved' && scopeWindowValid(s)) return 'active';
  if (s.window?.to && Date.parse(s.window.to) < Date.now()) return 'expired';
  return s.status;
}

export function mintToken(id, input, actor) {
  const db = readDb();
  const s = db.scopes.find(x => x.id === id);
  if (!s) return { error: 'not_found' };
  if (effectiveStatus(s) !== 'active') return { error: 'scope_not_active' };
  const raw = crypto.randomBytes(24).toString('hex');
  const ttlSec = Math.min(24 * 3600, Math.max(60, Number(input.ttlSec) || 1800));
  const maxUses = Math.min(1000, Math.max(1, Number(input.maxUses) || 10));
  const token = {
    id: uid('tok'),
    scopeId: id,
    hash: sha(raw),
    expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
    uses: 0,
    maxUses,
    createdAt: now(),
    createdBy: actor?.name || 'system',
  };
  db.tokens.push(token);
  writeDb(db);
  audit(actor, 'scope.token_minted', 'scope', id, { ttlSec, maxUses, tokenId: token.id });
  return { token: raw, expiresAt: token.expiresAt, maxUses, scopeId: id };
}

function targetAllowed(target, patterns) {
  const t = String(target || '').toLowerCase().trim();
  return patterns.some(p => {
    p = String(p).toLowerCase().trim();
    if (p.startsWith('*.')) return t.endsWith(p.slice(1)) || t === p.slice(2);
    return t === p;
  });
}

export function checkScope(input, actor) {
  const db = readDb();
  const raw = String(input.token || '');
  const token = db.tokens.find(t => t.hash === sha(raw));
  const deny = (reason, scopeId = null) => {
    audit(actor, 'scope.check_denied', 'scope', scopeId, { reason, target: input.target || null, tool: input.tool || null });
    return { allowed: false, reason, scopeId };
  };
  if (!token) return deny('invalid_token');
  if (Date.parse(token.expiresAt) < Date.now()) return deny('token_expired', token.scopeId);
  if (token.uses >= token.maxUses) return deny('token_exhausted', token.scopeId);
  const s = db.scopes.find(x => x.id === token.scopeId);
  if (!s) return deny('scope_missing', token.scopeId);
  if (effectiveStatus(s) !== 'active') return deny('scope_not_active', s.id);
  if (!targetAllowed(input.target, s.targets)) return deny('target_out_of_scope', s.id);
  if (!s.tools.includes(String(input.tool || '').toLowerCase())) return deny('tool_not_allowed', s.id);
  token.uses += 1;
  writeDb(db);
  audit(actor, 'scope.check_allowed', 'scope', s.id, { target: input.target, tool: input.tool, remaining: token.maxUses - token.uses });
  return { allowed: true, scopeId: s.id, reason: 'in_scope', remaining: token.maxUses - token.uses };
}

/* ---------------- findings ---------------- */

export function listFindings(company) {
  const all = readDb().findings;
  return company ? all.filter(f => String(f.company || '').toLowerCase() === String(company).toLowerCase()) : all;
}

export function getFinding(id) { return readDb().findings.find(f => f.id === id) || null; }

export function createFinding(input, actor) {
  const db = readDb();
  const f = {
    id: uid('finding'),
    identifier: findIdentifier(db),
    title: String(input.title || 'Untitled finding').slice(0, 300),
    type: ['0day', 'vuln', 'exposure'].includes(input.type) ? input.type : '0day',
    severity: ['critical', 'high', 'medium', 'low'].includes(input.severity) ? input.severity : 'medium',
    status: 'intake',
    company: String(input.company || 'CaySoc Global').slice(0, 120),
    owner: String(input.owner || actor?.name || 'unassigned').slice(0, 120),
    scopeId: input.scopeId || null,
    authorization: String(input.authorization || '').slice(0, 1000),
    description: String(input.description || '').slice(0, 20000),
    impact: String(input.impact || '').slice(0, 10000),
    cvss: Number(input.cvss) || null,
    valuation: {
      usdLow: Number(input.valuation?.usdLow) || 0,
      usdHigh: Number(input.valuation?.usdHigh) || 0,
    },
    evidence: [],
    disclosure: { decision: 'pending', at: null, by: null, reference: '' },
    createdAt: now(),
    updatedAt: now(),
    createdBy: actor?.name || 'system',
  };
  db.findings.push(f);
  writeDb(db);
  audit(actor, 'finding.created', 'finding', f.id, { identifier: f.identifier, severity: f.severity, company: f.company });
  return f;
}

const FINDING_STATUSES = ['intake', 'triage', 'verifying', 'validated', 'valued', 'disclosed', 'retained', 'rejected'];

export function updateFinding(id, patch, actor) {
  const db = readDb();
  const f = db.findings.find(x => x.id === id);
  if (!f) return { error: 'not_found' };
  const changes = {};
  for (const key of ['title', 'description', 'impact', 'owner', 'company', 'scopeId', 'authorization', 'cvss']) {
    if (patch[key] !== undefined) { f[key] = patch[key]; changes[key] = true; }
  }
  if (patch.severity !== undefined && ['critical', 'high', 'medium', 'low'].includes(patch.severity)) {
    f.severity = patch.severity; changes.severity = true;
  }
  if (patch.type !== undefined && ['0day', 'vuln', 'exposure'].includes(patch.type)) { f.type = patch.type; changes.type = true; }
  if (patch.status !== undefined && FINDING_STATUSES.includes(patch.status)) { f.status = patch.status; changes.status = true; }
  if (patch.valuation) {
    f.valuation = {
      usdLow: Number(patch.valuation.usdLow ?? f.valuation.usdLow) || 0,
      usdHigh: Number(patch.valuation.usdHigh ?? f.valuation.usdHigh) || 0,
    };
    changes.valuation = true;
  }
  if (patch.disclosure) {
    f.disclosure = {
      decision: String(patch.disclosure.decision || f.disclosure.decision).slice(0, 40),
      at: patch.disclosure.decision !== 'pending' ? now() : null,
      by: patch.disclosure.decision !== 'pending' ? (actor?.name || 'system') : null,
      reference: String(patch.disclosure.reference || '').slice(0, 300),
    };
    changes.disclosure = true;
  }
  f.updatedAt = now();
  writeDb(db);
  audit(actor, 'finding.updated', 'finding', f.id, { identifier: f.identifier, changes: Object.keys(changes) });
  return f;
}

export function addEvidence(id, input, actor) {
  const db = readDb();
  const f = db.findings.find(x => x.id === id);
  if (!f) return { error: 'not_found' };
  const body = String(input.content || '');
  if (!body) return { error: 'empty_evidence' };
  const e = {
    id: uid('ev'),
    filename: String(input.filename || 'evidence.txt').slice(0, 200),
    contentType: String(input.contentType || 'text/plain').slice(0, 100),
    byteSize: Buffer.byteLength(body),
    sha256: sha(body),
    uri: String(input.uri || '').slice(0, 500),
    note: String(input.note || '').slice(0, 1000),
    addedAt: now(),
    addedBy: actor?.name || 'system',
  };
  f.evidence.push(e);
  f.updatedAt = now();
  writeDb(db);
  audit(actor, 'finding.evidence_added', 'finding', f.id, { identifier: f.identifier, evidenceId: e.id, sha256: e.sha256 });
  return e;
}

/* ---------------- audit + summary ---------------- */

export function listAudit(limit = 200) {
  ensure();
  try {
    const lines = fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.slice(-Math.min(1000, Math.max(1, Number(limit) || 200))).map(l => JSON.parse(l)).reverse();
  } catch { return []; }
}

export function verifyAudit() {
  const entries = listAudit(100000).reverse();
  let prev = GENESIS;
  let ok = true;
  for (const e of entries) {
    if (e.prevHash !== prev) { ok = false; break; }
    const { hash, ...rest } = e;
    if (sha(JSON.stringify(rest)) !== hash) { ok = false; break; }
    prev = hash;
  }
  return { ok, count: entries.length, head: prev };
}

export function summary() {
  const db = readDb();
  const findings = db.findings;
  const byStatus = {}, bySeverity = {};
  for (const f of findings) {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }
  const scopes = db.scopes;
  const byScopeStatus = {};
  for (const s of scopes) {
    const st = effectiveStatus(s);
    byScopeStatus[st] = (byScopeStatus[st] || 0) + 1;
  }
  const auditLines = (() => { try { return fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean).length; } catch { return 0; } })();
  const denials = (() => {
    try {
      return fs.readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(l => l.includes('scope.check_denied')).length;
    } catch { return 0; }
  })();
  const fx = Number(process.env.FX_USD_ZAR) || 18.5;
  const usdHigh = findings.filter(f => !['rejected', 'disclosed'].includes(f.status)).reduce((n, f) => n + (f.valuation?.usdHigh || 0), 0);
  return {
    governed: true,
    generated_at: now(),
    findings: { total: findings.length, by_status: byStatus, by_severity: bySeverity, unresolved_value_usd: usdHigh, unresolved_value_zar: Math.round(usdHigh * fx) },
    scopes: { total: scopes.length, by_status: byScopeStatus, active_tokens: db.tokens.filter(t => Date.parse(t.expiresAt) > Date.now() && t.uses < t.maxUses).length },
    audit: { events: auditLines, scope_denials: denials },
  };
}

export const paths = { DATA_DIR, DB_FILE, AUDIT_FILE };
export const recordAudit = audit;
