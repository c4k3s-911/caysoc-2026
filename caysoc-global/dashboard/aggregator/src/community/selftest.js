// Offline self-test: node src/community/selftest.js
import { classify, redact, publicSummary, internalView, weeklyReport } from './analysis.js';

const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok  ' + m); };

assert(classify('urgent invoice payment EFT confirmation').includes('Invoice'), 'EFT invoice classified');
assert(classify('track your courier parcel delivery').includes('Courier'), 'courier classified');
assert(classify('random noise') === 'Other / unclassified', 'unknown classified as other');
assert(redact('https://fake-invoice.example.co.za/login', 'phishing_domain') === '***.co.za', 'URL redacted to TLD');
assert(redact('scammer.victim@evil.co.za', 'email_pattern').includes('@'), 'email redacted');

const db = {
  indicators: [
    { id: 'SIG-1', fingerprintHash: 'a', internalValue: 'https://fake-invoice.evil.co.za', type: 'phishing_domain', category: 'Invoice / EFT fraud', severity: 'high', provinces: ['Gauteng'], verified: true, publicVisible: true, reports: 3, submittedAt: new Date().toISOString(), consent: true },
    { id: 'SIG-2', fingerprintHash: 'b', internalValue: 'sars-refund@scam.example.org', type: 'email_pattern', category: 'Tax refund impersonation', severity: 'medium', provinces: ['Western Cape'], verified: false, publicVisible: false, reports: 1, submittedAt: new Date().toISOString(), consent: true },
  ],
  reports: [],
};

const pub = publicSummary(db);
assert(pub.signals.total === 2 && pub.signals.verified === 1 && pub.signals.reports === 4, 'public summary counts');
assert(pub.public_detail === false && Object.keys(pub.by_category).length === 1, 'public exposes only verified aggregates');
const pubText = JSON.stringify(pub) + weeklyReport(db);
assert(!pubText.includes('evil.co.za') && !pubText.includes('scam.example.org'), 'no raw indicators in public output');

const internal = internalView(db);
assert(internal.length === 2 && internal.find(i => i.id === 'SIG-1').redactedValue === '***.co.za', 'internal view redacts values');
assert(!JSON.stringify(internal).includes('fake-invoice.evil.co.za'), 'raw value absent from internal projection');
console.log('ALL COMMUNITY SELFTESTS PASSED');
