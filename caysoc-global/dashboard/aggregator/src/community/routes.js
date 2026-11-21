import { Router } from 'express';
import { requireRole, optionalAuth } from '../governance/auth.js';
import { recordAudit } from '../governance/store.js';
import * as store from './store.js';
import { publicSummary, internalView, weeklyReport, classify } from './analysis.js';

const router = Router();
const WRITE = requireRole('board', 'operator');

const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const t = Date.now();
  let e = hits.get(ip);
  if (!e || e.reset < t) { e = { count: 0, reset: t + 3600000 }; hits.set(ip, e); }
  if (e.count >= 10) return res.status(429).json({ error: 'rate_limited', message: 'Max 10 submissions per hour.' });
  e.count++;
  next();
}

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-community-signals', public_detail: false }));

router.get('/summary', (_req, res) => res.json(publicSummary(store.read())));

router.get('/report', (_req, res) => res.type('text/markdown').send(weeklyReport(store.read())));

router.post('/indicators', rateLimit, optionalAuth, (req, res) => {
  const body = req.body || {};
  if (!body.consent) return res.status(400).json({ error: 'consent_required', message: 'Opt-in consent is required to submit a signal.' });
  const input = { ...body, category: body.category || classify(body.value || ''), source: req.gov?.role === 'public' ? 'community' : (req.gov?.name || 'operator') };
  const result = store.addIndicator(input, req.ip || 'anonymous');
  if (result.error) return res.status(400).json(result);
  recordAudit(req.gov, 'community.signal_submitted', 'signal', result.id, { duplicate: result.duplicate, type: input.type, verified: false });
  res.status(result.duplicate ? 200 : 201).json({ ...result, publicVisible: false, message: 'Received for moderation. Nothing is published until verified.' });
});

router.get('/indicators', WRITE, (_req, res) => {
  const rows = internalView(store.read());
  res.json({ indicators: rows, count: rows.length, note: 'Values are redacted; raw indicators are internal-only.' });
});

router.get('/indicators/:id', WRITE, (req, res) => {
  const row = internalView(store.read()).find(i => i.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

router.post('/indicators/:id/verify', WRITE, (req, res) => {
  const i = store.verifyIndicator(req.params.id, req.gov);
  if (i.error) return res.status(404).json(i);
  recordAudit(req.gov, 'community.signal_verified', 'signal', i.id, { category: i.category, type: i.type });
  res.json(internalView(store.read()).find(x => x.id === i.id));
});

router.delete('/indicators/:id', WRITE, (req, res) => {
  const out = store.removeIndicator(req.params.id);
  recordAudit(req.gov, 'community.signal_removed', 'signal', req.params.id, out);
  res.json(out);
});

router.post('/report/publish', WRITE, (req, res) => {
  const entry = store.saveReport(weeklyReport(store.read()), req.gov);
  recordAudit(req.gov, 'community.report_published', 'report', entry.id, {});
  res.status(201).json(entry);
});

export default router;
