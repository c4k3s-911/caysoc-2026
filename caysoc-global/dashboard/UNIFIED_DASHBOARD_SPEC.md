# CaySoc Global Unified Dashboard Spec (Proudly South African)
**Status:** Implementation spec (c)
**Generated:** 2026-11-08T16:30:34.812750+00:00
**Context:** Implements `D:\Projects\0xsec.za\IDEA.md` (comprehensive dashboards for Paperclip companies; example `http://192.168.7.3:3100/XSE/dashboard`; **realtime 0Day valuation and counts**) while unifying CaySoc Global + legacy streams.

## 1. Goal
One operational view showing **CaySoc Global** as the umbrella and all legacy streams as first-class panels: **HaCakeSec, 0xSec.za, Caelum.za, xploit.za, CayScaN** (plus optional Olympus.za legacy stream where present). Every stream shows **realtime 0-day counts and ZAR valuation** (USD secondary), agent/task/routine health, budget, and alerts — SAST timestamps, ZAR-first.

## 2. Information Architecture
### Primary views
1. **Executive Overview (default, `/csg/dashboard`)** — CaySoc Global totals + stream cards + 0-day/value ticker + alert strip.
2. **Stream Detail (`/csg/dashboard/stream/:streamId`)** — stream KPIs, 0-day register summary, active tasks/runs, agents, CayScaN/sensor status (if applicable), evidence queue.
3. **0Day & Findings Register (`/csg/dashboard/zeroday`)** — governed register view (authorized/internal tracking): counts by status/severity/stream, valuation, trend, last verified. *No sensitive exploit details exposed in UI without role/approval.*
4. **Operations & Platform (`/csg/dashboard/ops`)** — cx-serv1 Paperclip health, Hermes adapters, CayScaN sensors (Suricata/Zeek/Falco), queue/heartbeat/routine status.
5. **Governance & Cost (`/csg/dashboard/governance`)** — approvals pending, QA/evidence status, ZAR/USD budgets, model/gateway spend.

### Legacy stream mapping (unified)
| Stream | Legacy source | Brand color (from local data, adjust to final master) | Logo/asset source |
|---|---|---|---|
| CaySoc Global | holding/umbrella | `#1a73e8` (or CaySoc Global master) | `D:\caysoc\logo - badge\caysocglobal*.jpg`, `paperclip_logos_2026/CaySoc.v5.png` |
| HaCakeSec | HACAAA / paperclip hacakesec org | HaCakeSec legacy mark | `paperclip_logos_2026/HaCakeSec.0.10.png` |
| 0xSec.za | 0xsec.za hr/paperclip (XSE) | `#dc2626` | `paperclip_logos_2026/0xsec.za.v0.3.1.png` |
| Caelum.za | hr/Caelum (CAE) | `#0891b2` | `paperclip_logos_2026/Caelum.za.v0.1.1.png` |
| xploit.za | hr/xploit (XPL) | `#7c3aed` | `paperclip_logos_2026/xploit.za.v0.2.1.png` |
| CayScaN | Hermes_26/Cay_Web_Scan platform | (assign CaySoc ops accent) | CaySoc/CayScaN platform mark; link sensor dashboard |
| Olympus.za (optional legacy) | dashboard_data.json | `#059669` | `paperclip_logos_2026/Olympus.za.v1.2.1.png` |

> IDEA.md mentioned "all 3 companies" at the time; the unified CaySoc model displays **all legacy streams** above. If a strict 3-panel mode is needed, show CaySoc Global + 0xSec.za + xploit.za as default and allow toggling others.

## 3. KPI & Metrics (realtime)
All realtime fields refresh via **WebSocket/SSE** (preferred) or 5–15s polling fallback. Display `last_updated_sast`.

| Metric | Definition | Source candidates | Notes |
|---|---|---|---|
| `zeroday_count_total` | Count of 0-day/finding records in scope | `0xsec.za/0days/_index.md` parse, `0days/{confirmed,pending,manufactured}/*.md`, authorized finding DB/issues | Governed register; dedupe by ID/hash. |
| `zeroday_count_confirmed` | Confirmed only | 0days/confirmed + verified findings | |
| `zeroday_count_pending` | Pending/triage | 0days/pending/manufactured/queue | |
| `zeroday_valuation_zar` | Sum of estimated ZAR value in scope | per-record `value_estimate_zar` or converted from USD | **Primary display = ZAR**. |
| `zeroday_valuation_usd` | Sum USD | `value_estimate_usd` | Secondary. |
| `fx_usd_zar` | Conversion rate used | configured rate/feed (cached) | Show rate + timestamp; allow manual override for reporting. |
| `critical_open` | Open critical findings/alerts | CayScaN alerts, Paperclip issues, finding register | |
| `agents_active` / `agents_total` | Runtime health | Paperclip agents, Hermes adapter sessions | |
| `tasks_in_progress` / `blocked` | Execution flow | Paperclip issues/tasks | |
| `routines_ok` | Scheduled routine health | Paperclip routines/CayScaN jobs | |
| `budget_spent_zar` / `budget_cap_zar` | Cost control | Paperclip budget + gateway usage, normalized to ZAR | |
| `evidence_pending_qa` | Artifacts awaiting QA/approval | Isiqiniseko queue | |

### Valuation rules (transparent)
- Record-level: `valuation_zar = value_estimate_zar ?? (value_estimate_usd * fx_usd_zar) ?? 0`.
- Status weights (optional reporting mode): confirmed=100%, pending=40%, manufactured/hypothesis=10% (clearly labeled; do not mix into headline without toggle).
- Headline ticker: show **Confirmed ZAR** and **Pipeline ZAR** separately. Counts always show raw totals by status.
- **Governance:** only authorized/internal records; redact target-sensitive details by role. Ibhubesi/CayScaN offensive details require approval.

## 4. Data Contract (API)
Base: `GET/WS /api/csg/dashboard/*` (Paperclip plugin/service) or standalone CaySoc dashboard API. All timestamps ISO-8601 + `sast` display string.

```json
{
  "generated_at": "2026-11-08T12:00:00Z",
  "generated_at_sast": "2026-11-08 14:00:00 SAST",
  "fx": {"usd_zar": 18.50, "as_of": "2026-11-08", "source": "manual|feed"},
  "totals": {
    "streams": 6,
    "zeroday_count": {"total": 0, "confirmed": 0, "pending": 0, "manufactured": 0},
    "valuation": {"zar_confirmed": 0, "zar_pipeline": 0, "usd_confirmed": 0},
    "agents": {"active": 0, "total": 0},
    "tasks": {"in_progress": 0, "blocked": 0, "done_24h": 0},
    "alerts": {"critical": 0, "high": 0, "medium": 0}
  },
  "streams": [/* see dashboard-data-contract.json */]
}
```

Endpoints:
- `GET /api/csg/dashboard/overview` — full payload
- `GET /api/csg/dashboard/streams/:id` — stream detail
- `GET /api/csg/dashboard/zeroday` — governed register summary (paginated)
- `GET /api/csg/dashboard/ops` — platform/sensor health
- `WS /api/csg/dashboard/live` — realtime patches/events (`zeroday.updated`, `alert.created`, `task.changed`, `agent.heartbeat`, `budget.updated`)

## 5. UI Components
- **Global header:** CaySoc Global mark, “Proudly South African”, SAST clock, FX (USD/ZAR), cx-serv1/env badge, live status.
- **0Day ticker:** confirmed count + confirmed ZAR, pipeline count + pipeline ZAR, last verification.
- **Stream cards grid:** one card per legacy stream (HaCakeSec/0xSec/Caelum/xploit/CayScaN + optional Olympus) showing logo, brand color, 0-day count, ZAR valuation, agents, critical alerts, top task.
- **Realtime feed:** merged events (alerts, QA approvals, routine runs) with governance labels.
- **Detail drawers:** open stream/register item without leaving overview; enforce role checks for sensitive fields.

## 6. Implementation Plan (cx-serv1)
1. **Data adapters:** parse `0days/_index.md` + record frontmatter; read Paperclip company/agent/task/budget APIs; ingest CayScaN metrics (`:8443`/DB/sensors) read-only; normalize into CSG contract.
2. **Service:** lightweight aggregator (Node/Python) on cx-serv1 or Paperclip plugin; cache + WS fanout.
3. **UI:** React/Tailwind page (or Paperclip UI extension) using existing brand colors/logos; mobile-responsive (IDEA context).
4. **Security:** authenticated access, RBAC (Sipho/Thandi/Isiqiniseko see governance; Ibhubesi details gated), audit log, no secrets in client.
5. **Branding:** use CaySoc Global master from `branding/ASSET_MANIFEST.json`; render legacy marks as stream badges.

## 7. Acceptance Criteria
- [ ] CaySoc Global + legacy streams **HaCakeSec, 0xSec.za, Caelum.za, xploit.za, CayScaN** visible (Olympus optional).
- [ ] Realtime **0-day count** and **ZAR valuation** (USD secondary) update without page reload.
- [ ] SAST timestamps and ZAR-first formatting.
- [ ] Governance: sensitive details role-gated; authorized/internal tracking only.
- [ ] Uses unified logo/brand manifest; proudly SA, non-state-affiliated presentation.
