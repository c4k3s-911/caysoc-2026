# CaySoc Global — Full Agent Fleet Architecture

> **Version:** 1.0 | **Date:** 2026-07-20 | **Fleet:** 80 agents across 5 companies

---

## 🏢 Company Hierarchy

```
CaySoc Global (parent/oversight) ─ 2 agents
├── 0xSec.za (pentest) ───────────── 34 agents
├── xploit.za (exploit R&D) ──────── 25 agents
├── Caelum.za (intel/scanning) ───── 10 agents
└── Azure (cloud security) ─────────  9 agents
```

### Cross-Company Data Flow

```
Caelum.za (Intel) ──intel findings──→ xploit.za (Exploit R&D)
xploit.za ──exploit packages──→ 0xSec.za (Field Testing)
Azure (Cloud Security) ──cloud posture──→ All subsidiaries
All 4 subs ──findings feed──→ Reputation Scoring Bureau
All 4 subs ──daily digest──→ CaySoc Global (Oversight)
```

---

## 1. CaySoc Global (Parent — Strategic Oversight)

| Agent | Model | Role | PULSE | Skills |
|-------|-------|------|-------|--------|
| **ORACLE** | `llama3.2:3b` | CEO — strategic direction, portfolio oversight | ✅ | `strategic-planning`, `cross-company-ops` |
| **Reflection Coach** | `qwen2.5:1.5b` | Self-learning feedback, meta-cognition | ✅ | `self-improvement`, `performance-analysis` |

### Routines

| Routine | Schedule (UTC) | Description |
|---------|---------------|-------------|
| `daily-briefing` | 05:00 | Synthesize outputs from all 4 subsidiary CEOs |
| `strategic-review` | Mon 08:00 | Portfolio health, revenue pipeline, resource allocation |
| `self-improvement` | Every 12h | Review agent performance metrics, suggest skill/tool upgrades |
| `weekly-report` | Fri 12:00 | Board-level weekly summary |

---

## 2. 0xSec.za — Pentest Operations (34 agents)

**Lead:** **Citadel** (`llama3.2:3b`)
**Project:** Security Operations
**Primary Routine:** Continuous Security Monitoring

### 2.1 Reconnaissance Team (6 agents — `gemma3:4b`)

| Agent | Focus | Tools |
|-------|-------|-------|
| **Scout** | ASN/DNS recon, subdomain enumeration | `amass`, `subfinder`, `dnsx` |
| **Mapper** | Port scanning, service fingerprinting | `nmap`, `rustscan`, `masscan` |
| **Spider** | Web crawling, endpoint discovery | `katana`, `gospider`, `ffuf` |
| **Gatherer** | OSINT (GitHub, Shodan, Censys) | `shodan-cli`, `gh-dork`, `waybackpy` |
| **Technique** | Technology stack detection | `wappalyzer`, `whatweb`, `builtwith` |
| **Mirror** | Website mirroring, screenshots | `httpx`, `gowitness`, `aquatone` |

### 2.2 Vulnerability Assessment Team (6 agents — `gemma3:4b`)

| Agent | Focus | Tools |
|-------|-------|-------|
| **Scanner** | Automated vulnerability scanning | `nuclei`, `nikto`, `wpscan` |
| **Prober** | Web application testing | `sqlmap`, `xsser`, `commix` |
| **Analyst** | Configuration audit, benchmarks | `lynis`, `oscap`, `cis-cat` |
| **Docker** | Container/k8s security | `trivy`, `kube-hunter`, `dockle` |
| **Cloud** | Cloud infrastructure assessment | `scoutsuite`, `pacu`, `prowler` |
| **Wireless** | WiFi/Bluetooth audit | `aircrack-ng`, `reaver`, `bettercap` |

### 2.3 Exploitation Team (6 agents — `gemma3:4b`)

| Agent | Focus | Tools |
|-------|-------|-------|
| **Breacher** | Initial access, brute force | `hydra`, `medusa`, `crowbar` |
| **Injector** | Payload injection, reverse shells | `msfvenom`, `empire`, `sliver` |
| **Pivot** | Lateral movement, tunneling | `chisel`, `sshuttle`, `ligolo` |
| **Escalator** | Privilege escalation | `linpeas`, `winpeas`, `mimikatz` |
| **Persist** | Backdoor installation, persistence | custom implants, cron/at jobs, services |
| **Exfiltrator** | Data extraction, tunneling | `dnscat2`, `iodine`, `stegocamouflage` |

### 2.4 Post-Exploitation Team (5 agents — `gemma3:4b`)

| Agent | Focus | Tools |
|-------|-------|-------|
| **Chronicler** | Evidence collection, chain of custody | `exiftool`, `hashdeep`, log capture |
| **Analyst** | Password cracking, data analysis | `john`, `hashcat`, `rsmangler` |
| **Escaper** | AV/EDR evasion, AMSI bypass | `nimplant`, `donut`, golang payloads |
| **Forensic** | Memory/disk forensics | `volatility`, `bulk_extractor`, `strings` |
| **Cover** | Log cleanup, OpSec | logwiper, timestomp, cloak |

### 2.5 Engineering & Support (5 agents — `qwen2.5:1.5b`)

| Agent | Focus |
|-------|-------|
| **Ops** | Infrastructure management, Docker, cron |
| **Notifier** | Alert routing, Discord/Telegram delivery |
| **Reporter** | Report generation, markdown → PDF |
| **Archiver** | Evidence storage, backups, compression |
| **Comms** | Team coordination, status broadcast |

### 2.6 Quality & Management (6 agents — mixed models)

| Agent | Model | Focus |
|-------|-------|-------|
| **Hermes** | `qwen2.5:1.5b` | Agent orchestration, task routing |
| **QAI** | `gemma3:4b` | QA validation, finding accuracy |
| **Verifier** | `gemma3:4b` | Cross-team verification, duplicate detection |
| **Auditor** | `gemma3:4b` | Compliance, methodology adherence |
| **PM** | `qwen2.5:1.5b` | Project management, timelines |
| **PULSE** | `qwen2.5:0.5b` | Health checks, heartbeat monitor |

### 0xSec.za Routines (7)

| Routine | Schedule (UTC) | Pipeline |
|---------|---------------|----------|
| `daily-recon` | 04:00 | Scout → Mapper → Spider → Gatherer |
| `vuln-scan` | 05:00 | Scanner → Prober → Analyst |
| `exploit-attempt` | 06:00 | Breacher → Injector → Escalator |
| `post-exploit` | 07:00 | Chronicler → Analyst → Forensic |
| `report-gen` | 08:00 | Reporter → Archiver → Notifier |
| `quality-gate` | 09:00 | QAI → Verifier → Auditor |
| `cover-tracks` | Every 8h | Escaper → Persist → Cover |

---

## 3. xploit.za — Exploit R&D (25 agents)

**Lead:** **Phase** (`llama3.2:3b`)
**Project:** Exploit Development Pipeline

### 3.1 Research Team (6 agents — `gemma3:4b`)

| Agent | Focus |
|-------|-------|
| **CVE-Hunter** | 24/7 NVD/CVE monitoring, patch diff analysis, GitHub advisory watch |
| **Binary-Analyst** | Binary diffing (diaphora), vulnerability root cause analysis |
| **Reverser** | Ghidra/IDA disassembly, decompilation, pseudo-code generation |
| **Fuzzer** | AFL/libFuzzer harness setup, crash triage, coverage-guided fuzzing |
| **Debugger** | GDB/WinDbg exploit debugging, ROP chain development, SEH/veh |
| **Scripter** | Python/C/Go/Rust exploit scripting, PoC automation |

### 3.2 Development Team (6 agents — `gemma3:4b`)

| Agent | Focus |
|-------|-------|
| **Weaponizer** | PoC → reliable exploit (metasploit module, standalone binary) |
| **Evasion** | AV/EDR bypass — ETW patching, AMSI bypass, syscall stomping |
| **Stager** | Dropper/stager development (HTTPS, DNS, ICMP) |
| **Multi-Platform** | Cross-platform porting (Win → Linux → macOS) |
| **Integrator** | Chaining exploits, multi-stage attack development |
| **Tester** | Live target validation, edge case testing, stability runs |

### 3.3 Engineering Team (5 agents — `qwen2.5:1.5b`)

| Agent | Focus |
|-------|-------|
| **Builder** | CI/CD for exploit builds, cross-compilation (mingw, zig) |
| **Packager** | Delivery packaging, obfuscation, anti-analysis |
| **Doc-Writer** | Technical write-ups, CVE advisories, TTP documentation |
| **DB-Mgr** | Exploit database, payload library, signature storage |
| **Deployer** | Subscriber feed management, distribution pipeline |

### 3.4 Quality Team (4 agents — `gemma3:4b`)

| Agent | Focus |
|-------|-------|
| **Code-Review** | Code quality, zero-day review, static analysis |
| **Stability** | Reliability testing, crash analysis, memory safety |
| **Security** | OpSec review, anti-forensics check, attribution avoidance |
| **Audit** | Methodology audit, TTP chain verification |

### 3.5 Support (4 agents — `qwen2.5:1.5b`)

| Agent | Focus |
|-------|-------|
| **Coordinator** | Task routing, priority management, team sync |
| **Reporter** | Customer delivery notifications, status updates |
| **Infra** | Dev environment management, tool updates, VM management |
| **PULSE** | Health monitoring, heartbeat |

### xploit.za Routines (7)

| Routine | Schedule (UTC) | Pipeline |
|---------|---------------|----------|
| `cve-research` | 03:00 | CVE-Hunter → Binary-Analyst → Reverser |
| `fuzzing-ops` | 04:00 | Fuzzer → Debugger → Scripter |
| `exploit-dev` | 05:00 | Weaponizer → Evasion → Stager |
| `integration` | 06:00 | Integrator → Tester → Multi-Platform |
| `build-package` | 07:00 | Builder → Packager → Doc-Writer |
| `qc-gate` | 08:00 | Code-Review → Stability → Security |
| `opsec-cycle` | Every 6h | Audit → Deployer → Coordinator |

---

## 4. Caelum.za — Intelligence/Scanning (10 agents)

**Lead:** **Phase** (`llama3.2:3b`)
**Project:** Intelligence Operations

### Agent Roster

| Agent | Model | Role | Tools |
|-------|-------|------|-------|
| **Phase** (Lead) | `llama3.2:3b` | Intel operations director, cross-company routing | Orchestration |
| **Beacon** | `gemma3:4b` | Signal collection, threat feed ingestion (AlienVault, MISP, CVEDetails) | `curl`, `jq`, feed parsers |
| **Veil** | `gemma3:4b` | Dark web monitoring, Telegram/IRC/Discord intel | `tor`, `telegram-cli`, `weechat` |
| **Dusk** | `qwen2.5:1.5b` | Oscillating recon, change detection on target surfaces | `watch`, diff tools |
| **Apex** | `qwen2.5:1.5b` | Fusion analysis, cross-source correlation | Custom ML correlation |
| **Reaper** | `gemma3:4b` | Threat actor profiling, TTP mapping (MITRE ATT&CK) | MITRE API, threat intel feeds |
| **Oracle** | `qwen2.5:1.5b` | Predictive analysis, trend forecasting | Statistical models |
| **Whisper** | `qwen2.5:1.5b` | Social media sentiment, chatter monitoring | Twitter/X API, Reddit |
| **Watchtower** | `qwen2.5:1.5b` | Infrastructure monitoring, uptime/health | Prometheus, ping, curl |
| **Archive** | `qwen2.5:0.5b` | Data storage, S3/DB archival, indexing, historical queries | `s3cmd`, `rsync` |

### Caelum.za Routines (7)

| Routine | Schedule (UTC) | Description |
|---------|---------------|-------------|
| `osint-collection` | 04:00 | Beacon → Veil → Whisper cycle |
| `threat-analysis` | 05:00 | Reaper → Oracle → Apex |
| `dark-web-sweep` | 06:00 | Veil deep scan |
| `recon-oscillation` | 07:00 | Dusk differential scan |
| `fusion-intel` | 08:00 | Apex cross-correlation report |
| `archive-index` | 09:00 | Archive data retention |
| `opsec-cover` | Every 6h | Cover track cycle |

---

## 5. Azure — Cloud Security Operations (9 agents)

**Lead:** **Pinnacle** (`llama3.2:3b`)
**Project:** Cloud Security Monitoring

### Agent Roster

| Agent | Model | Role | Scope |
|-------|-------|------|-------|
| **Pinnacle** (Lead) | `llama3.2:3b` | Cloud security director | All CSPs |
| **Sentinel** | `gemma3:4b` | Azure security monitoring, Microsoft Defender | Azure |
| **Summit** | `gemma3:4b` | Infrastructure scanning (Azure/AWS/GCP) | Multi-Cloud |
| **Stratos** | `qwen2.5:1.5b` | Serverless/container security | K8s, Docker |
| **Horizon** | `qwen2.5:1.5b` | Compliance audit (SOC2, ISO27001, PCI DSS) | Compliance |
| **Dynamo** | `qwen2.5:1.5b` | Automation & remediation | Auto-fix |
| **Cirrus** | `qwen2.5:1.5b` | Network security, WAF/CDN analysis | Network |
| **Vanguard** | `qwen2.5:0.5b` | Threat detection, SIEM correlation | Detection |
| **Aegis** | `qwen2.5:0.5b` | Identity & access management audit | IAM |

### Azure Routines (7)

| Routine | Schedule (UTC) | Description |
|---------|---------------|-------------|
| `cloud-scan` | 04:00 | Summit → Sentinel → Cirrus |
| `compliance-check` | 05:00 | Horizon → Aegis audit |
| `remediation` | 06:00 | Dynamo auto-fix cycle |
| `threat-hunt` | 07:00 | Vanguard → Sentinel analysis |
| `container-audit` | 08:00 | Stratos docker/k8s check |
| `iam-review` | 09:00 | Aegis permission audit |
| `report-escalate` | 10:00 | Pinnacle summary → CaySoc |

---

## 6. Product Line — CVE→Exploit Pipeline

**Tagline:** *First-to-market exploit delivery — reverse-engineer, weaponize, distribute*

### Cross-Company Agents

| Role | Source Company | Agent(s) |
|------|---------------|----------|
| CVE Monitor | Caelum.za | CVE-Hunter, Beacon |
| Patch RE | xploit.za | Binary-Analyst, Reverser |
| Weaponize | xploit.za | Weaponizer, Evasion |
| Test | xploit.za | Tester, Debugger |
| Deliver | xploit.za | Deployer, Packager |
| Feed Mgmt | CaySoc Global | ORACLE |

### Pipeline Steps

```
📡 CVE Monitor (24/7 NVD/Twitter/GitHub)
    ↓
🔬 Patch RE (binary diff → vuln root cause)
    ↓
💻 Weaponize (agent auto-writes exploit PoC)
    ↓
🎯 Test (live target validation)
    ↓
📦 Ship (subscriber feed + premium tier)
```

### KPIs (Target)
- **Exploits Shipped (MTD):** 47
- **Avg. CVE→Exploit Time:** 3.2h
- **Active Subscribers:** 12
- **Feed Revenue (Q3):** $2.4M

---

## 7. Product Line — Cyber Warfare Battle Simulation

**Tagline:** *Nation-state red-vs-blue wargames — $500k+/engagement*

### Engagement Team Composition

| Team | Source Company | Agents | Role |
|------|---------------|--------|------|
| **Red Cell** | 0xSec.za + xploit.za | 30 | Offensive APT simulation |
| **Blue Cell** | Azure + Caelum | 10 | Defense, detection, response |
| **Intel Cell** | Caelum.za | 5 | Real threat intel injection |
| **Weapons Cell** | xploit.za | 6 | Custom TTP development |
| **White Cell** | CaySoc Global | 2 | Control, scoring, AAR |

### Simulated APT Groups (12)

| APT Group | Origin | TTPs | Agents Assigned |
|-----------|--------|------|-----------------|
| **Lazarus** | 🇰🇵 DPRK | Supply chain, crypto heists, macOS | 10 |
| **APT29 (Cozy Bear)** | 🇷🇺 SVR | Phishing, VPN, cloud abuse | 8 |
| **Kimsuky** | 🇰🇵 DPRK | Spear-phishing, recon | 6 |
| **APT41** | 🇨🇳 China | Dual-purpose espionage, gaming | 6 |
| **APT33 (Elfin)** | 🇮🇷 Iran | Destructive, ICS targeting | 5 |
| **APT40 (Gadolinium)** | 🇨🇳 China | Maritime, aerospace | 5 |
| **Sandworm** | 🇷🇺 GRU | ICS, power grid, destructive | 5 |
| **Fancy Bear (APT28)** | 🇷🇺 GRU | Political, DNC, Olympics | 4 |
| **Wizard Spider** | 🇷🇺 Russia | Ransomware, big-game hunting | 4 |
| **APT-C-36 (Blind Eagle)** | 🇨🇴 Colombia | Financial, government | 3 |
| **APT37 (ScarCruft)** | 🇰🇵 DPRK | ROK targets, weapon docs | 3 |
| **APT38 (BlueNoroff)** | 🇰🇵 DPRK | SWIFT, crypto exchange | 3 |

### Engagement Metrics (FY2026)
- **Engagements:** 8
- **Revenue Generated:** $4.2M
- **Agent Army Size:** 66
- **Avg Duration:** 14 days
- **Crown Jewels Breached (benchmark):** 3/12 (improved from 8/12)
- **Blue Team MTTD:** 47 min (baseline: 120 min)

---

## 8. Product Line — Cyber Reputation Scoring Bureau

**Tagline:** *Credit-rating-style security posture index — recurring SaaS*

### Scoring Methodology

| Factor | Weight | Description |
|--------|--------|-------------|
| **Attack Surface** | 35% | External exposure, open ports, subdomains, cloud assets |
| **Patch Velocity** | 25% | Mean time to patch critical CVEs |
| **Breach History** | 20% | Known breaches, data leaks, dark web exposure |
| **Security Controls** | 20% | SPF/DMARC, HSTS, CSP, SSL/TLS config, MFA adoption |

### Scoring Agents

| Role | Company | Agent(s) | Task |
|------|---------|----------|------|
| Surface Scanners | Caelum.za | Beacon, Dusk | Continuous external surface measurement |
| Leak Detectors | Caelum.za | Veil | Dark web breach monitoring |
| Cloud Assessors | Azure | Summit, Cirrus | Cloud security control verification |
| Scoring Engine | CaySoc Global | ORACLE | Automated scoring algorithm |
| Feed Publisher | All | Notifier, Deployer | Daily score updates, trend analysis |

### KPIs (Current)
- **Scored Entities:** 1,847
- **MRR (Recurring):** $68K
- **Score Updates/Day:** 23
- **High-Risk Entities:** 842
- **Top Score:** Microsoft — 92/100
- **Bottom Score:** Optus — 27/100

---

## 9. Self-Learning & Innovation Pipeline

### Meta-Cognition Layer
| Component | Description | Frequency |
|-----------|-------------|-----------|
| **Reflection Coach** | Analyzes agent task success/failure patterns | Every 12h |
| **Skill Upgrade** | Recommends new tools, updated prompts, refined routines | Daily |
| **Performance Dashboard** | Fleet-wide metrics (success rate, time-to-complete, error rate) | Continuous |
| **Innovation Queue** | Agent-submitted ideas for process/tool improvements | Rolling |

### Improvement Cycle
```
1. Collect metrics from all agents
2. Analyze for bottlenecks, failures, inefficiencies
3. Generate improvement recommendations
4. Test improvements in sandbox (2 cycles)
5. Roll out to production fleet
6. Monitor impact, revert if regressions
```

---

## 10. Global Schedule (35+ Routines)

| Time (UTC) | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------------|-----|-----|-----|-----|-----|-----|-----|
| **03:00** | x:CVE | x:CVE | x:CVE | x:CVE | x:CVE | x:CVE | x:CVE |
| **04:00** | 0:Recon, C:OSINT, A:Scan | same | same | same | same | same | same |
| **05:00** | 0:Vuln, C:Threat, A:Comply | same | same | same | same | same | same |
| **06:00** | 0:Exploit, A:Remediate | same | same | same | same | 0:Exploit | 0:Exploit |
| **07:00** | 0:PostExp, C:Recon, A:Hunt | same | same | same | same | — | — |
| **08:00** | 0:Report, C:Fusion, A:Cont | same | same | same | same | — | — |
| **09:00** | 0:QA, C:Archive, A:IAM | same | same | same | same | — | — |
| **10:00** | A:Report, C:Digest | — | — | — | C:Weekly | — | — |
| **Every 6h** | 0:Cover, x:OpSec, C:Cover | | | | | | |
| **Every 8h** | 0:Cover-tracks | | | | | | |
| **Every 12h** | x:Build, C:Self-improve | | | | | | |

**Legend:** 0=0xSec.za, x=xploit.za, C=Caelum.za, A=Azure

---

## 11. Skill & Tool Ecosystem

### 19 Core Skills Deployed

| Skill Key | Scope | Description |
|-----------|-------|-------------|
| `pentest-operations` | 0xSec.za | Full pentest methodology framework |
| `exploit-development` | xploit.za | CVE-to-exploit pipeline procedures |
| `intelligence-analysis` | Caelum.za | OSINT/threat intel collection & analysis |
| `cloud-security` | Azure | Multi-CSP security assessment |
| `incident-response` | All | IR procedures and playbooks |
| `cross-company-ops` | CaySoc Global | Inter-company coordination & data routing |
| `reconnaissance` | 0xSec.za | Active/passive recon techniques |
| `vulnerability-assessment` | 0xSec.za | Vuln scanning & analysis methodology |
| `post-exploitation` | 0xSec.za | Post-exploit operations |
| `social-engineering` | 0xSec.za | Phishing/pretext frameworks |
| `wireless-audit` | 0xSec.za | WiFi/BT assessment procedures |
| `binary-analysis` | xploit.za | RE, fuzzing, debugging workflows |
| `payload-development` | xploit.za | Shellcode/implant development |
| `evasion-techniques` | xploit.za | AV/EDR bypass methodology |
| `osint-collection` | Caelum.za | Open source intelligence gathering |
| `dark-web-monitoring` | Caelum.za | Dark web intel procedures |
| `cloud-hardening` | Azure | CSP hardening benchmarks |
| `compliance-audit` | Azure | SOC2/ISO/PCI audit procedures |
| `reputation-scoring` | Cross | Scoring engine methodology |

---

## 12. Model Distribution

| Model | Role | Agents | Use Case |
|-------|------|--------|----------|
| `llama3.2:3b` | Lead/CEO | 5 | Strategic reasoning, orchestration, reporting |
| `gemma3:4b` | Specialist | 36 | Complex analysis, exploit dev, intel analysis |
| `qwen2.5:1.5b` | Engineer | 30 | Scripting, automation, support, engineering |
| `qwen2.5:0.5b` | PULSE/Monitor | 9 | Health checks, heartbeats, lightweight tasks |

---

## 13. GitHub DB Schema (All Tables)

### Core Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user` | Platform users/auth | `id`, `email`, `name` |
| `account` | OAuth/provider accounts | `userId`, `provider`, `providerAccountId` |
| `session` | Auth sessions | `userId`, `expiresAt` |
| `instance_user_roles` | Instance-level role assignments | `userId`, `role` |
| `board_api_keys` | Board-level API authentication | `userId`, `name`, `keyHash` |
| `agent_api_keys` | Agent-level API keys | `agentId`, `keyHash`, `companyId` |

### Company Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `company` | Company/tenant record | `id`, `name`, `slug`, `issuePrefix` |
| `company_skills` | Skills deployed per company | `companyId`, `key`, `slug`, `markdown` |

### Agent Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `agent` | Agent record | `id`, `name`, `slug`, `companyId`, `projectId`, `model`, `status` |
| `agent_api_keys` | Agent authentication | `agentId`, `keyHash`, `companyId` |
| `agent_permissions` | Agent capability grants | `agentId`, `canCreateAgents`, `canCreateSkills`, `canAssignTasks` |
| `agent_instruction_bundles` | Agent prompt/instructions | `agentId`, `path`, `content`, `clearLegacyPromptTemplate` |
| `agent_routines` | Agent routine assignments | `agentId`, `routineId` |
| `agent_desired_skills` | Skill sync table | `agentId`, `skillKey` |

### Routine Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `routine` | Routine definition | `id`, `title`, `companyId`, `projectId` |
| `routine_trigger` | Routine scheduling | `routineId`, `kind`, `cronExpression`, `timezone`, `enabled` |
| `routine_run` | Routine execution log | `routineId`, `status`, `startedAt`, `completedAt` |

### Project Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `project` | Project record | `id`, `name`, `slug`, `companyId` |

### Pipeline Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pipeline` | Pipeline definition | `id`, `name`, `companyId` |
| `pipeline_stage` | Stage within pipeline | `pipelineId`, `name`, `order` |
| `pipeline_routine` | Routines attached to pipeline | `pipelineId`, `routineId`, `stageId` |

### Activity / Log Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `activity_log` | Mutation audit trail | `actorId`, `action`, `entityType`, `entityId`, `companyId` |
| `issue` | Issue/task tracking | `id`, `title`, `status`, `companyId`, `projectId`, `assigneeId` |
| `issue_comment` | Comments on issues | `issueId`, `authorId`, `body` |

### Board/UI Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `board_api_keys` | Board auth tokens | `userId`, `name`, `keyHash` |
| `onboarding_state` | Company onboarding progress | `companyId`, `step`, `completed` |

### Relations Diagram (Logical)
```
company ──┬── agent ── agent_api_keys
          ├── company_skills
          ├── project ── issue
          ├── routine ── routine_trigger ── routine_run
          ├── pipeline ── pipeline_stage ── pipeline_routine
          └── activity_log

user ── account
user ── session
user ── board_api_keys
user ── instance_user_roles

agent ── agent_permissions
agent ── agent_instruction_bundles
agent ── agent_routines ── routine
agent ── agent_desired_skills ── company_skills
```
