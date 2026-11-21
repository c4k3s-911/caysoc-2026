// SME risk portfolio store. Shares the governance data volume.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.env.GOV_DATA_DIR || './data/governance');
const FILE = path.join(DATA_DIR, 'risk-portfolio.json');
const now = () => new Date().toISOString();
const empty = () => ({ clients: [], snapshots: [] });

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

export function addClient(input, actor) {
  const db = read();
  const name = String(input.name || '').trim().slice(0, 160);
  if (!name) return { error: 'name_required' };
  if (db.clients.some(c => c.name.toLowerCase() === name.toLowerCase())) return { error: 'client_exists' };
  const client = {
    id: 'CL-' + crypto.randomBytes(5).toString('hex').toUpperCase(),
    name,
    domain: String(input.domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0],
    hosts: (Array.isArray(input.hosts) ? input.hosts : []).map(h => String(h).trim().toLowerCase()).filter(Boolean),
    pack: ['basic', 'standard', 'premium'].includes(input.pack) ? input.pack : 'basic',
    monthlyFeeZar: Math.max(0, Number(input.monthlyFeeZar) || 0),
    owner: String(input.owner || 'unassigned').slice(0, 120),
    active: input.active === undefined ? true : !!input.active,
    addedAt: now(),
    addedBy: actor?.name || 'system',
  };
  db.clients.push(client);
  write(db);
  return client;
}

export function removeClient(id) {
  const db = read();
  const before = db.clients.length;
  db.clients = db.clients.filter(c => c.id !== id);
  db.snapshots = db.snapshots.filter(s => s.clientId !== id);
  write(db);
  return { removed: before - db.clients.length };
}

export function saveSnapshot(clientId, assessment, actor) {
  const db = read();
  const snap = {
    id: 'SNP-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    clientId,
    at: now(),
    by: actor?.name || 'system',
    score: assessment.score,
    grade: assessment.grade,
    zarExposure: assessment.zarExposure,
    usdExposure: assessment.usdExposure,
    factors: assessment.factors,
    assetsAssessed: assessment.assetsAssessed,
    controlledFindings: assessment.controlledFindings,
  };
  db.snapshots.push(snap);
  db.snapshots = db.snapshots.slice(-500);
  write(db);
  return snap;
}

export const paths = { FILE, DATA_DIR };
