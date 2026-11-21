# cx-serv1 Paperclip Inspection (read-only, 2026-11-08)

Target: `cx@192.168.0.4` (`cxserv1`, Ubuntu 24.04, Docker 29.9.2). Access used for inspection: WSL Kali `sshpass`/SSH (authorized by user).

## Findings
- `/home/cx/caysoc/docker-compose.paperclip.yml` exists; `docker compose ps` showed **no running services**. `ss` showed **no 3100/5432/4310 listeners**.
- Image present: `caysoc-paperclip:latest` (8 days ago). Volume present: `paperclip-data` (external). Network present: `caysoc_default`.
- Stopped containers: `paperclip` **Exited (1) 6 days ago** (`caysoc-paperclip:latest`), `paperclip-fixed` Exited (1) 6 days ago.
- `paperclip` logs show it previously served successfully, including **`GET /CAY/dashboard 200`**, `GET /issues/CAY-1 200`, and company-scoped APIs for **company `41c10498-4d31-4f66-8f0c-b61058088b76`** (treat as the live CAY/CaySoc Global target until verified otherwise). It later crashed with `EACCES: permission denied, open '/paperclip/instances/default/data/backups/paperclip-20261101-231407.sql'` during automatic DB backup.
- `paperclip-fixed` failed with `connect ECONNREFUSED 172.18.0.2:54329` (DB connectivity/config mismatch) — do not assume it is the correct recovery path.
- Data volume contains `instances/default/config.json` and cache/config files (Oct 30–31). State appears present; handle carefully.

## Exposure / security risks in existing compose (address before restart)
- Publishes `3100:3100` and runs `paperclip-expose` (socat sidecar) that binds host-side access — **not aligned with private Tailscale/VPN/localhost posture**.
- Contains hardcoded `BETTER_AUTH_SECRET`, `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`, and a LAN/public-style `PAPERCLIP_PUBLIC_URL` (`http://192.168.0.10:3100`) — **rotate/move to env/secret store; never commit**.
- `HOST`/bind behavior is mixed (`HOST=0.0.0.0` plus loopback/bind settings and expose sidecar). Verify effective bind after any change.

## Safe next steps (operator-approved)
1. **Backup first:** snapshot/backup `paperclip-data` volume and `/paperclip/instances/default/*` (especially config/data) before restart or repair.
2. **Rotate secrets:** replace hardcoded auth/signing secrets; update `.env.paperclip.private` (or equivalent secret mechanism).
3. **Fix backup permission root cause** (EACCES on `instances/default/data/backups`) before relying on scheduled backups — inspect ownership/perms inside volume; align container UID/GID and backup dir perms. Test restore.
4. **Restart privately:** prefer `docker-compose.paperclip.private.yml` pattern (no `3100:3100` publish, no socat expose). Access via SSH forward first, then Tailscale/VPN + Caddy per `ACCESS_TAILSCALE_VPN.md`.
5. **Verify CAY company after restart:** `GET /api/companies` (authenticated) and confirm company `41c10498-4d31-4f66-8f0c-b61058088b76` / CAY is CaySoc Global. Use it as merge target for `blueprint/paperclip-import/caysoc-global-cxserv1-import.json`; **do not create a duplicate**.
6. **Run cxserv1 import carefully:** two-pass agents (UUID `reportsTo`), routine schedules as triggers (`Africa/Johannesburg`), verify adapters, no secrets in import files.

## (b) Import target update
Discovered live company reference in logs: **`41c10498-4d31-4f66-8f0c-b61058088b76` (CAY dashboard, issue CAY-1)**. Update the cxserv1 import execution plan to resolve/merge this company first.
