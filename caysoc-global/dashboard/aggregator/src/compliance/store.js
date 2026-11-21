// Compliance control catalog and evidence register. Shares the governance
// data volume; hashes use the same SHA-256 convention as the finding vault.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.env.GOV_DATA_DIR || './data/governance');
const FILE = path.join(DATA_DIR, 'compliance-store.json');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();

const DEFAULT_CONTROLS = [
  ['GD-01', 'Governance', 'Board-approved security policies', 'POPIA 19(1) · ISO 27001 A.5.1', 365, 'Board'],
  ['AC-01', 'Access control', 'Quarterly user access review', 'POPIA 19(1) · ISO 27001 A.5.15', 90, 'Sipho Nkosi'],
  ['AC-02', 'Access control', 'Privileged account inventory', 'POPIA 19(1) · ISO 27001 A.5.16', 90, 'Sipho Nkosi'],
  ['CR-01', 'Cryptography', 'Encryption at rest verified', 'POPIA 19(1)(c) · ISO 27001 A.8.24', 180, 'Naledi Molefe'],
  ['CR-02', 'Cryptography', 'TLS in transit on public endpoints', 'ISO 27001 A.8.24', 180, 'Naledi Molefe'],
  ['BK-01', 'Resilience', 'Backup job + restore test evidence', 'ISO 27001 A.8.13', 30, 'Nomsa Ndlovu'],
  ['PT-01', 'Resilience', 'Critical patches applied within 14 days', 'ISO 27001 A.8.19', 30, 'Nomsa Ndlovu'],
  ['VL-01', 'Assurance', 'Vulnerability scan summary', 'ISO 27001 A.8.8', 30, 'Thandi Mahlangu'],
  ['IR-01', 'Incident', 'Incident register + post-incident review', 'POPIA 22 · ISO 27001 A.5.24', 90, 'Thandi Mahlangu'],
  ['TR-01', 'People', 'Security awareness acknowledgement', 'POPIA 19(1) · ISO 27001 A.6.3', 365, 'Lerato Khumalo'],
  ['RM-01', 'Privacy', 'Retention and disposal record', 'POPIA 19(1)(e) · ISO 27001 A.5.33', 180, 'Jabu Sithole'],
  ['MN-01', 'Monitoring', 'Log review and alert triage record', 'ISO 27001 A.8.15', 30, 'Sipho Nkosi'],
].map(([id, domain, title, reference, frequencyDays, owner]) => ({
  id, domain, title, reference, frequencyDays, owner, active: true,
}));

const empty = () => ({ controls: DEFAULT_CONTROLS.map(c => ({ ...c })), evidence: [] });

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(empty(), null, 2));
}

export function read() {
  ensure();
  try { const db = JSON.parse(fs.readFileSync(FILE, 'utf8')); return { ...empty(), ...db }; }
  catch { return empty(); }
}

export function write(db) {
  ensure();
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function addEvidence(input, actor) {
  const db = read();
  const controlId = String(input.controlId || '').trim().toUpperCase();
  if (!db.controls.some(c => c.id === controlId)) return { error: 'unknown_control' };
  const body = String(input.content || '');
  if (!body && !input.uri) return { error: 'empty_evidence' };
  const e = {
    id: 'EV-' + crypto.randomBytes(6).toString('hex').toUpperCase(),
    controlId,
    title: String(input.title || 'Evidence').slice(0, 200),
    type: ['document', 'report', 'log', 'screenshot', 'attestation', 'link'].includes(input.type) ? input.type : 'document',
    source: String(input.source || 'manual').slice(0, 120),
    contentType: String(input.contentType || 'text/plain').slice(0, 80),
    byteSize: Buffer.byteLength(body),
    sha256: body ? sha(body) : null,
    uri: String(input.uri || '').slice(0, 500),
    note: String(input.note || '').slice(0, 1000),
    observedAt: input.observedAt ? String(input.observedAt) : now(),
    validUntil: input.validUntil ? String(input.validUntil) : null,
    addedAt: now(),
    addedBy: actor?.name || 'system',
  };
  db.evidence.push(e);
  write(db);
  return e;
}

export function linkFinding(finding, actor) {
  const db = read();
  const body = JSON.stringify({
    id: finding.id, identifier: finding.identifier, title: finding.title,
    severity: finding.severity, status: finding.status, company: finding.company,
    scopeId: finding.scopeId, authorization: finding.authorization,
    evidence: (finding.evidence || []).map(e => e.sha256),
  });
  return addEvidence({
    controlId: finding.type === 'exposure' ? 'VL-01' : 'IR-01',
    title: `${finding.identifier} — ${finding.title}`,
    type: 'link',
    source: 'governance-finding',
    uri: `/api/csg/gov/findings/${finding.id}`,
    content: body,
    contentType: 'application/json',
    note: `Linked governed finding ${finding.identifier} (${finding.status})`,
  }, actor);
}

export function removeEvidence(id) {
  const db = read();
  const before = db.evidence.length;
  db.evidence = db.evidence.filter(e => e.id !== id);
  write(db);
  return { removed: before - db.evidence.length };
}

export function addControl(input, actor) {
  const db = read();
  const id = String(input.id || '').trim().toUpperCase();
  if (!/^[A-Z]{2}-\d{2}$/.test(id)) return { error: 'invalid_control_id' };
  if (db.controls.some(c => c.id === id)) return { error: 'control_exists' };
  const c = {
    id,
    domain: String(input.domain || 'General').slice(0, 80),
    title: String(input.title || 'Control').slice(0, 200),
    reference: String(input.reference || 'Internal').slice(0, 200),
    frequencyDays: Math.min(3650, Math.max(1, Number(input.frequencyDays) || 90)),
    owner: String(input.owner || 'unassigned').slice(0, 120),
    active: input.active === undefined ? true : !!input.active,
  };
  db.controls.push(c);
  write(db);
  return c;
}

export const paths = { FILE, DATA_DIR, sha };
