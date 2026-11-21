# CaySoc Global - Paperclip Import (cx-serv1 schema-adapted)

**Target:** cx-serv1 `192.168.0.4`, Paperclip clone at `/home/cx/caysoc` (API expected `127.0.0.1:3100` when running). **API was not responding during inspection**; schemas were extracted from source (`packages/shared/src/{types,validators}`, `packages/db/src/schema`, `server/src/routes`). **Verify against the running build before applying.**

## Use these files
- `caysoc-global-cxserv1-schema.json` — inspected schema/endpoints/field mappings and critical differences.
- `caysoc-global-cxserv1-import.json` — ordered, API-aligned operations (find-or-create company, update/branding, goals, two-pass agents, routines + schedule triggers). Contains placeholders (`__VERIFY_ADAPTER__`, `__CONFIRM_EXISTING_OR_UPLOAD__`).
- `caysoc-global-import-bundle.json` — earlier generic template (kept for reference); prefer the cxserv1 files.

## Critical schema differences (live build)
1. **Company create is minimal** (`name, description, budgetMonthlyCents, attachmentMaxBytes, defaultResponsibleUserId`). Apply `status`, `brandColor`, `requireBoardApprovalForNewAgents`, budgets/feedback settings via **PATCH company**; apply branding via **PATCH /companies/:id/branding** where supported.
2. **Agent relations use UUIDs**. `reportsTo` (and assignee/owner refs elsewhere) must be existing UUIDs — import in dependency order and map symbolic keys to returned IDs.
3. **Routine cron is on triggers, not routines**. Create routine, then `POST /routines/:id/triggers` with `kind:"schedule"`, `cronExpression`, `timezone:"Africa/Johannesburg"`.
4. **Adapter type must exist** on target. Inspect installed adapters before setting `adapterType`/`adapterConfig`. Do not commit secrets.

## Existing CaySoc Global
`D:\Projects\0xsec.za\dashboard_data.json` indicates a CaySoc Global company may already exist (`a1b2c3d4-0001-4000-8000-000000000001`, `CAY`, `#1a73e8`). **Check live data first**:
```bash
curl -sS http://127.0.0.1:3100/api/companies   # or authenticated equivalent
```
If present, **merge/update** (goals/agents/routines/logos) rather than creating a duplicate.

## Portability import
The server also exposes company portability/import endpoints (`POST /api/companies/import`, company-scoped imports). If you prefer a single-package import, export a minimal company from the same running build and adapt the portability payload format; this is safer than guessing the full portability schema.

## Safety
- Backup DB/volumes/config before import.
- Human approval for high-stakes changes; Ibhubesi/CayScaN offensive capabilities remain gated.
- Keep `3100/4310` private (Tailscale/VPN/SSH), per `deploy/cx-serv1/production/ACCESS_TAILSCALE_VPN.md`.
