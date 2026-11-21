# Agent Mapping Plan (diff-based, **NO WRITES**) — CaySoc Global `5ef64648-3fbd-4492-a973-0b6e35b34a17`

**Verified live state (2026-11-08):** 11 agents exist. Do **not** create Sipho/Thandi/Anele/Naledi/etc. as duplicates. Map blueprint roles/legacy aliases to existing agents, preserve working configs, and gate Ibhubesi/offensive capabilities explicitly.

## Live agents (as-is)
| ID | Name | Role | Title | Adapter | Status | ReportsTo |
|---|---|---|---|---|---:|---|
| `9310da54-93c1-4a50-b67e-b477d7616070` | Chief of staff | ceo | — | opencode_local | running | — |
| `68df9a16-8576-4fe9-90ff-656648c00f49` | caysoc-cfo | cfo | CFO/Capital Allocation | opencode_local | running | — |
| `3d188fd9-27c2-49ce-a57b-b603f52aa6e9` | caysoc-cto | cto | CTO/Chief Architect | opencode_local | error | — |
| `3cb42f82-78ab-4548-bd30-2db4ff6770d1` | caysoc-ciso | ciso | CISO/Portfolio Security | opencode_local | error | — |
| `b3580e2a-680d-4601-a1fd-821d90cffa1c` | caysoc-legal | legal | General Counsel | opencode_local | error | — |
| `aff6f064-3500-4cb3-aa49-b95932a44ac3` | caysoc-product | pm | Product Manager | opencode_local | running | — |
| `79aa8439-5cb0-4f45-9d18-a80e19546e41` | caysoc-portfolio | analyst | Portfolio Analyst | opencode_local | error | — |
| `088a8499-7c97-46ef-aba7-d71a0fa21177` | caysoc-comms | comms | Communications/IR | opencode_local | running | — |
| `6c71aa23-5ad4-4340-b75e-19641670e5af` | caysoc-board-sec | sec | Board Secretary | opencode_local | error | — |
| `32823888-8d96-4461-98ce-ff2ec4255c7c` | Summarizer | general | Summarizer | claude_local | paused | `9310da54` (CEO) |
| `3ce2555d-dcd7-47e3-b7ef-d69dd6898607` | Reflection Coach | general | Reflection Coach | opencode_local | paused | `9310da54` (CEO) |

## Proposed mapping (apply only with explicit approval per change)
| Blueprint role | Legacy aliases to preserve | Map to existing agent | Proposed changes (diff) | Risk/notes |
|---|---|---|---|---|
| Sipho (CEO/Intake) | HACAKE-001, Intake-Owner, CSG-CEO | **Chief of staff** (`9310da54`, ceo, running) | Add metadata: `legacyAliases`, `csgRole=Sipho/CEO-Intake`, SAST/ZAR governance note. Keep adapter/name unless operator approves rename. Consider title `CaySoc Global CEO / Intake (Chief of Staff)`. | Low if metadata/title only. Renaming may affect UX/history. |
| Thandi (Indaba PM/Portfolio) | HACAKE-010, PM-Lead, Caelum planner | **caysoc-product** (`aff6f064`, pm, running) and/or **caysoc-portfolio** (`79aa8439`) | Add legacy aliases/division Indaba metadata. Optionally make portfolio report to product or CEO per desired structure. | Medium: reporting changes affect workflows. |
| Anele (Isibani Research) | HAKASE-002, Caelum Researcher, 0xSec Recon | **caysoc-portfolio** or **new role assignment via metadata** (no duplicate agent first) | Add Isibani/research aliases + read-only recon scope metadata. | Avoid creating duplicate; existing agent has adapter errors to fix separately. |
| Lerato (Umlenze Delivery) | HACAKE-021, Caelum Engineer | **caysoc-cto** (`3d188fd9`, cto, error) or delivery mapping | Metadata/division; fix adapter config before relying on execution. | Adapter currently error. |
| Jabu (Isivikelo Security/Trust) | HACAKE-031, 0xSec Reporter/Validator | **caysoc-ciso** (`3cb42f82`, ciso, error) | Metadata Isivikelo; least privilege; **no offensive control**. | Adapter error. |
| Naledi (Isiqiniseko QA/Evidence) | HACAKE-041, 0xSec Validator | **caysoc-board-sec** (`6c71aa23`, sec, error) or **Reflection Coach** governance lane (careful) | QA/evidence/gate metadata. Do not weaken approval boundaries. | Board-sec/Reflection Coach have different purposes. |
| Khaya (Ibhubesi Lab Lead, **GATED**) | xploit Red Team Lead, HACAKE-001 gate | **No direct auto-map.** Create/enable only with explicit approval, scope, and controls. | If ever added: `adapterType` verified, `metadata.gated=true`, `policy=authorized_scope_and_human_approval_required`, least-privilege toolset, no default offensive tooling. | **High risk if mishandled. Do not auto-create.** |
| Nomsa-Ops (Routines/Heartbeat) | HACAKE-013, CayScaN ops | **Chief of staff** currently assignee of new CSG routines, or caysoc-portfolio/product | Keep CSG SAST routines assigned; add ops alias metadata. | Low. |
| Zola-Scan (CayScaN read-only telemetry) | CayScaN agents | **No duplicate.** Use aggregator read-only CayScaN adapter; if agent needed, create separately with read-only policy. | Read-only by default; no exploit control path. | Governed. |
| Mpho-Dash (Dashboard/0Day/ZAR) | Hermes/Dashboard builder | **Aggregator service role + metadata on portfolio/CTO** (no new agent required now) | Aggregator deployed (4310 localhost, 0days real + Paperclip read-only). | Operational, not an LLM agent requirement. |
| Themba-Evidence (Evidence/Vault) | 0xSec Reporter | **caysoc-board-sec** / legal-comms-QA mapping | Evidence/reporting metadata; governed outputs. | Low-medium. |

## Pre-existing issues to fix deliberately (separate from mapping)
- `opencode_local` agents with errors: heartbeat logs show `OpenCode requires adapterConfig.model in provider/model format`. Fix per agent only with known-good model/provider config; **no secret guessing**.
- `Summarizer` paused (claude_local, haiku configured), `Reflection Coach` paused (built-in disabled until configured). Respect built-in/bundle behavior.
- Reporting lines: only Summarizer and Reflection Coach report to CEO; others `reportsTo null`. Any org-chart change should be reviewed.

## Safe execution order (when approved)
1. Metadata-only patches (legacy aliases, csgRole, division, governance notes) — lowest risk.
2. Reporting/title normalization — review impact.
3. Adapter config fixes — per agent, tested, with rollback values recorded.
4. Ibhubesi/Zola-Scan agent creation — **only with explicit scope, gating, and human approval controls**.

## Governance
- Preserve CAY `5ef64648...` and existing working state; merge-only.
- Ibhubesi/CayScaN/Cameradar offensive paths: **authorized-lab only, scope ref + human approval + evidence**.
- 0-day/valuation: governed/internal, ZAR/SAST, role-gated sensitive details.
