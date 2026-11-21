// Community signal register. Raw values are internal-only; the public API
// returns aggregates exclusively. Shares the governance data volume.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.env.GOV_DATA_DIR || './data/governance');
const FILE = path.join(DATA_DIR, 'community-signals.json');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();
const empty = () => ({ indicators: [], reports: [] });

function ensure() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(empty(), null, 2));
}

export function read() {
  ensure();
  try { return { ...empty(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; }
  catch { return empty(); }
}

export function write(db) {
  ensure();
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function addIndicator(input, fingerprint = 'anonymous') {
  const db = read();
  const value = String(input.value || '').trim().slice(0, 500);
  if (!value) return { error: 'empty_value' };
  const key = sha(value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''));
  const existing = db.indicators.find(i => i.fingerprintHash === key);
  if (existing) {
    existing.reports += 1;
    existing.lastSeenAt = now();
    if (input.province && !existing.provinces.includes(input.province)) existing.provinces.push(input.province);
    write(db);
    return { duplicate: true, id: existing.id, reports: existing.reports };
  }
  const indicator = {
    id: 'SIG-' + crypto.randomBytes(6).toString('hex').toUpperCase(),
    fingerprintHash: key,
    internalValue: value,
    type: ['phishing_domain', 'scam_template', 'lookalike', 'exposed_service', 'sms_pattern', 'email_pattern'].includes(input.type) ? input.type : 'scam_template',
    category: String(input.category || 'other').slice(0, 80),
    provinces: input.province ? [String(input.province).slice(0, 60)] : [],
    severity: ['low', 'medium', 'high'].includes(input.severity) ? input.severity : 'medium',
    source: String(input.source || 'community').slice(0, 80),
    consent: !!input.consent,
    verified: false,
    publicVisible: false,
    reports: 1,
    tags: (Array.isArray(input.tags) ? input.tags : []).map(t => String(t).slice(0, 40)).slice(0, 20),
    note: String(input.note || '').slice(0, 1000),
    submittedAt: now(),
    lastSeenAt: now(),
    submittedBy: fingerprint,
  };
  db.indicators.push(indicator);
  write(db);
  return { duplicate: false, id: indicator.id };
}

export function verifyIndicator(id, actor) {
  const db = read();
  const i = db.indicators.find(x => x.id === id);
  if (!i) return { error: 'not_found' };
  i.verified = true;
  i.publicVisible = true;
  i.verifiedBy = actor?.name || 'operator';
  i.verifiedAt = now();
  write(db);
  return i;
}

export function removeIndicator(id) {
  const db = read();
  const before = db.indicators.length;
  db.indicators = db.indicators.filter(i => i.id !== id);
  write(db);
  return { removed: before - db.indicators.length };
}

export function saveReport(text, actor) {
  const db = read();
  const entry = { id: 'RPT-' + crypto.randomBytes(4).toString('hex').toUpperCase(), at: now(), by: actor?.name || 'system', text };
  db.reports.push(entry);
  db.reports = db.reports.slice(-50);
  write(db);
  return entry;
}

export const paths = { FILE, DATA_DIR, sha };
