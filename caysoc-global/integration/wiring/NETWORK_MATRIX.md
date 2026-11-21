# Network/Firewall Matrix (baseline)

| Source | Dest | Port | Purpose | Allow |
|---|---|---|---|---|
| Trusted admin (tailnet/VPN/SSH forward) | cx-serv1 | 22/tcp | SSH (keys) | yes, restricted; rotate shared creds; disable password auth after validation |
| Trusted admin (tailnet/VPN) | cx-serv1 proxy | 443/tcp (or 80->443) | Private Caddy/Tailscale Serve entrypoint | yes, private only; **no Funnel/public** unless explicitly approved |
| `127.0.0.1` / proxy on cx-serv1 | cx-serv1 | 3100/tcp | Paperclip UI/API | localhost bind preferred; never public |
| `127.0.0.1` / proxy on cx-serv1 | cx-serv1 | 4310/tcp | Dashboard aggregator (`/api/csg/dashboard/*`, WS `/live`) | localhost bind preferred; never public |
| cx-serv1 | CayScaN legacy 192.168.7.3 | 8443/tcp or approved read port | read-only metrics | only if approved/segmented; no exploit control path |
| cx-serv1 | model gateway (local) | 20128/tcp | model routing | localhost/internal |
| Public / untrusted | cx-serv1 | 3100/4310/22 (except controlled) | direct exposure | **no** (default) |

See `deploy/cx-serv1/production/ACCESS_TAILSCALE_VPN.md` and `Caddyfile.tailscale-vpn.example`.
