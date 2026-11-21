import { Router } from 'express';
import { requireRole } from '../governance/auth.js';
import { getFinding, recordAudit } from '../governance/store.js';
import * as store from './store.js';
import { evaluate, summary, gaps, exportReport } from './analysis.js';

const router = Router();
const READ = requireRole('board', 'operator');
const WRITE = requireRole('board', 'operator');

router.get('/health', (_req, res) => res.json({ ok: true, module: 'caysoc-compliance-evidence' }));

router.get('/summary', READ, (_req, res) => res.json(summary(store.read())));

router.get('/controls', READ, (_req, res) => res.json({ controls: evaluate(store.read()) }));

router.get('/controls/:id', READ, (req, res) => {
  const c = evaluate(store.read()).find(x => x.id === String(req.params.id).toUpperCase());
  if (!c) return res.status(404).json({ error: 'not_found' });
  res.json(c);
});

router.post('/controls', WRITE, (req, res) => {
  const c = store.addControl(req.body || {}, req.gov);
  if (c.error) return res.status(400).json(c);
  recordAudit(req.gov, 'compliance.control_added', 'control', c.id, { title: c.title });
  res.status(201).json(c);
});

router.get('/gaps', READ, (_req, res) => res.json({ gaps: gaps(store.read()) }));

router.get('/evidence', READ, (_req, res) => {
  const list = (store.read().evidence || []).slice().reverse();
  res.json({ evidence: list, count: list.length });
});

router.post('/evidence', WRITE, (req, res) => {
  const e = store.addEvidence(req.body || {}, req.gov);
  if (e.error) return res.status(400).json(e);
  recordAudit(req.gov, 'compliance.evidence_added', 'control', e.controlId, { evidenceId: e.id, source: e.source, sha256: e.sha256 });
  res.status(201).json(e);
});

router.post('/evidence/from-finding', WRITE, (req, res) => {
  const f = getFinding(String(req.body?.findingId || ''));
  if (!f) return res.status(404).json({ error: 'finding_not_found' });
  const e = store.linkFinding(f, req.gov);
  if (e.error) return res.status(400).json(e);
  recordAudit(req.gov, 'compliance.finding_linked', 'control', e.controlId, { evidenceId: e.id, finding: f.identifier });
  res.status(201).json({ ...e, finding: f.identifier });
});

router.delete('/evidence/:id', WRITE, (req, res) => {
  const out = store.removeEvidence(req.params.id);
  recordAudit(req.gov, 'compliance.evidence_removed', 'evidence', req.params.id, out);
  res.json(out);
});

router.get('/export', READ, (_req, res) => {
  res.type('text/markdown').send(exportReport(store.read()));
});

export default router;
