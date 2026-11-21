// Pure risk scoring, remediation planning and reporting. No network calls here.
const cap = (n, max) => Math.max(0, Math.min(max, n));
const grade = s => s >= 80 ? 'F' : s >= 65 ? 'D' : s >= 50 ? 'C' : s >= 35 ? 'B' : 'A';
const ZAR = n => 'R ' + Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 0 });
const USD = n => '$ ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export function assess(client, inputs = {}) {
  const { assets = [], emailAuth = {}, findings = [], complianceGaps = 0, fx = 18.5 } = inputs;
  const factors = [];
  let score = 0;

  let assetPoints = 0;
  for (const a of assets) {
    assetPoints += cap(Number(a.exposure?.score || 0) * 0.2, 20);
    if (a.status === 'unresolved') { assetPoints += 10; factors.push({ code: 'dns_unresolved', severity: 'medium', host: a.host, detail: 'Host does not resolve publicly', action: 'Verify the hostname is correct, or decommission the stale DNS record.' }); }
    if (a.tls?.selfSigned) { assetPoints += 8; factors.push({ code: 'self_signed', severity: 'medium', host: a.host, detail: 'Self-signed TLS certificate', action: 'Install a valid CA-issued certificate (Let’s Encrypt is sufficient).' }); }
    if (a.certDays !== null && a.certDays !== undefined && a.certDays < 30) {
      assetPoints += a.certDays < 0 ? 12 : 6;
      factors.push({ code: 'cert_expiry', severity: a.certDays < 0 ? 'high' : 'medium', host: a.host, detail: a.certDays < 0 ? 'Certificate expired' : `Certificate expires in ${a.certDays} days`, action: 'Renew and automate certificate renewal.' });
    }
    if (a.http?.status >= 500) { assetPoints += 6; factors.push({ code: 'http_error', severity: 'low', host: a.host, detail: `HTTP ${a.http.status} on public endpoint`, action: 'Investigate the application error and restore a healthy response.' }); }
  }
  score += cap(assetPoints, 35);

  if (!emailAuth.spf) { score += 15; factors.push({ code: 'no_spf', severity: 'high', detail: 'No SPF record published', action: 'Publish an SPF TXT record listing authorised mail senders.' }); }
  if (!emailAuth.dmarc) { score += 12; factors.push({ code: 'no_dmarc', severity: 'high', detail: 'No DMARC record published', action: 'Publish a DMARC record starting at p=none, then move to p=quarantine.' }); }

  let findingPoints = 0;
  for (const f of findings) {
    const pts = { critical: 20, high: 12, medium: 6, low: 2 }[f.severity] || 2;
    findingPoints += pts;
    factors.push({ code: 'governed_finding', severity: f.severity, detail: `${f.identifier} ${f.title} (${f.status})`, action: 'Track through the governed remediation workflow with an owner and due date.' });
  }
  score += cap(findingPoints, 40);

  if (complianceGaps > 0) {
    score += cap(complianceGaps * 2, 20);
    factors.push({ code: 'compliance_gaps', severity: 'medium', detail: `${complianceGaps} open compliance evidence gaps`, action: 'Close the highest-risk gaps in the Compliance Evidence register first.' });
  }

  score = Math.round(cap(score, 100));
  const usdExposure = findings.filter(f => !['rejected', 'disclosed', 'done'].includes(String(f.status).toLowerCase()))
    .reduce((n, f) => n + Number(f.valuation?.usdHigh || 0), 0);

  const priority = { critical: 0, high: 1, medium: 2, low: 3 };
  factors.sort((a, b) => (priority[a.severity] ?? 9) - (priority[b.severity] ?? 9));

  return {
    clientId: client.id,
    clientName: client.name,
    assessedAt: new Date().toISOString(),
    score,
    grade: grade(score),
    factors,
    assetsAssessed: assets.length,
    controlledFindings: findings.length,
    usdExposure,
    zarExposure: Math.round(usdExposure * fx),
    fx,
    note: 'Passive assessment: DNS, TLS metadata, response headers and governed internal registers. No active scanning or exploitation.',
  };
}

export function portfolioSummary(clients, assessments) {
  const rows = assessments.filter(a => clients.some(c => c.id === a.clientId));
  const avg = rows.length ? Math.round(rows.reduce((n, a) => n + a.score, 0) / rows.length) : 0;
  return {
    generated_at: new Date().toISOString(),
    governed: true,
    clients: clients.length,
    assessed: rows.length,
    avgScore: avg,
    highRisk: rows.filter(a => a.score >= 65).length,
    zarExposure: rows.reduce((n, a) => n + a.zarExposure, 0),
    usdExposure: rows.reduce((n, a) => n + a.usdExposure, 0),
  };
}

export function report(client, assessment, trend = []) {
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta = prev ? assessment.score - prev.score : null;
  const lines = [
    `# SME Cyber Risk Pulse — ${client.name}`,
    `Generated: ${new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Johannesburg' })} SAST · governed / internal`,
    '',
    `**Risk score: ${assessment.score}/100 (grade ${assessment.grade})**` + (delta === null ? '' : ` · ${delta >= 0 ? '+' : ''}${delta} vs previous assessment`),
    `Estimated governed exposure: **${ZAR(assessment.zarExposure)}** (${USD(assessment.usdExposure)} secondary at ${assessment.fx})`,
    '',
    `Assets assessed: ${assessment.assetsAssessed ?? 0} · governed findings: ${assessment.controlledFindings ?? 0} · package: ${client.pack} · owner: ${client.owner}`,
    '',
    '## What this means',
    assessment.score >= 65
      ? 'Material risk is present. Prioritise the actions below this week and assign an owner to each.'
      : assessment.score >= 35
        ? 'A reasonable baseline with clear improvements available. Work through the actions below in priority order.'
        : 'Good baseline hygiene. Keep monitoring and close the remaining items as routine maintenance.',
    '',
    '## Top fixes (priority order)',
    ...(assessment.factors.length
      ? assessment.factors.slice(0, 10).map((f, i) => `${i + 1}. **[${f.severity.toUpperCase()}]${f.host ? ' ' + f.host : ''}** — ${f.detail}. ${f.action}`)
      : ['- No findings from passive checks or governed registers.']),
    '',
    '## Scope and governance',
    assessment.note,
    `Risk figures are derived from governed internal data; 0-day detail remains role-gated. Monthly package fee: ${ZAR(client.monthlyFeeZar)}.`,
  ];
  return lines.join('\n');
}
