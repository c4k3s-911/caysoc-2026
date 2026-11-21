# CaySoc Dashboard Aggregator (scaffold)

Normalizes 0days + Paperclip + CayScaN into `../dashboard-data-contract.json` and serves CaySoc dashboard APIs.

## Run (mock)
```bash
cd D:/Projects/paperclip/caysoc-global/dashboard/aggregator
cp .env.example .env   # set CAYSOC_MOCK=1
npm install
npm run mock
# GET http://127.0.0.1:4310/api/csg/dashboard/overview
# WS  ws://127.0.0.1:4310/api/csg/dashboard/live
```

## Live adapters (TODO)
Wire in `src/server.js` (verify against your Paperclip version):
- Paperclip: companies/agents/issues/routines/budgets/auth.
- CayScaN: read-only metrics/alerts.
- 0days: parse `0xsec.za/0days/_index.md` + records for counts/valuation (ZAR primary).
Governance: role-gate sensitive details; authorized/internal tracking only.
