# CaySoc Global Host & Wiring Map

| Host | IP | Role | Notes |
|---|---|---|---|
| cx-serv1 | 192.168.0.4/24 (cx) | Paperclip (CSG), dashboard aggregator, secrets/env | Primary unified control plane. Harden + restrict 3100/4310. |
| CayScaN legacy | 192.168.7.3 (per local docs) | CaKeScaN sensors/dashboard/agents | Keep segmented; read-only metrics/alerts to CSG where approved. |
| HaCakeSec legacy | 192.168.0.7 (per hacakesec org map) | legacy Paperclip/company | Migrate/import into CSG; decommission after validation. |
| Operator/WKS | local | admin, God’s Eye client, PS1 bootstrap | Use VPN/Tailscale/SSH keys. |

## Data flows (governed)
- 0days (`D:\Projects\0xsec.za\0days`) / evidence -> aggregator (authorized, role-gated).
- Paperclip APIs (cx-serv1) -> aggregator -> dashboard UI.
- CayScaN metrics (8443/DB) -> read-only adapter -> aggregator (no exploit control path).
- God’s Eye -> separate viz service; approved/public layers; linked from CSG dashboards.
