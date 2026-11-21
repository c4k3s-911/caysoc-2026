# CaySoc Global Unification Pack (Proudly South African)

Generated: 2026-11-08T16:26:06.346720+00:00
Target VPS for Paperclip: **cx-serv1 192.168.0.4** (user `cx`).

## Contents
1. `deploy/cx-serv1/` - safe Linux deployment files (no hardcoded secrets), PS1 bootstrap, compose, env example.
2. `blueprint/` - CaySoc Global company blueprint (JSON + Markdown): 6 divisions, core roles, governance, routines (SAST), legacy streams.
3. `branding/` - asset manifest and unification rules referencing:
   - `D:\caysoc\logo - badge`
   - `D:\Projects\0xsec.za\Logos\paperclip_logos_2026`
4. `registry/` - legacy alias registry generated from HaCakeSec, 0xSec/Caelum/xploit HR + paperclip agents, CayScaN.
5. `integration/` - CayScaN, God's Eye, Hermes-Paperclip adapter, Cameradar (gated) integration docs.

## Unified structure
- 1 company: **CaySoc Global (CSG)**
- 6 divisions: Indaba, Isibani, Umlenze, Isivikelo, Ibhubesi Lab (gated), Isiqiniseko
- ~11 core roles + shared utilities; legacy codenames preserved as aliases
- Governance: agent -> QA -> artifact/vault; human approval for high-stakes; authorized scope only.

## Security notes
- Rotate shared credentials/API keys before production use.
- Restrict Paperclip/UI ports; use SSH keys; POPIA-aware data classification.
- Offensive tooling (CayScaN exploit paths, Cameradar) is authorized-lab only.

6. `dashboard/` - Unified dashboard spec (CaySoc Global + HaCakeSec/0xSec/Caelum/xploit/CayScaN), realtime 0Day counts + ZAR valuation, data contract, mock payload, metrics.
