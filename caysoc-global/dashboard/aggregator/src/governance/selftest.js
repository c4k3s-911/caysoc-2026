// Logic self-test (no HTTP, no external services):
//   GOV_DATA_DIR=<tmp> node src/governance/selftest.js
import path from 'path';
import os from 'os';
import fs from 'fs';

process.env.GOV_DATA_DIR = path.join(os.tmpdir(), 'caysoc-gov-selftest-' + Date.now());
const store = await import('./store.js');

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok  ' + msg); };
const actor = { name: 'selftest', role: 'board', id: 'selftest' };

const scope = store.createScope({
  name: 'Lab alpha', owner: 'Sipho Nkosi', purpose: 'authorized lab',
  targets: ['*.lab.caysoc.za', '192.168.100.50'],
  tools: ['cayscan', 'nmap'],
  window: { from: new Date(Date.now() - 60000).toISOString(), to: new Date(Date.now() + 3600000).toISOString() },
}, actor);
assert(scope.status === 'draft', 'scope created as draft');
assert(store.effectiveStatus(scope) === 'draft', 'draft stays draft');

const approved = store.approveScope(scope.id, { by: 'Board', ticket: 'AUTH-1' }, actor);
assert(approved.status === 'approved' && store.effectiveStatus(approved) === 'active', 'approval makes scope active');

const minted = store.mintToken(scope.id, { ttlSec: 300, maxUses: 2 }, actor);
assert(minted.token && minted.maxUses === 2, 'token minted');

const good = store.checkScope({ token: minted.token, target: 'router.lab.caysoc.za', tool: 'cayscan' }, actor);
assert(good.allowed && good.remaining === 1, 'in-scope check allowed');

const badTarget = store.checkScope({ token: minted.token, target: 'example.com', tool: 'cayscan' }, actor);
assert(!badTarget.allowed && badTarget.reason === 'target_out_of_scope', 'out-of-scope target denied');

const badTool = store.checkScope({ token: minted.token, target: '192.168.100.50', tool: 'metasploit' }, actor);
assert(!badTool.allowed && badTool.reason === 'tool_not_allowed', 'unlisted tool denied');

const second = store.checkScope({ token: minted.token, target: '192.168.100.50', tool: 'nmap' }, actor);
assert(second.allowed && second.remaining === 0, 'second valid check allowed; denials do not consume uses');

const third = store.checkScope({ token: minted.token, target: '192.168.100.50', tool: 'nmap' }, actor);
assert(!third.allowed && third.reason === 'token_exhausted', 'token use limit enforced');

const finding = store.createFinding({
  title: 'FRP bypass on lab handset', type: '0day', severity: 'high', company: '0xSec.za',
  scopeId: scope.id, authorization: 'AUTH-1', description: 'Verified on authorized lab device',
  valuation: { usdLow: 50000, usdHigh: 200000 },
}, actor);
assert(finding.identifier === 'GOV-0001' && finding.status === 'intake', 'finding intake with identifier');

const ev = store.addEvidence(finding.id, { filename: 'notes.txt', content: 'proof-of-concept transcript' }, actor);
assert(/^[a-f0-9]{64}$/.test(ev.sha256) && ev.byteSize > 0, 'evidence hashed');

const valued = store.updateFinding(finding.id, { status: 'validated', cvss: 7.8 }, actor);
assert(valued.status === 'validated' && valued.cvss === 7.8, 'finding triage/valuation update');

const sum = store.summary();
assert(sum.findings.total === 1 && sum.scopes.active_tokens >= 0 && sum.audit.scope_denials >= 3, 'summary aggregates');

const verify = store.verifyAudit();
assert(verify.ok && verify.count >= 10, 'audit hash chain verifies: ' + verify.count + ' events');

fs.rmSync(store.paths.DATA_DIR, { recursive: true, force: true });
console.log('ALL GOVERNANCE SELFTESTS PASSED');
