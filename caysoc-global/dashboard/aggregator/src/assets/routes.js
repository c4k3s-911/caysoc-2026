import { Router } from 'express';
import { requireRole } from '../governance/auth.js';
import { recordAudit, checkScope } from '../governance/store.js';
import * as communityStore from '../community/store.js';
import * as store from './store.js';
import { discover } from './discovery.js';
import { assetSummary, enrichAssets, diffAssets, weeklyReport } from './analysis.js';

const router = Router();
const READ = requireRole('board', 'operator');
const WRITE = requireRole('board', 'operator');

const TORBOT_URL = process.env.TORBOT_RUNNER_URL || 'http://127.0.0.1:9055';

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-shadow-assets', mode: 'passive', torbot: true }));

router.get('/summary', READ, (_req, res) => {
  const db = store.read();
  res.json({ ...assetSummary(db, db.snapshots || []), onion_sightings: (db.onion || []).length });
});

router.get('/onion', READ, (_req, res) => {
  const sightings = (store.read().onion || []).slice().reverse();
  res.json({ sightings, count: sightings.length });
});

// TorBot brand-monitoring scan — folded into #9/#6, gated by #2 scope.
router.post('/onion/scan', WRITE, async (req, res) => {
  const target = String(req.body?.target || '').trim();
  const scopeToken = String(req.body?.scopeToken || '');
  if (!target) return res.status(400).json({ error: 'target_required' });
  const check = checkScope({ token: scopeToken, target, tool: 'torbot' }, req.gov);
  if (!check.allowed) return res.status(403).json(check);
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 210000);
    let r;
    try {
      r = await fetch(TORBOT_URL + '/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target, depth: Number(req.body?.depth) || 1 }),
        signal: ctl.signal,
      });
    } finally { clearTimeout(timer); }
    const data = await r.json();
    if (!r.ok) return res.status(502).json(data);
    const sighting = store.addOnionSighting({ ...data, scopeId: check.scopeId }, req.gov);
    const indicator = communityStore.addIndicator({
      value: data.target_pattern || target,
      type: 'darkweb_mention',
      category: 'Dark-web brand monitor',
      consent: true,
      source: 'torbot',
      note: `${data.pages || 0} pages · ${data.email_count || 0} contacts · sha256=${data.result_sha256}`,
    }, { name: 'torbot-runner' });
    recordAudit(req.gov, 'asset.torbot_scan', 'asset', sighting.id, {
      targetHash: data.target_sha256, resultHash: data.result_sha256, scopeId: check.scopeId,
    });
    res.json({ ok: true, sighting, indicator: indicator.error || indicator.id, check: { scopeId: check.scopeId, remaining: check.remaining } });
  } catch (e) {
    res.status(502).json({ error: 'runner_unavailable', message: String(e && e.message || e) });
  }
});

router.get('/seeds', READ, (_req, res) => res.json({ seeds: store.read().seeds || [] }));

router.post('/seeds', WRITE, (req, res) => {
  const seed = store.addSeed(req.body || {}, req.gov);
  if (seed.error) return res.status(400).json(seed);
  recordAudit(req.gov, 'asset.seed_added', 'asset', seed.host, { owner: seed.owner });
  res.status(201).json(seed);
});

router.delete('/seeds/:host', WRITE, (req, res) => {
  const out = store.removeSeed(req.params.host);
  recordAudit(req.gov, 'asset.seed_removed', 'asset', req.params.host, out);
  res.json(out);
});

router.get('/assets', READ, (_req, res) => {
  const db = store.read();
  res.json({ assets: enrichAssets(db.assets || {}), last_run: db.lastRun });
});

router.get('/assets/:host', READ, (req, res) => {
  const db = store.read();
  const a = db.assets?.[String(req.params.host).toLowerCase()];
  if (!a) return res.status(404).json({ error: 'not_found' });
  res.json(enrichAssets({ [a.host]: a })[0]);
});

router.post('/discover', WRITE, async (req, res) => {
  const db = store.read();
  const seeds = db.seeds || [];
  if (!seeds.length) return res.status(400).json({ error: 'no_seeds', message: 'Add at least one host to the seed inventory first.' });
  try {
    const before = db.assets || {};
    const records = await discover(seeds);
    store.savePass(records, req.gov);
    const diff = diffAssets(before, Object.fromEntries(records.map(r => [r.host, r])));
    const snapshot = store.recordSnapshot(diff, req.gov);
    recordAudit(req.gov, 'asset.discovery_pass', 'asset', null, { hosts: records.length, ...diff });
    res.json({ ok: true, at: snapshot.at, hosts: records.length, diff, summary: assetSummary(store.read(), store.read().snapshots || []) });
  } catch (e) {
    res.status(502).json({ error: 'discovery_failed', message: String(e && e.message || e) });
  }
});

router.get('/changes', READ, (req, res) => {
  const snaps = (store.read().snapshots || []).slice().reverse();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  res.json({ changes: snaps.filter(s => s.added?.length || s.removed?.length || s.changed?.length).slice(0, limit) });
});

router.get('/report', READ, (_req, res) => {
  const db = store.read();
  res.type('text/markdown').send(weeklyReport(db, db.snapshots || []));
});

// Optional continuous inventory: runs only when seeds exist, never at startup.
const AUTO = process.env.ASSETS_AUTO_DISCOVER !== '0';
const INTERVAL_MS = Math.max(1, Number(process.env.ASSETS_INTERVAL_HOURS || 24)) * 3600000;
if (AUTO) {
  setInterval(async () => {
    try {
      const db = store.read();
      if (!(db.seeds || []).length) return;
      const before = db.assets || {};
      const records = await discover(db.seeds);
      store.savePass(records, { name: 'scheduler' });
      const diff = diffAssets(before, Object.fromEntries(records.map(r => [r.host, r])));
      store.recordSnapshot(diff, { name: 'scheduler' });
      recordAudit({ name: 'scheduler', role: 'system' }, 'asset.discovery_pass', 'asset', null, { ...diff, automated: true });
    } catch { /* next pass will retry */ }
  }, INTERVAL_MS).unref();
}

export default router;
