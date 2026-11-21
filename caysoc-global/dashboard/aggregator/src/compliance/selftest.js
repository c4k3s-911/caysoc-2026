// Offline self-test: node src/compliance/selftest.js
import { evaluate, summary, gaps, exportReport } from './analysis.js';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };
const ago = d => new Date(Date.now() - d * 86400000).toISOString();
const db = {
  controls: [
    { id: 'AC-01', domain: 'Access control', title: 'Access review', reference: 'POPIA 19(1) · ISO 27001 A.5.15', frequencyDays: 90, owner: 'Sipho', active: true },
    { id: 'BK-01', domain: 'Resilience', title: 'Backup test', reference: 'ISO 27001 A.8.13', frequencyDays: 30, owner: 'Nomsa', active: true },
    { id: 'TR-01', domain: 'People', title: 'Training', reference: 'POPIA 19(1)', frequencyDays: 365, owner: 'Lerato', active: true },
  ],
  evidence: [
    { id: 'EV-1', controlId: 'AC-01', title: 'Q3 access review', source: 'manual', observedAt: ago(10), validUntil: null, sha256: 'a'.repeat(64) },
    { id: 'EV-2', controlId: 'BK-01', title: 'Old restore test', source: 'manual', observedAt: ago(120), validUntil: null, sha256: 'b'.repeat(64) },
  ],
};

const ev = evaluate(db);
assert(ev.find(c => c.id === 'AC-01').status === 'current', 'fresh evidence => current');
assert(ev.find(c => c.id === 'BK-01').status === 'stale' && ev.find(c => c.id === 'BK-01').daysOverdue > 0, 'old evidence => stale with overdue days');
assert(ev.find(c => c.id === 'TR-01').status === 'missing', 'no evidence => missing');
assert(ev[0].status === 'missing', 'gaps sort first');

const s = summary(db);
assert(s.controls === 3 && s.by_status.current === 1 && s.by_status.stale === 1 && s.by_status.missing === 1, 'summary counts');
assert(s.coverage_pct === 33 && s.frameworks.both === 1 && s.frameworks.POPIA === 1 && s.frameworks.ISO27001 === 1, 'coverage and framework mapping');
assert(s.evidence.hashed === 2, 'evidence hash count');

const g = gaps(db);
assert(g.length === 2 && g.some(x => x.id === 'BK-01'), 'gap list excludes current controls');

const report = exportReport(db);
assert(report.includes('Compliance Evidence Register') && report.includes('AC-01') && report.includes('sha256='), 'export report content');
console.log('ALL COMPLIANCE SELFTESTS PASSED');
