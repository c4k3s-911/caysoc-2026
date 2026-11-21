// Offline self-test: node src/risk/selftest.js
import { assess, portfolioSummary, report } from './assessment.js';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };
const client = { id: 'CL-TEST', name: 'Test SME', domain: 'test.co.za', pack: 'standard', monthlyFeeZar: 2500, owner: 'Sipho' };
const clean = assess(client, {
  assets: [{ host: 'test.co.za', status: 'resolved', exposure: { score: 0 }, certDays: 120, tls: { ok: true, selfSigned: false }, http: { status: 200 } }],
  emailAuth: { spf: true, dmarc: true }, findings: [], complianceGaps: 0, fx: 18.5,
});
assert(clean.score === 0 && clean.grade === 'A', 'clean portfolio scores A');

const risky = assess(client, {
  assets: [
    { host: 'test.co.za', status: 'resolved', exposure: { score: 80 }, certDays: -2, tls: { ok: true, selfSigned: true }, http: { status: 503 } },
    { host: 'old.test.co.za', status: 'unresolved', exposure: { score: 10 }, certDays: null, tls: {}, http: {} },
  ],
  emailAuth: { spf: false, dmarc: false },
  findings: [{ identifier: 'GOV-0001', title: 'Critical issue', severity: 'critical', status: 'validated', valuation: { usdHigh: 10000 } }],
  complianceGaps: 6,
  fx: 18.5,
});
assert(risky.score >= 80 && risky.grade === 'F', 'risky portfolio scores F: ' + risky.score);
assert(risky.factors.some(f => f.code === 'no_spf') && risky.factors.some(f => f.code === 'governed_finding'), 'remediation factors present');
assert(risky.usdExposure === 10000 && risky.zarExposure === 185000, 'ZAR/USD exposure computed from governed values');
assert(risky.factors[0].severity === 'critical', 'factors sorted by severity');

const sum = portfolioSummary([client], [clean, risky].map((a, i) => ({ ...a, clientId: 'CL-TEST', zarExposure: a.zarExposure, usdExposure: a.usdExposure })));
assert(sum.clients === 1 && sum.avgScore > 0 && sum.zarExposure === 185000, 'portfolio summary totals');

const md = report(client, risky, [{ score: 40 }, { score: risky.score }]);
assert(md.includes('SME Cyber Risk Pulse') && md.includes('R ') && md.includes('Top fixes') && md.includes('SAST'), 'report content');
console.log('ALL RISK SELFTESTS PASSED');
