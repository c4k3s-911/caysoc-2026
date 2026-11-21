# Merge Plan — existing CAY company `5ef64648-3fbd-4492-a973-0b6e35b34a17` (cx-serv1, **verified live 2026-11-08**)

**Verified:** private Paperclip returned CAY = **`5ef64648-3fbd-4492-a973-0b6e35b34a17`** (`CaySoc Global`, `CAY`, issueCounter 10, 11 agents, 2 routines). Historical stopped-container logs had referenced `41c10498...` — stale; **do not use**. **Merge/update only — never create a duplicate.**

## 0. Verify target
```bash
# via SSH forward: ssh -L 3100:127.0.0.1:3100 cx@192.168.0.4
export PC='http://127.0.0.1:3100'
export TOK='__AUTH_TOKEN__'   # obtain via your Paperclip auth flow if required; never commit
export CID='5ef64648-3fbd-4492-a973-0b6e35b34a17'
curl -sS -H "Authorization: Bearer $TOK" "$PC/api/companies" | jq '.[] | select(.id==env.CID or .issuePrefix=="CAY")'
```
Confirm `id`, `name`, `issuePrefix`, `status`, `brandColor`, `logoAssetId`, budgets before patching.

## 1. Company patch / branding (schema-adapted)
`createCompanySchema` is minimal; use PATCH/update + branding as supported.
```bash
curl -sS -X PATCH -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  "$PC/api/companies/$CID" \
  -d '{"status":"active","brandColor":"#1a73e8","requireBoardApprovalForNewAgents":true}'

curl -sS -X PATCH -H "Authorization: Bearer $TOK" -H 'Content-Type: application/json' \
  "$PC/api/companies/$CID/branding" \
  -d '{"name":"CaySoc Global","description":"CaySoc Global (CSG) — proudly South African","brandColor":"#1a73e8"}'
```
Set `logoAssetId` only after confirming/uploading the asset in this instance.

## 2. Goals (idempotent by title check)
```bash
curl -sS -H "Authorization: Bearer $TOK" "$PC/api/companies/$CID/goals" | jq .
# create missing goals via POST /api/companies/$CID/goals with {title,description,level,status}
```
Use goals from `caysoc-global-cxserv1-import.json`.

## 3. Agents (two-pass, UUID `reportsTo`)
```bash
# list existing
curl -sS -H "Authorization: Bearer $TOK" "$PC/api/companies/$CID/agents" | jq '.[]|{id,name,role,title,reportsTo,adapterType,status}'
# create missing in order: sipho -> thandi/anele/jabu/naledi/khaya -> lerato/nomsa_ops/zola_scan/mpho_dash/themba_evidence
# POST /api/companies/$CID/agents  (verify adapterType installed; replace __VERIFY_ADAPTER__)
# patch/set reportsTo with returned UUIDs if not set in create order
```
Ibhubesi-labeled: least privilege; `metadata.gated/policy` documented; offensive actions require scope + human approval.

## 4. Routines + schedule triggers (cron lives on trigger)
```bash
curl -sS -H "Authorization: Bearer $TOK" "$PC/api/companies/$CID/routines" | jq '.[]|{id,title,status}'
# POST /api/companies/$CID/routines  {title,description,status,priority,concurrencyPolicy,catchUpPolicy,assigneeAgentId?}
# then for each routine: POST /api/routines/$ROUTINE_ID/triggers
# {"kind":"schedule","label":"...","cronExpression":"0 8 * * *","timezone":"Africa/Johannesburg","enabled":true}
```

## 5. Validate
- No duplicate CaySoc Global company names/IDs.
- Agents/routines visible; routine `nextRunAt`/trigger schedule sane in SAST.
- Ibhubesi/Zola-Scan remain gated/read-only default as designed.
- Aggregator: set `PAPERCLIP_BASE_URL`, `PAPERCLIP_COMPANY_ID=41c10498-4d31-4f66-8f0c-b61058088b76`, `PAPERCLIP_ENABLED=1`, token via secret env; verify `/api/csg/dashboard/ops` shows `paperclip:ok/degraded` with diagnostics.

## Safety
- Private access only (SSH-forward/Tailscale/VPN+Caddy). No secrets in files.
- Human approval for high-stakes changes; Ibhubesi/CayScaN/Cameradar authorized-lab only (scope + approval + evidence).
