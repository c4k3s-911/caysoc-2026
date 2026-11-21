// File-backed inventory store for the Shadow Asset Monitor. Shares the
// governance data volume; no new container or mount is required.
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.env.GOV_DATA_DIR || './data/governance');
const FILE = path.join(DATA_DIR, 'assets-store.json');
const empty = () => ({ seeds: [], assets: {}, snapshots: [], lastRun: null });

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

export function addSeed(input, actor) {
  const db = read();
  const host = String(input.host || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!host || !/^[a-z0-9.*-]+$/.test(host)) return { error: 'invalid_host' };
  if (db.seeds.some(s => s.host === host)) return { error: 'already_tracked' };
  const seed = {
    host,
    owner: String(input.owner || 'unassigned').slice(0, 120),
    note: String(input.note || '').slice(0, 500),
    enabled: input.enabled === undefined ? true : !!input.enabled,
    addedAt: new Date().toISOString(),
    addedBy: actor?.name || 'system',
  };
  db.seeds.push(seed);
  write(db);
  return seed;
}

export function removeSeed(host) {
  const db = read();
  const h = String(host || '').toLowerCase();
  const before = db.seeds.length;
  db.seeds = db.seeds.filter(s => s.host !== h);
  delete db.assets[h];
  write(db);
  return { removed: before - db.seeds.length };
}

export function savePass(records, actor) {
  const db = read();
  const previous = db.assets || {};
  const now = new Date().toISOString();
  const assets = {};
  for (const r of records) assets[r.host] = { ...r, firstSeen: previous[r.host]?.firstSeen || now, lastSeen: now };
  db.assets = assets;
  db.lastRun = { at: now, by: actor?.name || 'system', count: records.length };
  write(db);
  return { at: now, assets };
}

export function recordSnapshot(diff, actor) {
  const db = read();
  const snapshot = {
    at: new Date().toISOString(),
    by: actor?.name || 'system',
    count: Object.keys(db.assets || {}).length,
    ...diff,
  };
  db.snapshots = (db.snapshots || []).concat(snapshot).slice(-200);
  write(db);
  return snapshot;
}

export const paths = { FILE, DATA_DIR };
