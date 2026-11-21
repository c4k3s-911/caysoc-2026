# cx-serv1 (192.168.0.4) Hardening & Production Checklist - CaySoc Global

## Access
- [ ] Rotate shared `cx` password; create individual admin accounts where needed.
- [ ] Install SSH keys; disable password auth (`PasswordAuthentication no`) after validation; restrict sudo.
- [ ] Restrict SSH (firewall/VPN/Tailscale); fail2ban/rate limits.
- [ ] Paperclip `:3100` **not public by default**; bind localhost/internal and expose via VPN/Tailscale/reverse proxy.

## Secrets & config
- [ ] Rotate any previously exposed gateway/API keys; store in `.env`/secret manager (never commit).
- [ ] Strong `BETTER_AUTH_SECRET`; authenticated deployment mode; private exposure.
- [ ] Least-privilege model/provider keys per agent/project.

## Host & containers
- [ ] OS updates, Docker updates, minimal packages.
- [ ] Pin image tags/digests; scan images; `no-new-privileges`.
- [ ] Backups: Postgres + volumes + config exports; test restore.
- [ ] Logging/monitoring (disk, container health, Paperclip errors).

## CaySoc governance
- [ ] Import CSG blueprint; enable QA gates and human approvals for high-stakes actions.
- [ ] POPIA-aware data classification; restrict dataset access.
- [ ] CayScaN exploit/Cameradar paths gated (Ibhubesi, scope ref, approval, evidence).

## Network map (confirm)
- cx-serv1 `192.168.0.4`: Paperclip + dashboard aggregator (planned).
- Legacy CayScaN host (docs mention `192.168.7.3`): keep segmented; read-only metrics ingestion where approved.
