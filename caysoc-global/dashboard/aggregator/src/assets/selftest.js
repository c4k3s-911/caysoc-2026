// Offline self-test: node src/assets/selftest.js
import { scoreExposure, daysToExpiry, diffAssets, weeklyReport, assetSummary } from './analysis.js';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };

const clean = {
  host: 'secure.example.co.za', status: 'resolved', ips: ['1.2.3.4'], owner: 'Sipho',
  tls: { ok: true, notAfter: new Date(Date.now() + 120 * 86400000).toUTCString(), selfSigned: false },
  http: { ok: true, status: 200, securityHeaders: { hsts: true, csp: true, nosniff: true, frame: true, referrer: true } },
};
const weak = {
  host: 'legacy.example.co.za', status: 'resolved', ips: ['5.6.7.8'], owner: 'Thandi',
  tls: { ok: true, notAfter: new Date(Date.now() + 10 * 86400000).toUTCString(), selfSigned: true },
  http: { ok: true, status: 200, server: 'Apache/2.4.1', securityHeaders: { hsts: false, csp: false, nosniff: false, frame: false, referrer: false } },
};

assert(scoreExposure(clean).score === 0 && scoreExposure(clean).severity === 'low', 'clean asset scores zero');
const w = scoreExposure(weak);
assert(w.score >= 75 && w.severity === 'critical', 'weak asset scores critical: ' + w.score);
assert(w.reasons.includes('missing HSTS') && w.reasons.includes('self-signed certificate'), 'exposure reasons listed');
assert(daysToExpiry(new Date(Date.now() + 86400000).toUTCString()) === 1, 'cert expiry days computed');

const prev = { 'a.za': { ips: ['1.1.1.1'], tls: { notAfter: 'old' }, status: 'resolved', http: { status: 200 } }, 'gone.za': {} };
const cur = { 'a.za': { ips: ['2.2.2.2'], tls: { notAfter: 'new' }, status: 'resolved', http: { status: 200 } }, 'new.za': {} };
const diff = diffAssets(prev, cur);
assert(diff.added.includes('new.za') && diff.removed.includes('gone.za'), 'added/removed detected');
assert(diff.changed[0].changes.includes('ip_changed') && diff.changed[0].changes.includes('certificate_changed'), 'changed fields detected');

const db = {
  seeds: [{ host: 'a.za' }],
  assets: { 'a.za': clean, 'b.za': weak },
  lastRun: { at: new Date().toISOString() },
};
const snaps = [{ at: new Date().toISOString(), added: ['b.za'], removed: [], changed: [] }];
const sum = assetSummary(db, snaps);
assert(sum.tracked === 2 && sum.new_7d === 1 && sum.expiring_30d === 1, 'summary totals');
const report = weeklyReport(db, snaps);
assert(report.includes('## New assets') && report.includes('b.za') && report.includes('Highest exposure'), 'weekly report content');
console.log('ALL ASSET SELFTESTS PASSED');
