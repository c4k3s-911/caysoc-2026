// Pure evaluation helpers for the Compliance Evidence Collector.
const DAY = 86400000;
const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

export function evaluate(db) {
  const now = Date.now();
  return (db.controls || []).filter(c => c.active !== false).map(c => {
    const list = (db.evidence || []).filter(e => e.controlId === c.id)
      .sort((a, b) => Date.parse(b.observedAt || 0) - Date.parse(a.observedAt || 0));
    const latest = list[0] || null;
    const ageDays = latest ? Math.floor((now - Date.parse(latest.observedAt || 0)) / DAY) : null;
    const expired = !!(latest?.validUntil && Date.parse(latest.validUntil) < now);
    const status = !latest ? 'missing' : (expired || ageDays > c.frequencyDays) ? 'stale' : 'current';
    const daysOverdue = status === 'stale' ? Math.max(1, ageDays - c.frequencyDays) : 0;
    return {
      ...c,
      status,
      daysOverdue,
      evidenceCount: list.length,
      ageDays,
      latest: latest ? {
        id: latest.id, title: latest.title, source: latest.source, uri: latest.uri,
        observedAt: latest.observedAt, validUntil: latest.validUntil,
        sha256: latest.sha256, addedBy: latest.addedBy,
      } : null,
    };
  }).sort((a, b) => {
    const rank = { missing: 0, stale: 1, current: 2 };
    return rank[a.status] - rank[b.status] || b.daysOverdue - a.daysOverdue;
  });
}

export function summary(db) {
  const controls = evaluate(db);
  const byStatus = { current: 0, stale: 0, missing: 0 };
  const byDomain = {};
  const frameworks = { POPIA: 0, ISO27001: 0, both: 0 };
  for (const c of controls) {
    byStatus[c.status]++;
    if (!byDomain[c.domain]) byDomain[c.domain] = { total: 0, current: 0 };
    byDomain[c.domain].total++;
    if (c.status === 'current') byDomain[c.domain].current++;
    const hasPopia = /popia/i.test(c.reference);
    const hasIso = /iso/i.test(c.reference);
    if (hasPopia && hasIso) frameworks.both++;
    else if (hasPopia) frameworks.POPIA++;
    else if (hasIso) frameworks.ISO27001++;
  }
  const evidence = db.evidence || [];
  return {
    generated_at: new Date().toISOString(),
    governed: true,
    controls: controls.length,
    by_status: byStatus,
    coverage_pct: pct(byStatus.current, controls.length),
    by_domain: Object.entries(byDomain).map(([domain, v]) => ({ domain, ...v, coverage_pct: pct(v.current, v.total) })),
    frameworks,
    evidence: {
      total: evidence.length,
      hashed: evidence.filter(e => !!e.sha256).length,
      linked: evidence.filter(e => e.source === 'governance-finding').length,
      expiring_30d: evidence.filter(e => e.validUntil && Date.parse(e.validUntil) - Date.now() < 30 * DAY && Date.parse(e.validUntil) > Date.now()).length,
    },
  };
}

export function gaps(db) {
  return evaluate(db).filter(c => c.status !== 'current').map(c => ({
    id: c.id, title: c.title, domain: c.domain, owner: c.owner,
    status: c.status, daysOverdue: c.daysOverdue, frequencyDays: c.frequencyDays,
    reference: c.reference,
  }));
}

export function exportReport(db) {
  const controls = evaluate(db);
  const s = summary(db);
  const lines = [
    '# CaySoc Global — Compliance Evidence Register',
    `Generated: ${s.generated_at} · Governed / internal`,
    '',
    `Controls: ${s.controls} · coverage: ${s.coverage_pct}% · current: ${s.by_status.current} · stale: ${s.by_status.stale} · missing: ${s.by_status.missing}`,
    `Evidence records: ${s.evidence.total} (${s.evidence.hashed} SHA-256 hashed, ${s.evidence.linked} linked governed findings)`,
    '',
    '## Control status',
    '',
    '| Control | Domain | Requirement | Framework ref | Owner | Status | Last evidence | Age (d) |',
    '|---|---|---|---|---|---|---|---|',
    ...controls.map(c => `| ${c.id} | ${c.domain} | ${c.title} | ${c.reference} | ${c.owner} | ${c.status} | ${c.latest ? c.latest.observedAt.slice(0, 10) : '—'} | ${c.ageDays ?? '—'} |`),
    '',
    '## Outstanding gaps',
    '',
    (gaps(db).map(g => `- ${g.id} ${g.title} — ${g.status}${g.daysOverdue ? ` (${g.daysOverdue}d overdue)` : ''} · owner: ${g.owner}`).join('\n') || '- none'),
    '',
    '## Evidence log',
    '',
    ((db.evidence || []).slice().reverse().map(e => `- ${e.id} · ${e.controlId} · ${e.title} · ${e.source} · ${e.observedAt.slice(0, 10)} · sha256=${e.sha256 ? e.sha256.slice(0, 16) : 'n/a'}`).join('\n') || '- none'),
    '',
    'Mapped to POPIA and ISO 27001 Annex A controls. Evidence hashes are verifiable against the governed register.',
  ];
  return lines.join('\n');
}
