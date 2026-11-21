# CAY Merge Checklist (cx-serv1) — **LIVE CAY company `5ef64648-3fbd-4492-a973-0b6e35b34a17`** (verified 2026-11-08)

**Verified live (private Paperclip up):** `GET /api/companies` returns CAY = **`5ef64648-3fbd-4492-a973-0b6e35b34a17`** (`CaySoc Global`, `CAY`, issueCounter 10, 11 agents, 2 routines). Historical stopped-container logs had referenced `41c10498-4d31-4f66-8f0c-b61058088b76` — **do not use that stale ID**. **Merge/update only — do not create a duplicate CaySoc Global**.

## Preconditions
- [x] Paperclip running privately (SSH-forward, host `127.0.0.1:3100` only). Local-trusted API responsive.
- [x] Confirmed live CAY company: **`5ef64648-3fbd-4492-a973-0b6e35b34a17`** (`CaySoc Global`, CAY, issueCounter 10). **Not** `41c10498...` (stale log ref).
- [x] Backup complete (`/home/cx/caysoc/backups/caysoc-step3-20261108T171809Z`).
- [x] No secrets in import files/commits.
- [ ] Adapter verification/fixes (many existing agents are `opencode_local` with missing `adapterConfig.model`; treat as separate, careful config work).

## Executed merge operations (2026-11-08, idempotent/safe)
1. **Company patch+branding** — set CSG description (proudly SA, SAST/ZAR, legacy streams preserved), `brandColor=#1a73e8`. `logoAssetId` not set (upload/confirm asset first). `requireBoardApprovalForNewAgents` unchanged (false).
2. **Goals added** (3, no duplicates): `Unify CaySoc Global operations` (`c7a9ac72`), `Governed security & evidence pipeline` (`ffe4c53a`), `Unified dashboard and 0Day/ZAR telemetry` (`ff2e590d`). Existing goal preserved: `Build a SaaS product` (`95c4185a`, active).
3. **Agents — NOT blindly created**. CAY already has 11 agents (CEO `Chief of staff` `9310da54`, caysoc-cto/ciso/cfo/product/portfolio/comms/legal/board-sec, Summarizer, Reflection Coach). Blueprint’s Sipho/Thandi/Anele/etc. must be mapped/merged as metadata/title/reporting/legacyAlias updates, **not duplicates**. Ibhubesi remains gated by policy.
4. **Routines + SAST triggers added** (3, assigned `Chief of staff` `9310da54`):
   - `CSG Ops Heartbeat` (`7b8302c6`) — `0 */4 * * *` Africa/Johannesburg, enabled, nextRunAt `2026-11-08T18:00:00Z`.
   - `CSG Daily Status Digest` (`24539e31`) — `0 8 * * *` Africa/Johannesburg, nextRunAt `2026-11-09T06:00:00Z`.
   - `CSG Weekly Portfolio Review` (`dd739d24`) — `0 9 * * 1` Africa/Johannesburg, nextRunAt `2026-11-09T07:00:00Z`.
   Existing built-in routines preserved (reflection-coach/summarizer, triggers disabled/UTC).
5. **Validation**: company/goals/routines visible; SAST triggers present; **no duplicate CSG company**.

## Remaining (separate approvals/care)
- Map blueprint roles to existing agents (legacy aliases, Ibhubesi-gated capability markers) without breaking live config.
- Fix agent adapter configs (`opencode_local` model format etc.) deliberately; don’t auto-mutate secrets/models.
- Upload/set CaySoc Global logo asset (`logoAssetId`) after asset confirmation.
- Deploy aggregator (4310, private) on cx-serv1/Tailscale; set `PAPERCLIP_COMPANY_ID=5ef64648-3fbd-4492-a973-0b6e35b34a17`. Apply Caddy+Tailscale/VPN for 3100/4310.
- Monitor next auto backup for prior `EACCES` `.sql` issue.

## Governance
- Ibhubesi/CayScaN/Cameradar offensive actions: **authorized-lab only, scope ref + human approval + evidence**.
- 0days/valuation: governed/internal tracking; role-gated sensitive details.
- Keep 3100/4310 private (SSH-forward/Tailscale/VPN+Caddy). No Tailscale Funnel by default.

## Reference
- `caysoc-global-cxserv1-import.json` (update `companyId` target to `41c10498-4d31-4f66-8f0c-b61058088b76` during execution after verification)
- `caysoc-global-cxserv1-schema.json`
- `../dashboard/aggregator/src/adapters/paperclip.js` (prioritizes this CAY candidate)
