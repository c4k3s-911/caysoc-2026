import { Router } from 'express';
import dns from 'dns/promises';
import { requireRole } from '../governance/auth.js';
import { recordAudit, listFindings } from '../governance/store.js';
import * as assetsStore from '../assets/store.js';
import * as complianceStore from '../compliance/store.js';
import { gaps as complianceGaps } from '../compliance/analysis.js';
import * as store from './store.js';
import { assess, portfolioSummary, report } from './assessment.js';

const router = Router();
const READ = requireRole('board', 'operator');
const WRITE = requireRole('board', 'operator');

async function emailAuth(domain) {
  if (!domain) return { spf: false, dmarc: false, checked: false };
  const txt = async name => {
    try { return await dns.resolveTxt(name); } catch { return []; }
  };
  const [root, dmarc] = await Promise.all([txt(domain), txt('_dmarc.' + domain)]);
  const flat = rows => rows.map(r => r.join('')).join(' ').toLowerCase();
  return {
    checked: true,
    spf: flat(root).includes('v=spf1'),
    dmarc: flat(dmarc).includes('v=dmarc1'),
  };
}

function clientAssets(client, all) {
  const hosts = new Set([...(client.hosts || []), client.domain].filter(Boolean));
  const values = Object.values(all || {});
  return values.filter(a => {
    if (hosts.has(a.host)) return true;
    if (client.domain && String(a.host).endsWith('.' + client.domain)) return true;
    return false;
  });
}

function latestByClient(snapshots) {
  const out = {};
  for (const s of snapshots) {
    if (!out[s.clientId] || Date.parse(s.at) > Date.parse(out[s.clientId].at)) out[s.clientId] = s;
  }
  return out;
}

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-sme-risk-pulse', mode: 'passive' }));

router.get('/clients', READ, (_req, res) => res.json({ clients: store.read().clients }));

router.post('/clients', WRITE, (req, res) => {
  const c = store.addClient(req.body || {}, req.gov);
  if (c.error) return res.status(400).json(c);
  recordAudit(req.gov, 'risk.client_added', 'client', c.id, { name: c.name, pack: c.pack });
  res.status(201).json(c);
});

router.delete('/clients/:id', WRITE, (req, res) => {
  const out = store.removeClient(req.params.id);
  recordAudit(req.gov, 'risk.client_removed', 'client', req.params.id, out);
  res.json(out);
});

router.get('/summary', READ, (_req, res) => {
  const db = store.read();
  const latest = latestByClient(db.snapshots);
  const assessments = db.clients.map(c => latest[c.id]).filter(Boolean)
    .map(s => ({ clientId: s.clientId, score: s.score, grade: s.grade, zarExposure: s.zarExposure, usdExposure: Math.round(s.zarExposure / Number(process.env.FX_USD_ZAR || 18.5)) }));
  res.json(portfolioSummary(db.clients, assessments));
});

router.get('/clients/:id', READ, (req, res) => {
  const db = store.read();
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found' });
  const trend = db.snapshots.filter(s => s.clientId === client.id).slice().reverse();
  const latest = trend[0] || null;
  res.json({ client, latest, trend: trend.slice(0, 20) });
});

router.post('/clients/:id/assess', WRITE, async (req, res) => {
  const db = store.read();
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found' });
  try {
    const assets = clientAssets(client, assetsStore.read().assets);
    const auth = await emailAuth(client.domain);
    const findings = listFindings(client.name);
    const gapCount = complianceGaps(complianceStore.read()).length;
    const result = assess(client, { assets, emailAuth: auth, findings, complianceGaps: gapCount, fx: Number(process.env.FX_USD_ZAR || 18.5) });
    const snapshot = store.saveSnapshot(client.id, result, req.gov);
    recordAudit(req.gov, 'risk.assessment_run', 'client', client.id, { score: result.score, grade: result.grade, zarExposure: result.zarExposure });
    res.json({ ...result, snapshotId: snapshot.id });
  } catch (e) {
    res.status(502).json({ error: 'assessment_failed', message: String(e && e.message || e) });
  }
});

router.get('/clients/:id/report', READ, (req, res) => {
  const db = store.read();
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found' });
  const trend = db.snapshots.filter(s => s.clientId === client.id).slice().reverse();
  const latest = trend[0];
  if (!latest) return res.status(404).json({ error: 'no_assessment', message: 'Run an assessment first.' });
  const assessment = {
    clientId: client.id,
    clientName: client.name,
    assessedAt: latest.at,
    score: latest.score,
    grade: latest.grade,
    factors: latest.factors || [],
    zarExposure: latest.zarExposure,
    usdExposure: Math.round(latest.zarExposure / Number(process.env.FX_USD_ZAR || 18.5)),
    fx: Number(process.env.FX_USD_ZAR || 18.5),
    assetsAssessed: latest.assetsAssessed ?? 0,
    controlledFindings: latest.controlledFindings ?? 0,
    note: 'Passive assessment: DNS, TLS metadata, response headers and governed internal registers.',
  };
  res.type('text/markdown').send(report(client, assessment, trend));
});

export default router;
