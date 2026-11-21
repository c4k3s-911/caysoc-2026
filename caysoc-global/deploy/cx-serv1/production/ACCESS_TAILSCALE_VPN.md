# CaySoc Global Access Pattern - Paperclip (:3100) + Dashboard Aggregator (:4310)

**Default posture:** private access only. Bind `3100` (Paperclip) and `4310` (dashboard aggregator) to `127.0.0.1` on **cx-serv1 (192.168.0.4)**. Expose only through **Tailscale/VPN/LAN ACL + authenticated reverse proxy** or **SSH port forwarding**. **No public exposure by default.**

## Services
| Service | Default bind | Purpose | Notes |
|---|---:|---|---|
| Paperclip UI/API | `127.0.0.1:3100` | CaySoc Global control plane | Auth required; verify CSG company/routines before import |
| Dashboard aggregator | `127.0.0.1:4310` | `/api/csg/dashboard/*`, WS `/live` | Read-only aggregation; 0days data is governed/role-gated in UI design |
| Caddy (optional edge) | tailnet/VPN/internal only | TLS, auth, routing, headers | See `Caddyfile.tailscale-vpn.example` |

## Option 1 - Tailscale private access (recommended)
1. Install Tailscale on `cx-serv1` and trusted admin devices; confirm `tailscale status`.
2. Keep Paperclip/aggregator on localhost: `BIND=127.0.0.1` (aggregator `.env`), Paperclip host/port localhost/internal.
3. Use **Tailscale Serve** for a quick private path, or run **Caddy** on the tailnet interface/FQDN for explicit routing/auth/headers.
4. **Do not use Tailscale Funnel** for these services unless explicitly approved by CaySoc governance (Funnel makes services publicly reachable).
5. Restrict host firewall: allow 22/80/443 as needed only from trusted/tailnet sources; deny public `3100/4310`.
6. Add auth: Paperclip auth + proxy auth (`basic_auth` only as temporary baseline with strong bcrypt hash; prefer SSO/forward-auth/OAuth2 proxy for production).

## Option 2 - VPN / LAN ACL
- Place cx-serv1 behind VPN or trusted LAN segment.
- Publish Caddy only on VPN/LAN interface; use `tls internal` or org CA certs.
- Firewall: allow `3100/4310` only from `127.0.0.1`; allow proxy ports only from approved subnets/devices.
- Apply the same auth and governance controls.

## Option 3 - SSH local port forward (admin/break-glass)
```bash
ssh -L 3100:127.0.0.1:3100 -L 4310:127.0.0.1:4310 cx@192.168.0.4
# Paperclip:    http://127.0.0.1:3100
# Aggregator:   http://127.0.0.1:4310/api/csg/dashboard/overview
# Aggregator WS ws://127.0.0.1:4310/api/csg/dashboard/live
```
Use SSH keys; disable password auth after validation; rotate the shared `cx` credential.

## Firewall / network baseline (cx-serv1)
- `22/tcp` SSH: trusted admin/VPN/tailnet sources only; key auth; rate limits/fail2ban.
- `3100/tcp`, `4310/tcp`: **localhost only** (or blocked externally). No public security group/firewall allow.
- `80/443/tcp` (if Caddy used): only on tailnet/VPN/internal interface and only if required.
- Outbound: allow only what Paperclip/adapters need (package registries if required for ops windows, approved model gateways, approved read-only CayScaN endpoints). Prefer controlled egress.

## Verification
```bash
# on cx-serv1
ss -lntp | grep -E ':3100|:4310'   # should show 127.0.0.1 bindings
curl -sS http://127.0.0.1:4310/health
# from trusted tailnet/VPN client (after proxy configured)
curl -sS https://<private-host>/api/csg/dashboard/overview
```

## Governance
- CaySoc Global is proudly South African / non-state-affiliated; access controls must protect sensitive operational data.
- 0-day counts/valuation are governed metrics; sensitive exploit/target details are role-gated in UI/adapters.
- Ibhubesi/CayScaN/Cameradar offensive actions remain **authorized-lab only** with scope ref + human approval + evidence, independent of network reachability.
