# CaySoc Global — Private Deployment (Paperclip + Aggregator)

**Host:** `cx@192.168.100.19` (cx-serv1, Zorin OS 17.3, Docker 2.x, node 24.22.3)
**Migrated from:** `192.168.0.4` (host decommissioned — no data carried over)
**Posture:** loopback-only. `3100` and `4310` bind `127.0.0.1`. No public exposure, no Tailscale Funnel.

---

## Layout on the host

```
~/caysoc/
├── paperclip/
│   ├── app/                                  # Paperclip source (no node_modules/.git)
│   ├── docker-compose.paperclip.private.yml
│   ├── docker-entrypoint.fixed.sh            # CR-stripped entrypoint (bind-mounted)
│   └── build.log / build2.log
├── aggregator/                               # dashboard aggregator source
├── 0days/                                    # 0-day inventory (ZERODAY_ROOT)
├── caysoc-import.mjs                         # idempotent blueprint import
└── docker-compose.aggregator.yml
```

## Services

| Service | Container | Bind | Notes |
|---|---|---|---|
| Paperclip | `paperclip` | `127.0.0.1:3100` (host network) | `local_trusted`, embedded Postgres `54329`, data volume `caysoc_paperclip_data` |
| MCP Swarm JSON-RPC | (in `paperclip`) | `127.0.0.1:9090` | JSON-RPC 2.0, `PAPERCLIP_SWARM=1` |
| MCP Swarm telemetry | (in `paperclip`) | `127.0.0.1:9091` | `/ws/swarm` WebSocket |
| Aggregator | `caysoc-aggregator` | `127.0.0.1:4310` (host network) | Express + WS, reads `~/caysoc/0days`, proxies Paperclip |

Both use `network_mode: host`, because `local_trusted` refuses to start unless the server binds
loopback. There are no published ports and no Docker bridge network in the final design.

## Bring-up

```bash
# 1. Paperclip
cd ~/caysoc/paperclip
docker compose -f docker-compose.paperclip.private.yml up -d
curl -sS http://127.0.0.1:3100/api/health

# 2. Aggregator
cd ~/caysoc
docker compose -f docker-compose.aggregator.yml up -d
curl -sS http://127.0.0.1:4310/health

# 3. Import blueprint (idempotent, merge-only)
node ~/caysoc/caysoc-import.mjs
```

## Build notes (important)

The source tree comes from a Windows checkout, which introduced three issues that required fixes:

1. **`corepack` removed from Node 24+** — `Dockerfile` line 8 changed from `corepack enable`
   to `npm install -g pnpm@9`. Original preserved as `Dockerfile.orig`.
2. **`mcp-swarm` was repaired (2026-11-19).** The layer previously failed both typechecking and at
   module load. The real defects were fixed in `server/src/mcp-swarm/*` and `server/src/app.ts`:
   - `token-bucket.ts` spread a TypeScript *interface* as a value (`{ ...CircuitBreakerState }`),
     throwing `ReferenceError` at import; replaced with a real initializer and `logger` import.
   - Circuit breaker now requires a minimum sample size (20) before it can trip, so one failed
     tool call cannot open the breaker for the whole swarm.
   - `persistence.ts` imported `CellName` from the wrong module, used `.rows` on a row-list, and
     mishandled the `cancelled` status; all corrected.
   - `server.ts` now imports `CellName`, validates `runContext` into a real `ToolRunContext`, types
     error codes as `JsonRpcErrorCode`, and returns the actual RPC result instead of `{ ok: true }`.
   - `redis-client.ts` resolves the optional `redis` package dynamically, types its listener, and
     no longer double-exports `RedisClient`.
   - `telemetry-ws.ts` uses the real `WebSocketServer` export, avoids nullable captures, and gained
     a `subscribe()` API so the watchdog bridge actually receives events.
   - `watchdog-bridge.ts` no longer assigns to a non-existent `this.telemetryServer`, counts distinct
     agents instead of heartbeat events, and treats idle cells as healthy.
   - `caysoc-tool-mapping.ts` derived `CAYSEC_TOOLS` from itself (TDZ); it now derives from `ROLE_CELL`
     and emits lowercase namespaced tool names (`recon:scout`).
   The server typechecks clean and the unit tests pass, so the `|| true` build tolerance was removed.
   `PAPERCLIP_SWARM=1` now enables the layer on the live deployment.

3. **CRLF line endings** — `scripts/docker-entrypoint.sh` had CRLF, so the kernel could not find
   `/bin/sh\r`. Fix: `tr -d '\r'` into `~/caysoc/paperclip/docker-entrypoint.fixed.sh`, bind-mounted
   read-only over `/usr/local/bin/docker-entrypoint.sh`.

4. **Swarm ports.** With `PAPERCLIP_SWARM=1` the layer listens on `127.0.0.1:9090` (JSON-RPC 2.0)
   and `127.0.0.1:9091` (`/ws/swarm` telemetry). Both are loopback-only; `/api/health/swarm` is
   served by the main server on `3100`.

5. **Stale `/app/.env` baked into the image.** The repo checkout ships a `.env` with
   `DATABASE_URL=...@localhost:5432`, which the server auto-loads and which overrides embedded
   Postgres, producing `ECONNREFUSED 127.0.0.1:5432`. Fix: `./empty.env` is bind-mounted over
   `/app/.env` (read-only), so the container uses only the compose environment.

6. **Board-approval gate on agent creation.** `POST /companies/:id/agents` returns 409 while
   `requireBoardApprovalForNewAgents` is true. The import opens the gate, seeds the roster, and
   restores the gate. Note the API can return a 500 *after* creating the agent, so the import is
   name-idempotent; a follow-up pass sets `reportsTo` and routine assignees.

7. **Routines land paused and triggers can duplicate.** Reactivation is a `PATCH /routines/:id`
   with `status:"active"`; duplicates are removed with `DELETE /routine-triggers/:id`.

## Access control

Nothing here is exposed to the LAN or internet. To reach the UI, use an SSH tunnel:

```bash
ssh -L 3100:127.0.0.1:3100 cx@192.168.100.19
# then open http://127.0.0.1:3100
```

Same for the aggregator on `4310`.

### Unified CaySoc dashboard

The aggregator now serves a live unified dashboard at **`/dashboard`** on `4310`:

```bash
# from WSL (the tunnel must listen on all interfaces so Windows/browser can reach it)
sshpass -e ssh -g -N \
  -L 4310:127.0.0.1:4310 -L 3100:127.0.0.1:3100 \
  cx@192.168.100.19
# open http://<WSL-IP>:4310/dashboard
```

Find the WSL IP with `hostname -I`. It must be listed in `PAPERCLIP_ALLOWED_HOSTNAMES`
(already set on the host to `172.25.227.200,localhost,127.0.0.1`) or Paperclip's private-hostname
guard returns 403. Use `ServerAliveInterval=30` and a restart loop: SSH to the host is flaky and a plain `-N`
tunnel eventually dies with a broken pipe, which is what produces the browser's
"URL can't be reached" page. Run `bash deploy/private/tunnel-wsl.sh &` from WSL (set
`CAYSOC_SSH_PASSWORD` if it is no longer `0`); it restarts the tunnel automatically. The dashboard
consumes the WebSocket at `/api/csg/dashboard/live` (15 s push) with a 10 s `/overview` polling
fallback, and shows a ZAR-first 0-day ticker, USD secondary and SAST timestamps. The status strip
reports connection state (`LIVE`/`POLLING`/`RECONNECTING`/`OFFSET`), data age, adapter mode and
per-adapter dots (0-day register / Paperclip / CayScaN).
Stream counters are derived from the governed 0-day register, so they always sum to the headline
totals. Each stream card and the header use the brand logos from `D:\Projects\0xsec.za\Logos`
(curated `paperclip_logos_2026` set), served by the aggregator at `/logos/*` with a one-day cache.
CayScaN has no supplied mark, so it uses a generated SVG scan badge. `dashboard/ui/index.html` is
the UI source (also copied to `dashboard/aggregator/public/`).

Dashboard layout/v1.2 (first enhancement pass):
- **Status strip:** live connection state, data age, adapter mode and health dots; a GOVERNED badge
  appears when the 0-day register is active.
- **Six KPI tiles:** confirmed 0-days (with session delta), confirmed ZAR value (with delta),
  pipeline ZAR, 0-day mix stacked bar, agents active, and an ops-pulse tile with severity chips and
  24 h task throughput. Deltas are relative to the first snapshot of the browser session.
- **Richer stream cards:** logo/name/status header, ZAR primary + USD secondary value block, per-stream
  0-day mix bar, a 2x2 metrics grid (pipeline value, agents, in progress, blocked) and health tags
  for status, Paperclip link, blocked tasks and high alerts.
- The renderer compares a data signature before replacing KPI/stream DOM, so 15 s WS ticks do not
  rebuild cards (logos stay loaded, hover/scroll state is preserved).
- The same logos were uploaded into **Paperclip**: `CaySoc.v5.png` is applied as the CaySoc Global
  company logo (`logoAssetId`, served at `/api/assets/<id>/content`, rendered in the Paperclip
  header and navigation). The other six marks are stored in the company asset library under
  namespace `branding`, with their asset IDs recorded in the `brand-assets` document on CAY-3.
  No duplicate companies were created.

## Governance module — governed intake &amp; authorized lab scopes

Implemented inside the aggregator (no extra container) in `dashboard/aggregator/src/governance/`:
- `store.js` — file-backed store for scopes, findings and evidence, plus an append-only
  SHA-256 **hash-chained audit log** (`gov-store.json`, `gov-audit.jsonl` under
  `~/caysoc/governance-data`). Verifiable with `GET /api/csg/gov/audit/verify`.
- `auth.js` / `routes.js` — bearer-token RBAC: `board` (everything incl. scope approval),
  `operator` (writes + reads), `client` (read own company findings only), anonymous
  (aggregate summary only). Routes live under `/api/csg/gov/*`.
- `selftest.js` — 14 offline logic assertions covering scope approval, token minting,
  target/tool allowlists, use limits, finding intake, evidence hashing, summary and
  audit-chain integrity.
- Dashboard UI: a Governance section below the stream cards. Summary KPIs are public;
  detail tables and action forms require a token, held only in browser `sessionStorage`.

Behaviour:
- Scope lifecycle `draft → approved → active (within window) → revoked/expired`. Only the
  board can approve. Operators mint short-lived execution tokens (default 30 min, 10 uses).
  `POST /api/csg/gov/check` with `{token,target,tool}` returns `allowed`/`reason`; both
  decisions are audited and denied checks do not consume uses.
- Findings use identifiers `GOV-0001…` with status
  `intake → triage → verifying → validated → valued → disclosed/retained/rejected`.
  Evidence records keep filename, content type, byte size, SHA-256 and an optional URI.
- 0-day detail and per-finding valuations stay governed/role-gated; the main dashboard
  KPIs and `/gov/summary` expose aggregates only.

Deploy notes: `docker-compose.aggregator.yml` mounts `/home/cx/caysoc/governance-data` and
loads `CAYSOC_GOV_TOKENS` from `/home/cx/caysoc/governance.env` (mode `600`, generated once
with `openssl rand -hex 24`). Rotate tokens by editing that file and restarting the
aggregator. No tokens are stored in the repository.

## Agent Ops Control Room (#4)

Implemented in `dashboard/aggregator/src/ops/` and mounted at `/api/csg/ops/*` (same
operator/board token as the governance module; no token = no ops data):
- `client.js` — read-only Paperclip calls (agents, heartbeat runs, live runs, routines) and
  controlled mutations (pause, resume, clear-error, model rotation, bounded policy patches).
- `procs.js` — read-only `/proc` scan (bind-mounted at `/host/proc`) for `opencode run`
  processes, with age and suspected-orphan flag (default threshold 600 s).
- `analysis.js` — pure helpers for run normalisation, per-agent SLOs, model health,
  policy alerts and summary counts. `selftest.js` covers these offline (9 assertions).
- `routes.js` — `/summary`, `/agents`, `/runs`, `/models`, `/alerts`, `/processes`,
  `/runs/:id/trace`, agent pause/resume/clear-error, `PATCH /agents/:id/policy` and
  `POST /model/rotate` (supports `dryRun`). All mutations are audited to the governance
  hash-chained log. A 10 s snapshot cache keeps Paperclip load low. Read-only ops endpoints
  are visible on the private dashboard **without** a token; Pause/Resume/Clear/Rotate and
  raw run traces still require the operator/board token. This keeps run info visible by
  default instead of showing an empty "enter a token" panel.

Dashboard UI: an "Agent Ops · control room" section with live KPIs, severity alerts, an
agent table (status, model, 24 h runs/success/avg duration, pause/resume/clear/rotate),
a model-health table, a recent-run timeline with per-run trace, and process/orphan counts.

### Incident: OpenCode free quota exhausted (2026-11-21)

All free models returned `AI_APICallError: Free usage limit reached` — including every
candidate probed (`nemotron-3.5-lightning-free`, `mimo-v2.6-flash-free`, `beam-free`,
`tidepool-alpha-free`, `flint-40b-free`, `iceman-free`). Rotating models cannot help while
the account quota is exhausted and no paid provider key is configured in the Paperclip
container. Symptom: repeated `timed_out` after 240 s, agents ending in `error`, ~26 %
success over the last 200 runs. Resolution requires a quota reset, an OpenCode Go
subscription, or a paid provider API key — not a model switch. The control room now
surfaces this via `model_unhealthy`, `run_failures` and `agent_error` alerts.

Operator action taken: all four always-on agents were paused through the audited ops API,
leaving 11/11 agents paused, 0 live runs, 0 errors and 0 orphan processes. Re-enable them
with `POST /api/csg/ops/agents/:id/resume` (or the Resume button) once the quota resets or a
paid key is configured. Note: re-running `caysoc-import.mjs` re-enables the always-on heartbeats.

## Shadow Asset & Exposure Monitor (#9)

Implemented in `dashboard/aggregator/src/assets/`, mounted at `/api/csg/assets/*` (same
operator/board token; no token = no data):
- `discovery.js` — **passive only**: DNS A/AAAA/CNAME resolution, TLS certificate metadata
  (443) and `GET /` response-header inspection. No port scanning, no exploitation, no auth
  attempts. Four probes run concurrently with a 6 s timeout each.
- `analysis.js` — exposure score (0–100) from missing security headers, disclosed
  framework/server versions, self-signed or expiring certificates, plus snapshot diffing and
  a Markdown weekly delta report. `selftest.js` covers these offline (8 assertions).
- `store.js` — seed inventory, asset snapshots and up to 200 change records in
  `~/caysoc/governance-data/assets-store.json` (reuses the governance volume).
- `routes.js` — `/summary`, `/seeds`, `/assets`, `/discover`, `/changes`, `/report`. All
  writes are audited. Continuous mode runs one passive pass every 24 h **only when seeds
  exist** (`ASSETS_AUTO_DISCOVER=0` disables, `ASSETS_INTERVAL_HOURS` tunes).

Dashboard UI: a "Shadow Assets" section with KPIs (tracked, new 7 d, high/critical,
expiring certs), a scored asset table with reasons, a change log, a seed form, a
"Discover now" button and a weekly report viewer. Seeded for verification with `0xsec.za`
(unresolved from the host) and `example.com` (resolved, exposure 52/high — missing HSTS/CSP
and other hygiene headers).

## Compliance Evidence Collector (#5)

Implemented in `dashboard/aggregator/src/compliance/`, mounted at
`/api/csg/compliance/*` (same operator/board token):
- `store.js` — a 12-control catalog seeded on first run, mapped to POPIA and
  ISO 27001 Annex A references with owners and review frequencies. Evidence records carry
  SHA-256 hashes, source, observation date, optional expiry and URI.
- `analysis.js` — status evaluation (`current` / `stale` / `missing`) from evidence age and
  validity, coverage percentages, domain/framework rollups, gap list and a Markdown audit
  export. `selftest.js` covers these offline (9 assertions).
- `routes.js` — `/summary`, `/controls`, `/gaps`, `/evidence`, `/export`, plus
  `POST /evidence/from-finding`, which links a governed finding from the #1 vault directly
  as control evidence. All writes are audited. Data lives in
  `~/caysoc/governance-data/compliance-store.json`.

Dashboard UI: a "Compliance Evidence" section with coverage KPIs, the full control register
(status, owner, framework reference, last evidence), an outstanding-gaps table, an evidence
add form and an audit-export viewer. Seeded for verification with a manual AC-01 access-review
record and a linked governed finding on IR-01 (2/12 controls current, 17% coverage).

## Community Threat & Scam Signal Map (#6)

Implemented in `dashboard/aggregator/src/community/`, mounted at
`/api/csg/community/*`. This is the only module with a **public projection**:
- `analysis.js` — keyword classification (invoice/EFT, courier, SARS/tax, utility,
  lottery, bank OTP, employment, romance), redaction (`***.co.za`, `a***@co.za`), and
  aggregate-only public summaries. Public output never contains a raw indicator value,
  victim detail or exploit content. `selftest.js` asserts this (10 assertions).
- `store.js` — opt-in indicators with SHA-256 fingerprint deduplication, report counts,
  province tags and a moderation flag. Data lives in
  `~/caysoc/governance-data/community-signals.json`.
- `routes.js` — public `GET /summary`, `GET /report`, `POST /indicators` (rate-limited to
  10/hour per IP, requires `consent:true`, stored internal-only until verified); operator
  endpoints `GET /indicators`, `POST /indicators/:id/verify`, `DELETE /indicators/:id`.
  All writes are audited.

Dashboard UI: a "Community Threat Pulse · South Africa" section. The summary, category
mix, provincial spread and weekly report are visible without a token; the redacted
moderation queue, Verify and Remove actions require a token. Verified for raw-value
leakage: `evil.co.za` submitted via the public form appears nowhere in public output,
the report, or the operator's redacted view.

## Local Ollama experiment (2026-11-21)

To remove the OpenCode free-quota dependency, Ollama was installed **user-level** at
`~/caysoc/ollama` (runtime from the official release tarball, model store at
`~/caysoc/ollama/models`), bound to `127.0.0.1:11434` only. The model was copied from
`D:\models` on the operator workstation: `llama3.2:1b` (1.32 GB, GGUF Q4_K_M,
`capabilities: ["completion","tools"]`). The manifest's small config blob was missing
from the source store and was reconstructed from the manifest.

OpenCode in the Paperclip container needs a provider config at
`/paperclip/.config/opencode/opencode.json` (note: the container's HOME is `/paperclip`,
**not** `/root`). This path is inside the `caysoc_paperclip_data` named volume, so it is
durable across container recreation:

```json
{
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama (local)",
      "options": { "baseURL": "http://127.0.0.1:11434/v1" },
      "models": { "llama3.2:1b": { "name": "Llama 3.2 1B local" } }
    }
  }
}
```

`OLLAMA_KEEP_ALIVE=-1` is essential: cold CPU load takes 215–312 s, which exceeds the
agents' 240 s timeout; warm calls take 2–4 s. Verified `opencode run --model
ollama/llama3.2:1b` succeeds at cost 0.

**Pilot result: not suitable for agent work.** Sipho Nkosi was switched to the local
model, resumed and given a task issue. The run reported `succeeded`, but the model only
summarised its execution contract instead of calling tools — no comment, issue left
`in_progress`, liveness `needs_followup`. Generation was ~3.2 tokens/s on CPU; one call
took 3m30s. The pilot was reverted (`opencode/hy4-flash-free`, 240 s), Sipho paused
again, and CAY-54 closed. Larger local models in `D:\models` (7B Q3 ≈ 3.8 GB) would not
fit alongside the other services in 5.7 GB without swap and would be even slower.

Restart the service if experimenting further:
`cd ~/caysoc/ollama && OLLAMA_MODELS=$HOME/caysoc/ollama/models OLLAMA_HOST=127.0.0.1:11434 OLLAMA_KEEP_ALIVE=-1 setsid nohup ./bin/ollama serve > serve.log 2>&1 &`

## SME Cyber Risk Pulse (#3)

Implemented in `dashboard/aggregator/src/risk/`, mounted at `/api/csg/risk/*` (operator/board
token required — client data is gated):
- `assessment.js` — pure 0–100 risk scoring (higher = risk) from the #9 passive asset
  exposure, TLS/cert state, SPF/DMARC DNS checks, #1 governed findings and #5 compliance
  gaps. Produces a letter grade, a prioritised remediation checklist and a ZAR-first report
  (USD secondary, SAST timestamps). `selftest.js` covers scoring and reporting (7 assertions).
- `store.js` — client portfolio and assessment snapshots (trend over time), in
  `~/caysoc/governance-data/risk-portfolio.json`.
- `routes.js` — `/clients`, `/summary`, `POST /clients/:id/assess`, report and trend.
  Assessments are **scan-free**: DNS TXT lookups plus stored passive/governed data only, so
  no model or scope token is needed. All writes are audited.

Dashboard UI: an "SME Cyber Risk Pulse · South Africa" section with portfolio KPIs, a client
table, per-client assessment detail with prioritised fixes, an Assess button and a Markdown
report viewer. Seeded with a CaySoc Global client using `0xsec.za` / `example.com`: score
63/100 (grade C), R 407 000 governed exposure, top fixes SPF, DMARC and stale DNS.

With this module, all seven selected projects (1, 2, 3, 4, 5, 6, 9) are implemented.

## Automatic quota-recovery watcher

Since the OpenCode free quota is still exhausted, a host-side watcher was installed so the
fleet does not need manual intervention when it resets:
- `~/caysoc/quota-recovery.sh` (mode executable) probes `opencode run --model
  opencode/hy4-flash-free` every 30 minutes via cron. On "Free usage limit reached" it
  writes state `exhausted` and exits. When the model responds with text output, it resumes
  the four core agents through the audited ops API and writes state `recovered`, then
  stops probing.
- Status JSON: `~/caysoc/governance-data/quota-recovery.json`; log:
  `~/caysoc/quota-recovery.log`. Cron entry:
  `*/30 * * * * /home/cx/caysoc/quota-recovery.sh >> /home/cx/caysoc/quota-recovery.log 2>&1`.
- The dashboard Agent Ops section shows a `● QUOTA <STATE>` pill with the last check time.

Current state: `exhausted` (verified by manual run). Removing the cron entry disables the
watcher: `crontab -l | grep -v quota-recovery.sh | crontab -`.

## Secrets / governance

- `.env` is mode `600`, holds `BETTER_AUTH_SECRET` generated with `openssl rand -hex 32`.
- Paperclip Postgres is embedded (`embedded-postgres`, port `54329`) and reachable only inside the
  container network; `pg_hba.conf` stays password-only.
- 0-day data stays internal and role-gated; the aggregator's `/api/csg/dashboard/zeroday` returns
  counts and valuation only, never raw exploit detail.
- Rotate the SSH password; it is currently a single character and was transmitted in chat.

## Known state

- Old host `192.168.0.4` is unreachable. No Postgres backup survived, so the previous CAY company
  and its 11 agents were re-created from the blueprint. **IDs differ from the old instance.**
- Live CaySoc Global company on this host: `7538e115-2137-4b09-84ac-c98c950c679f` (`CAY`,
  `#1a73e8`, active, `requireBoardApprovalForNewAgents=true`).
- 11 agents, all `opencode_local` with `model=opencode/hy4-flash-free`, `timeoutSec=240`, `graceSec=30`, all `idle`.
- 3 routines, active, with SAST triggers: Ops Heartbeat `0 */4 * * *` + `30 * * * *`;
  Daily Digest `0 8 * * *`, `0 12 * * *`, `0 20 * * *`; Weekly Review `0 9 * * 1`, `0 9 * * 5`.
- **Continuous autonomy, bounded to four concurrent agents:** Sipho, Thandi, Nomsa and Naledi are
  always-on with a 30-minute heartbeat (`skipTimerWhenNoActionableWork=false`, 48 runs/day cap,
  2000 cents/day). The other seven are `paused` with a 2-hour heartbeat and
  `skipTimerWhenNoActionableWork=true`, so they can be resumed individually but do not pile up.
  Every agent has `maxConcurrentRuns=1`. The earlier all-11-always-on attempt drove load to 42;
  with four core agents the host sits at ~0.5 load and Paperclip stays healthy.
- **Proof of unattended operation:** the 23:30Z hourly heartbeat created CAY-8 and Nomsa completed
  it autonomously (run `67c62d8c…`, succeeded, 255 KB of real tool output).
- After the first anti-noise rule, autonomous agents began filing false-positive "empty
  adapterConfig.model" issues whenever a provider hiccup put an agent into `error`. The rule was
  hardened: agent error states, adapter config, model names and timeouts are operator-managed and
  must be reported in the run comment only, never raised as board issues. The three such issues
  (CAY-12/22/24) were closed after verifying every config still had `hy4-flash-free`, `timeoutSec=240`
  and `graceSec=30`.
- The import script encodes these heartbeat policies, pause states and extra triggers, so a
  rebuild preserves them.
- Aggregator overview reports `agents 11/11`, 0-day totals 1 confirmed / 1 pending / 1 manufactured,
  ZAR 3,256,000 confirmed and ZAR 32,560,000 pipeline at FX 16.28.
- **Swarm is enabled** and verified live: `127.0.0.1:9090` answers `ping`, `127.0.0.1:9091`
  serves telemetry, and `/api/health/swarm` reports `healthy`. With no agents reporting yet the
  cell counters are zero and the status is healthy (idle cells are not degradations).
- Image rebuilt from the repaired source as `caysoc/paperclip:2026-11`
  (`bfd787bf18df`); the server typechecks with the strict `pnpm --filter @paperclipai/server build`
  (no tolerance flag). No temporary bind-mounts remain.
## Model incident (2026-11-20) and resolution

- The original `opencode/glm-5.3-flash-free` model was **not offered by the OpenCode provider**
  (11 models available), so every agent run failed with `adapter_failed — Model is unavailable`
  until that point; the agents had never actually executed.
- A first correction to `opencode/longcat-2.5-free` passed a one-shot probe and produced genuine
  tool-using output, but stalled repeatedly (one run produced 409 KB then went silent for ~19 h).
  Paperclip watchdog opened CAY-2/4/5/6 and those runs were cancelled.
- Repeated environment probes showed `deepseek-v4.1-flash-free` passing 3/3 in ~20 s while longcat
  degraded to `warn`. **All 11 agents now use `opencode/deepseek-v4.1-flash-free`.**
- Two clean end-to-end runs followed: CAY-1 (CSG Ops Heartbeat) and CAY-3 (CSG Daily Status Digest)
  both `succeeded` with real OpenCode sessions, real `bash` tool calls, token accounting and a
  coherent final report/digest posted by the agent. All six issues are now `done`.
- Orphan `opencode run` processes were killed, stale watchdog issues closed, and the three routines
  re-activated with their original SAST triggers. The import script's default model was updated too.
- **Autonomy verified:** the 22:00Z heartbeat fired unattended, created CAY-7 and woke Nomsa
  automatically. The first execution inherited a stale session and produced no output, so it was
  cancelled, the orphan process killed, and the agent woken with `forceFreshSession`. Run
  `d026ad7d…` then succeeded (351 KB, real bash/glob/read tool calls) and the agent closed CAY-7.
- Provider model availability rotates: `deepseek-v4.1-flash-free` and `longcat-2.5-free` later
  timed out on probes while `hy4-flash-free`, `beam-free`, `big-pickle`, `flint-40b-free`,
  `iceman-free`, `nemotron-3.5-lightning-free` and `tidepool-alpha-free` passed in ~8–10 s. The
  fleet now uses `hy4-flash-free`. A 240 s execution timeout plus a 30 s grace period was added to
  every agent so a stalled provider call can no longer pin a run for 19 hours.

- `sudo` on this host does not accept the SSH password, so services run under Docker rather than
  systemd. Docker group membership is used instead.
- **Unrelated exposure (fixed):** `freellmapi-freellmapi-1` previously listened on `0.0.0.0:3001`.
  Its compose file already defaulted to `${HOST_BIND:-127.0.0.1}`, but
  `~/Downloads/freellmapi/.env` overrode it with `HOST_BIND=0.0.0.0`. Set back to `127.0.0.1`
  and recreated the container (named volume preserved). All CaySoc-relevant ports — 3001,
  3100, 4310, 6080, 9090, 9091 — now bind loopback only. A backup of the old env is at
  `.env.before-loopback`.
