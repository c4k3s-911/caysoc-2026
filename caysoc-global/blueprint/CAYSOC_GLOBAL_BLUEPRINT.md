# CaySoc Global - Paperclip Blueprint (Proudly South African)

Generated: 2026-11-08T16:26:03.493301+00:00
Company: **CaySoc Global** | Prefix: **CSG** | TZ: **Africa/Johannesburg** | Currency: **ZAR** | VPS: **cx-serv1 192.168.0.4**

## Tagline
Proudly South African intelligence, defence, and authorized security operations - governed and auditable.

## Goals
- Unify all legacy companies/capabilities into one governed CaySoc Global operation.
- Deliver high-signal OSINT/risk insight with evidence and human accountability.
- Run resilient cyber defence and CayScaN platform operations.
- Perform only authorized, scoped security testing with approvals and chain-of-custody.
- Protect data (POPIA-aware), control spend (ZAR), and improve continuously.

## Divisions
| Division | Mandate |
|---|---|
| Indaba - Command & Strategy | Mission, goals, budgets, approvals, portfolio. |
| Isibani - Intelligence & OSINT | Authorized/public-source collection, enrichment, correlation. |
| Umlenze - Graph & Risk Insight | Entity/risk graph, evidence linkage, trends. |
| Isivikelo - Defence & Platform | Monitoring, detection, hardening, IR, CayScaN platform. |
| Ibhubesi Lab - Authorized Security Testing | Scoped/authorized testing only; validation and retest. |
| Isiqiniseko - Governance, QA & Reporting | QA, chain-of-custody, compliance mapping, reporting. |

## Core roles
| Name | Title | Division | Reports to | Legacy aliases |
|---|---|---|---|---|
| Sipho | Director / CEO Agent | indaba | - | Crossbow, Nous, Crossfire, Zenith |
| Rands | Ops & Cost Analyst (ZAR) | indaba | sipho | Ops Accountant |
| Naledi | OSINT & Intelligence Lead | isibani | sipho | Oracle, Vigil, Source Sweeper |
| Lerato | Data Correlator | isibani | naledi | Data Correlator, Weaver |
| Thabo | Graph & Risk Lead | umlenze | sipho | Thabo |
| Aegis | Defence & Platform Lead | isivikelo | sipho | Aegis, Sentinel, Bulwark |
| Kopano | Platform Engineer (CayScaN/Sensors) | isivikelo | aegis | Traceback, Nyx (authorized) |
| Zanele | Authorized Testing Lab Lead | ibhubesi | sipho | Zanele, Razor, Viper/Strike/Mobile |
| Verifier | Finding & Exploit Verifier | ibhubesi | zanele | Verifier, Validator, Tester |
| Thandi | Compliance & Reporting Lead | isiqiniseko | sipho | Thandi, Report Generator, Summarizer |
| Themba | QA & Chain-of-Custody Auditor | isiqiniseko | thandi | Reflection Coach, Auditor, Criterion |

## Governance
- Default: agent output -> QA/audit -> artifact/vault.
- Human approval: offensive/intrusive actions; external disclosures; person/org risk publications; confidential/restricted data or secrets; budget exceptions; production infra changes.
- Prohibited without authorization: unauthorized access/exploitation/credential abuse/impersonation; unsanctioned surveillance/exfiltration; out-of-scope actions.
- Evidence: timestamp, actor, scope_ref, artifact hash/path, QA status. POPIA-aware; data classes Public/Internal/Confidential/Restricted.

## Routines (SAST)
| Routine | Cron | Owner |
|---|---|---|
| Morning Ops Brief | `0 6 * * *` | sipho |
| Intel & Source Refresh | `0 7 * * *` | naledi |
| Graph & Risk Update | `0 9 * * 1,3,5` | thabo |
| Platform & Sensor Health | `0 12 * * *` | aegis |
| QA & Evidence Audit | `0 15 * * *` | themba |
| Weekly Portfolio Review | `0 14 * * 5` | sipho |
| Monthly Compliance & Cost Review | `0 8 1 * *` | thandi |

## Legacy streams
| Stream | Source | Status |
|---|---|---|
| HaCakeSec Legacy | `paperclip/hacakesec-org-map.md (HACAAA)` | merge-base |
| 0xSec Platform | `0xsec.za/paperclip + hr/0xsec.za (33)` | capability-merge |
| Caelum Recon | `0xsec.za/hr/Caelum.za (9)` | capability-merge |
| xploit Lab | `0xsec.za/hr/xploit.za (24)` | capability-merge (gated) |
| CayScaN Platform | `Hermes_26/Cay_Web_Scan` | platform-integration |
| God's Eye Viz | `bilawalsidhu/gods-eye-view (reference)` | visualization-integration |

## Branding
See `../branding/ASSET_MANIFEST.json` and `../branding/BRAND_UNIFICATION.md`. Primary candidates: `D:\caysoc\logo - badge\caysocglobal*.jpg`, `D:\Projects\0xsec.za\Logos\paperclip_logos_2026\CaySoc.v5.png`.
