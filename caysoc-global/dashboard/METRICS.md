# CaySoc Global Dashboard Metrics (ZAR / 0Day)

## Currency
- **Primary:** ZAR. **Secondary:** USD.
- `valuation_zar = value_estimate_zar ?? (value_estimate_usd * fx_usd_zar) ?? 0`.
- FX source must be displayed (manual or feed) with `as_of` timestamp. SAST display.

## 0Day / finding register (governed)
**Scope:** authorized/internal tracking only. Role-gated UI; redact sensitive exploit/target details without approval.

| Field | Meaning |
|---|---|
| total | all records in scope |
| confirmed | validated/confirmed |
| pending | triage/pending/manufactured awaiting validation |
| zar_confirmed | sum valuation for confirmed |
| zar_pipeline | weighted or raw pipeline valuation (label clearly) |

**Source adapters (initial):** `D:\Projects\0xsec.za\0days\_index.md` + markdown records in `confirmed/`, `pending/`, `manufactured/`; Paperclip issues tagged `0day/finding`; CayScaN findings (gated). Deduplicate by stable ID/hash.

## Realtime
- WS/SSE events: `zeroday.updated`, `alert.created`, `task.changed`, `agent.heartbeat`, `routine.completed`, `budget.updated`, `governance.approval_pending`.
- Fallback polling 5–15s. Show `last_updated_sast` and connection state.

## Streams (unified)
CaySoc Global, HaCakeSec, 0xSec.za, Caelum.za, xploit.za, CayScaN (+ optional Olympus.za). Each stream aggregates its own counts/valuation/agents/tasks/alerts/budget; CaySoc Global shows totals.
