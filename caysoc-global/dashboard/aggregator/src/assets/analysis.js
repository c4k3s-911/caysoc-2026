// Pure scoring / diff / report helpers for the Shadow Asset Monitor.
const DAY = 86400000;

export function daysToExpiry(value) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / DAY);
}

export function scoreExposure(asset) {
  let score = 0;
  const reasons = [];
  const http = asset.http || {}, sec = http.securityHeaders || {}, tls = asset.tls || {};
  if (asset.status === 'unresolved') { score += 10; reasons.push('DNS unresolved'); }
  if (http.ok) {
    if (!sec.hsts) { score += 12; reasons.push('missing HSTS'); }
    if (!sec.csp) { score += 10; reasons.push('missing CSP'); }
    if (!sec.nosniff) { score += 8; reasons.push('missing X-Content-Type-Options'); }
    if (!sec.frame) { score += 8; reasons.push('missing X-Frame-Options'); }
    if (!sec.referrer) { score += 4; reasons.push('missing Referrer-Policy'); }
    if (http.server && /\d/.test(String(http.server))) { score += 8; reasons.push('server version disclosed'); }
    if (http.poweredBy) { score += 6; reasons.push('framework disclosed'); }
  }
  if (tls.ok) {
    if (tls.selfSigned) { score += 15; reasons.push('self-signed certificate'); }
    const days = daysToExpiry(tls.notAfter);
    if (days !== null && days < 0) { score += 25; reasons.push('certificate expired'); }
    else if (days !== null && days < 30) { score += 20; reasons.push('certificate expires within 30 days'); }
    else if (days !== null && days < 60) { score += 10; reasons.push('certificate expires within 60 days'); }
  }
  score = Math.min(100, score);
  return { score, severity: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', reasons };
}

export function diffAssets(previous, current) {
  const prev = previous || {}, cur = current || {};
  const added = Object.keys(cur).filter(h => !prev[h]);
  const removed = Object.keys(prev).filter(h => !cur[h]);
  const changed = [];
  for (const host of Object.keys(cur)) {
    if (!prev[host]) continue;
    const a = prev[host], b = cur[host], changes = [];
    if (JSON.stringify(a.ips) !== JSON.stringify(b.ips)) changes.push('ip_changed');
    if (a.tls?.notAfter !== b.tls?.notAfter) changes.push('certificate_changed');
    if (a.status !== b.status) changes.push('status_changed:' + b.status);
    if (a.http?.status !== b.http?.status) changes.push('http_status_changed');
    if (changes.length) changed.push({ host, changes });
  }
  return { added, removed, changed };
}

export function enrichAssets(assets) {
  return Object.values(assets || {}).map(a => {
    const exposure = scoreExposure(a);
    return {
      ...a,
      exposure,
      certDays: daysToExpiry(a.tls?.notAfter),
      ip: (a.ips || [])[0] || null,
      httpsStatus: a.http?.status ?? null,
    };
  }).sort((x, y) => y.exposure.score - x.exposure.score);
}

export function assetSummary(db, snapshots = []) {
  const assets = enrichAssets(db.assets || {});
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const a of assets) bySeverity[a.exposure.severity]++;
  const week = snapshots.filter(s => Date.parse(s.at) >= Date.now() - 7 * DAY);
  return {
    generated_at: new Date().toISOString(),
    governed: true,
    tracked: assets.length,
    seeds: (db.seeds || []).length,
    resolved: assets.filter(a => a.status === 'resolved').length,
    unresolved: assets.filter(a => a.status === 'unresolved').length,
    by_severity: bySeverity,
    expiring_30d: assets.filter(a => a.certDays !== null && a.certDays >= 0 && a.certDays < 30).length,
    new_7d: week.reduce((n, s) => n + (s.added?.length || 0), 0),
    changed_7d: week.reduce((n, s) => n + (s.changed?.length || 0), 0),
    last_run: db.lastRun || null,
    snapshots: snapshots.length,
  };
}

export function weeklyReport(db, snapshots = []) {
  const since = Date.now() - 7 * DAY;
  const week = snapshots.filter(s => Date.parse(s.at) >= since);
  const added = new Set(), removed = new Set(), changed = new Map();
  for (const s of week) {
    (s.added || []).forEach(h => added.add(h));
    (s.removed || []).forEach(h => { removed.add(h); added.delete(h); });
    (s.changed || []).forEach(c => {
      if (!changed.has(c.host)) changed.set(c.host, new Set());
      c.changes.forEach(x => changed.get(c.host).add(x));
    });
  }
  const assets = enrichAssets(db.assets || {});
  const lines = [
    '# CaySoc Shadow Asset — Weekly Delta',
    `Generated: ${new Date().toISOString()}`,
    `Window: last 7 days · ${week.length} discovery pass(es)`,
    '',
    `Tracked assets: ${assets.length} · new: ${added.size} · removed: ${removed.size} · changed: ${changed.size}`,
    '',
    '## New assets',
    added.size ? [...added].map(h => `- ${h}`).join('\n') : '- none',
    '',
    '## Removed assets',
    removed.size ? [...removed].map(h => `- ${h}`).join('\n') : '- none',
    '',
    '## Changed assets',
    changed.size ? [...changed].map(([h, c]) => `- ${h}: ${[...c].join(', ')}`).join('\n') : '- none',
    '',
    '## Certificates expiring within 30 days',
    assets.filter(a => a.certDays !== null && a.certDays >= 0 && a.certDays < 30).map(a => `- ${a.host}: ${a.certDays} days (${a.owner})`).join('\n') || '- none',
    '',
    '## Highest exposure',
    assets.slice(0, 10).map(a => `- ${a.host}: ${a.exposure.score}/100 (${a.exposure.severity}) — ${a.exposure.reasons.join(', ') || 'no findings'}`).join('\n') || '- none',
    '',
    'Passive inventory only — DNS, TLS certificate metadata and GET / response headers. Authorized/internal tracking.',
  ];
  return lines.join('\n');
}
