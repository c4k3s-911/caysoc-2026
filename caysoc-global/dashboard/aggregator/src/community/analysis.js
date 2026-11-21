// Pure classification, redaction and aggregation helpers for the community
// signal map. Public projections never include raw indicator values.
const DAY = 86400000;
const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

const RULES = [
  [/invoice|eft|payment|payment confirmation|bank detail/i, 'Invoice / EFT fraud'],
  [/courier|delivery|parcel|track your/i, 'Courier delivery scam'],
  [/sars|tax|refund|revenue/i, 'Tax refund impersonation'],
  [/eskom|municipality|utility|electricity|water account/i, 'Utility impersonation'],
  [/lottery|prize|winner|jackpot/i, 'Lottery / prize scam'],
  [/otp|one.?time pin|verify your bank|banking app/i, 'Bank OTP phishing'],
  [/job|employment|vacancy|hiring/i, 'Employment scam'],
  [/romance|dating|sugar/i, 'Romance scam'],
];

export function classify(value = '') {
  const text = String(value).toLowerCase();
  for (const [re, label] of RULES) if (re.test(text)) return label;
  return 'Other / unclassified';
}

export function redact(value = '', type = '') {
  const raw = String(value).trim();
  if (type === 'email_pattern' || raw.includes('@')) {
    const [u, d] = raw.replace(/^mailto:/i, '').split('@');
    return (u ? u.slice(0, 1) + '***' : '***') + '@' + (d ? d.split('.').slice(-2).join('.') : '***');
  }
  const host = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#\s]/)[0].toLowerCase();
  const parts = host.split('.').filter(Boolean);
  if (parts.length >= 2) return '***.' + parts.slice(-2).join('.');
  return '***';
}

function tally(rows, key) {
  const out = {};
  for (const r of rows) {
    const k = String(r[key] || 'unknown');
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export function publicSummary(db) {
  const all = db.indicators || [];
  const visible = all.filter(i => i.publicVisible);
  const now = Date.now();
  const week = all.filter(i => Date.parse(i.submittedAt) >= now - DAY * 7);
  const prev = all.filter(i => {
    const t = Date.parse(i.submittedAt);
    return t >= now - DAY * 14 && t < now - DAY * 7;
  });
  return {
    generated_at: new Date().toISOString(),
    governed: true,
    public_detail: false,
    safety_note: 'Aggregate counts only. No raw indicators, victim details or exploit content are published.',
    signals: {
      total: all.length,
      verified: visible.length,
      pending_review: all.length - visible.length,
      reports: all.reduce((n, i) => n + (i.reports || 0), 0),
    },
    by_type: tally(visible, 'type'),
    by_category: tally(visible, 'category'),
    by_severity: tally(visible, 'severity'),
    by_province: visible.reduce((out, i) => {
      for (const p of (i.provinces || [])) out[p] = (out[p] || 0) + 1;
      if (!(i.provinces || []).length) out.unspecified = (out.unspecified || 0) + 1;
      return out;
    }, {}),
    trend: { new_7d: week.length, new_previous_7d: prev.length, change_pct: pct(week.length - prev.length, Math.max(1, prev.length)) },
  };
}

export function internalView(db) {
  return (db.indicators || []).slice().reverse().map(i => ({
    id: i.id,
    type: i.type,
    category: i.category,
    severity: i.severity,
    redactedValue: redact(i.internalValue, i.type),
    provinces: i.provinces || [],
    verified: !!i.verified,
    publicVisible: !!i.publicVisible,
    reports: i.reports || 1,
    submittedAt: i.submittedAt,
    lastSeenAt: i.lastSeenAt,
    consent: !!i.consent,
  }));
}

export function weeklyReport(db) {
  const s = publicSummary(db);
  const top = Object.entries(s.by_category).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const sev = s.by_severity;
  return [
    '# SA Community Threat Pulse — Weekly',
    `Generated: ${s.generated_at} · Proudly South African · aggregate only`,
    '',
    `Verified public-safe signals: ${s.signals.verified} · pending review: ${s.signals.pending_review} · community reports: ${s.signals.reports}`,
    `New this week: ${s.trend.new_7d} (previous week ${s.trend.new_previous_7d}, ${s.trend.change_pct}% change)`,
    '',
    '## Top verified categories',
    ...(top.length ? top.map(([k, v]) => `- ${k}: ${v}`) : ['- no verified signals yet']),
    '',
    '## Severity mix',
    `- high: ${sev.high || 0} · medium: ${sev.medium || 0} · low: ${sev.low || 0}`,
    '',
    '## Provincial spread (verified)',
    ...(Object.keys(s.by_province).length ? Object.entries(s.by_province).map(([k, v]) => `- ${k}: ${v}`) : ['- none']),
    '',
    'All indicators are opt-in, deduplicated and reviewed before publication. Raw values, victim identities and exploit details are never published.',
  ].join('\n');
}
