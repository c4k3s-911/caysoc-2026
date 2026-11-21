# CayScaN / Cay_Web_Scan Integration (Isivikelo + gated Ibhubesi Lab)

## Source
- `D:\Projects\Hermes_26\Cay_Web_Scan` (CaKeScaN dashboard v2, Hermes skills, Paperclip agents, sensors: Suricata/Zeek/Falco/auditd).
- Agents: recon, monitor, respond, exploit (human-gated), blueteam, traceback.

## CaySoc mapping
| CayScaN component | CaySoc division | Notes |
|---|---|---|
| Monitor/respond/blueteam/traceback | Isivikelo - Defence & Platform | Operational pipeline; alerts -> Paperclip tasks. |
| Recon | Isibani/Isivikelo (authorized scope) | Approved targets/domains only; evidence logged. |
| Exploit/ad-hoc offensive | Ibhubesi Lab (Authorized Testing) | **Human approval + scope reference required**. No autonomous exploitation. |
| Dashboard/KB/RAG/metrics | Isivikelo platform | Link status into CaySoc dashboards; keep auth/JWT/RBAC. |

## Steps
1. Inventory current CayScaN runtime (legacy docs mention `192.168.7.3`); decide keep as segmented node or migrate components near cx-serv1.
2. Register `CayScaN Platform` project in CaySoc Global (CSG) with task templates.
3. Wire outputs to evidence store (artifact path/hash, actor, scope, QA status).
4. Gate exploit/ad-hoc routes; normalize secrets/models via cx-serv1 env/secret store.
