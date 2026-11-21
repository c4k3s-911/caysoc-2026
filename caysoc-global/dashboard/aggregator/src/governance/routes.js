import { Router } from 'express';
import { optionalAuth, requireRole, visibleFinding } from './auth.js';
import * as store from './store.js';

const router = Router();

const WRITE = requireRole('board', 'operator');
const BOARD = requireRole('board');
const READ = requireRole('board', 'operator', 'client');

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-governance', governed: true }));

router.get('/summary', optionalAuth, (_req, res) => res.json(store.summary()));

router.get('/whoami', optionalAuth, (req, res) => res.json({ ...req.gov, governed: true }));

router.get('/audit', READ, (req, res) => {
  const entries = store.listAudit(req.query.limit).filter(e => {
    if (req.gov.role !== 'client') return true;
    return String(e.details?.company || '').toLowerCase() === String(req.gov.company || '').toLowerCase();
  });
  res.json({ governed: true, entries, verified: store.verifyAudit() });
});

router.get('/audit/verify', READ, (_req, res) => res.json(store.verifyAudit()));

/* ---------------- scopes ---------------- */

router.get('/scopes', READ, (_req, res) => {
  const scopes = store.listScopes().map(s => ({ ...s, effective_status: store.effectiveStatus(s) }));
  res.json({ scopes });
});

router.post('/scopes', WRITE, (req, res) => {
  const s = store.createScope(req.body || {}, req.gov);
  res.status(201).json(s);
});

router.get('/scopes/:id', READ, (req, res) => {
  const s = store.getScope(req.params.id);
  if (!s) return res.status(404).json({ error: 'not_found' });
  res.json({ ...s, effective_status: store.effectiveStatus(s) });
});

router.post('/scopes/:id/approve', BOARD, (req, res) => {
  const s = store.approveScope(req.params.id, req.body || {}, req.gov);
  if (s.error) return res.status(400).json(s);
  res.json(s);
});

router.post('/scopes/:id/revoke', WRITE, (req, res) => {
  const s = store.revokeScope(req.params.id, req.gov);
  if (s.error) return res.status(404).json(s);
  res.json(s);
});

router.post('/scopes/:id/token', WRITE, (req, res) => {
  const t = store.mintToken(req.params.id, req.body || {}, req.gov);
  if (t.error) return res.status(400).json(t);
  res.status(201).json(t);
});

router.post('/check', WRITE, (req, res) => {
  const result = store.checkScope(req.body || {}, req.gov);
  res.status(result.allowed ? 200 : 403).json(result);
});

/* ---------------- findings ---------------- */

router.get('/findings', READ, (req, res) => {
  const findings = store.listFindings(req.gov.role === 'client' ? req.gov.company : null);
  res.json({ findings, count: findings.length });
});

router.post('/findings', WRITE, (req, res) => {
  const f = store.createFinding(req.body || {}, req.gov);
  res.status(201).json(f);
});

router.get('/findings/:id', READ, (req, res) => {
  const f = store.getFinding(req.params.id);
  if (!f || !visibleFinding(f, req.gov)) return res.status(404).json({ error: 'not_found' });
  res.json(f);
});

router.patch('/findings/:id', WRITE, (req, res) => {
  const f = store.updateFinding(req.params.id, req.body || {}, req.gov);
  if (f.error) return res.status(404).json(f);
  res.json(f);
});

router.post('/findings/:id/evidence', WRITE, (req, res) => {
  const e = store.addEvidence(req.params.id, req.body || {}, req.gov);
  if (e.error) return res.status(400).json(e);
  res.status(201).json(e);
});

export default router;
