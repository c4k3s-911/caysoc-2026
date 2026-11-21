/**
 * CaySoc 0xSec agent role → MCP Swarm tool descriptor mapping.
 *
 * This file bridges the CaySoc Global fleet architecture (see
 * `CaySoc-AGENT-ARCHITECTURE.md`) with the MCP Swarm toolkit catalog
 * served at `/api/v2/toolkit`. Each agent role becomes a namespaced tool
 * with a security tier that determines visibility in the catalog.
 *
 * The swarm's per-cell rate limits and circuit‑breaker are applied
 * automatically based on the tool's `cell` prefix and `tier`.
 *
 * Tool naming convention: `<cell>:<agent‑role>` — e.g. `recon:scout`,
 * `exploitation:breacher`.  This lets the dispatcher and the rate‑bucket
 * service apply the correct quota.
 */

import type { SecurityTier, ToolkitToolDescriptor } from "./schemas.js";
import { CELL_RATE_LIMITS, type CellName } from "./token-bucket.js";

/**
 * Human‑readable descriptions for each role.  Used when the catalog
 * lists a tool for an agent to read.
 */
const AGENT_DESCRIPTIONS: Record<string, string> = {
  // Recon
  scout: "Passive OSINT — subdomain enumeration, DNS harvesting, certificate transparency logs",
  mapper: "Active enumeration — Nmap, Masscan, port/service mapping, tech fingerprinting",
  spider: "Web application crawling — endpoint discovery, parameter extraction, JS analysis",
  gatherer: "Credential/leak harvesting — GitHub search, GitLab, Bitbucket, TruffleHog, Gitleaks",
  technique: "TTP modeling — MITRE ATT&CK mapping, technology stack detection, fingerprinting",
  mirror: "Change detection — diffing previous scans, DNS monitoring, certificate transparency alerts",

  // Vulnerability Assessment
  scanner: "Automated vulnerability scanning — nuclei, nikto, wpscan, false‑positive elimination",
  prober: "Targeted probing — sqlmap, xsser, commix, config audit, benchmark tools",
  analyst: "Configuration audit, benchmarks — Lynis, CIS‑Cat, OSCAP, compliance reporting",
  docker: "Container/k8s security — Trivy, kube‑hunter, dockle, image vulnerability analysis",
  cloud: "Cloud infrastructure assessment — Scoutsuite, Paucu, Prowler, CSPM tools",
  wireless: "WiFi/Bluetooth audit — Aircrack‑ng, Reaver, Bettercap, spectrum analysis",

  // Exploitation
  breacher: "Initial access — Hydra, Medusa, Crowbar, brute‑force, credential stuffing",
  injector: "Payload injection — msfvenom, Empire, Sliver, reverse shells, process injection",
  pivot: "Lateral movement — Chisel, SSH‑tunnel, Ligolo, proxy chains, port forwarding",
  escalator: "Privilege escalation — LinPEAS, WinPEAS, Mimikatz, kernel exploits, token manipulation",
  persist: "Backdoor installation — custom implants, cron/at jobs, services, scheduled tasks",
  exfiltrator: "Data extraction — DNScat2, Iodine, steganography, encrypted tunnels, cloud upload",

  // Post‑Exploitation
  chronicler: "Evidence collection — KAPE, Velociraptor, forensic scripts, hashdeep, chain‑of‑custody logs",
  analyst_c: "Password cracking, data analysis — John the Ripper, Hashcat, RSMangler, statistical analysis",
  escaper: "AV/EDR evasion, AMSI bypass — Nimplant, Donut, Golang payloads, polymorphism",
  forensic: "Memory/disk forensics — Volatility, Rekall, Bulk‑Extractor, strings, timeline reconstruction",
  cover: "Log cleanup, OpSec — logwiper, Timestomp, artifact removal, anti‑forensics track covering",

  // Engineering & Support
  ops: "Infrastructure management — Docker, cron, VM management, CI/CD pipelines",
  notifier: "Alert routing, critical finding delivery — Discord/Telegram/Email, rate‑limited notifications",
  reporter: "Report generation, markdown → PDF, executive summaries, technical write‑ups",
  archiver: "Evidence storage, backups, compression, chain‑of‑custody preservation",
  comms: "Team coordination, status broadcast — daily briefings, task routing, status updates",
};

/**
 * Cell assignment for each role.  Determines which rate‑bucket (Recon/Exploitation/Audit)
 * and security tier the tool falls under.
 *
 * Rules of thumb:
 *   • Anything that touches targets, scans, or credentials                → RECON (50/min)
 *   • Anything that exploits, pivots, persists, or exfiltrates            → EXPLOITATION (10/min, strict)
 *   • Anything that audits, reports, or reviews config/compliance          → AUDIT (20/min)
 */
const ROLE_CELL: Record<string, CellName> = {
  // Recon
  scout: "RECON",
  mapper: "RECON",
  spider: "RECON",
  gatherer: "RECON",
  technique: "RECON",
  mirror: "RECON",

  // Vulnerability Assessment
  scanner: "RECON",      // scanning is high‑throughput recon
  prober: "RECON",
  analyst: "AUDIT",
  docker: "AUDIT",
  cloud: "AUDIT",
  wireless: "AUDIT",

  // Exploitation
  breacher: "EXPLOITATION",
  injector: "EXPLOITATION",
  pivot: "EXPLOITATION",
  escalator: "EXPLOITATION",
  persist: "EXPLOITATION",
  exfiltrator: "EXPLOITATION",

  // Post‑Exploitation
  chronicler: "EXPLOITATION",   // evidence collection sits alongside exploit work
  analyst_c: "EXPLOITATION",    // password cracking sits alongside exploit work
  escaper: "EXPLOITATION",      // evasion sits alongside exploit work
  forensic: "EXPLOITATION",     // forensic work is post‑exploitation
  cover: "EXPLOITATION",        // track covering is post‑exploitation

  // Engineering & Support
  ops: "RECON",                 // infra mgmt often starts with reconnaissance
  notifier: "AUDIT",            // alert routing is compliance‑adjacent
  reporter: "AUDIT",            // report generation is compliance‑adjacent
  archiver: "AUDIT",            // evidence storage is audit‑domain
  comms: "RECON",               // team coordination begins with info gathering
};

/**
 * Security tier assignment.  Determines whether the tool appears in
 * the `public`, `sensitive`, or `restricted` section of the catalog.
 *
 * Rules:
 *   • Pure recon / scanning                 → PUBLIC (anyone can see it)
 *   • Vulnerability data, docker/cloud checks → SENSITIVE (needs clearance)
 *   • Exploitation, post‑exploitation, evasion → RESTRICTED (authorised operators only)
 */
const ROLE_TIER: Record<string, SecurityTier> = {
  // Recon — publicly visible, read‑only surface mapping
  scout: "public",
  mapper: "public",
  spider: "public",
  gatherer: "public",
  technique: "public",
  mirror: "public",

  // Vuln assessment — scanner is public; prober/analyst/docker/cloud/wireless need clearance
  scanner: "public",
  prober: "sensitive",
  analyst: "sensitive",
  docker: "sensitive",
  cloud: "sensitive",
  wireless: "sensitive",

  // Exploitation — strict, only for authorised ops
  breacher: "restricted",
  injector: "restricted",
  pivot: "restricted",
  escalator: "restricted",
  persist: "restricted",
  exfiltrator: "restricted",

  // Post‑Exploitation — all restricted (evidence, evasion, forensics)
  chronicler: "restricted",
  analyst_c: "restricted",
  escaper: "restricted",
  forensic: "restricted",
  cover: "restricted",

  // Engineering & Support
  ops: "public",
  notifier: "sensitive",
  reporter: "sensitive",
  archiver: "sensitive",
  comms: "public",
};

/**
 * Map a CaySoc agent role to a MCP Swarm tool descriptor.
 *
 * @param role - The agent role name (e.g. `"scout"`, `"breacher"`)
 * @returns A `ToolkitToolDescriptor` ready for the catalog, or `undefined`
 *   if the role is not recognised.
 */
export function mapCaySocRoleToTool(role: string): ToolkitToolDescriptor | undefined {
  const cell = ROLE_CELL[role];
  if (cell === undefined) return undefined;

  const tier = ROLE_TIER[role];

  const name = `${cell.toLowerCase()}:${role}`; // e.g. "recon:scout"
  const displayName =
    role.charAt(0).toUpperCase() + role.slice(1); // e.g. "Scout"

  return {
    name,
    displayName,
    description: AGENT_DESCRIPTIONS[role] ?? `CaySoc 0xSec agent role: ${role}`,
    tier,
    parametersSchema: {}, // placeholder — the Python side fills in Pydantic schemas
    cell,
  };
}

/** All known CaySoc roles, mapped to tool descriptors. */
export const CAYSEC_TOOLS: ToolkitToolDescriptor[] = Object.keys(ROLE_CELL)
  .map((role) => mapCaySocRoleToTool(role))
  .filter((tool): tool is ToolkitToolDescriptor => tool !== undefined);

/**
 * Extended Chimera9-specific tool mappings beyond the core stager.
 * These cover rootkit, AMSI bypass, reflective DLL, process injection,
 * persistence mechanisms, C2 server config, and anti-forensics.
 */
export const CHIMERA9_EXTENDED_TOOLS: ToolkitToolDescriptor[] = [
  {
    name: "exploitation:chimera_rootkit",
    displayName: "Chimera9 Rootkit",
    description: "Kernel-mode rootkit with system call hooking (requires WDK compilation)",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        osVersion: { type: "string", description: "Windows version (e.g. '10.0.22621')" },
        wdkPath: { type: "string", description: "Path to WDK headers" },
        persistence: { type: "boolean", default: true },
      },
      required: ["osVersion"],
    },
  },
  {
    name: "exploitation:chimera_amsi_bypass",
    displayName: "Chimera9 AMSI Bypass",
    description: "AMSI evasion via character encoding manipulation and API unhooking",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        technique: {
          type: "string",
          enum: ["character-encoding", "api-unhook", "memory-patch", "comsvcs"],
        },
        payloadType: { type: "string", enum: ["powershell", "vbs", "js", "hta"] },
      },
      required: ["technique"],
    },
  },
  {
    name: "exploitation:chimera_reflective_dll",
    displayName: "Chimera9 Reflective DLL",
    description: "In-memory DLL loading without disk writes — fileless execution",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        dllPath: { type: "string", description: "Path to DLL payload" },
        targetProcess: { type: "string", description: "Target process name for injection" },
        args: { type: "string", description: "Command-line arguments for DLL entry point" },
      },
      required: ["dllPath"],
    },
  },
  {
    name: "exploitation:chimera_process_injection",
    displayName: "Chimera9 Process Injection",
    description: "Remote thread injection for payload execution in target process",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        targetPid: { type: "number", description: "Target process ID" },
        payload: { type: "string", description: "Shellcode or payload bytes (hex)" },
        injectionMethod: {
          type: "string",
          enum: ["CreateRemoteThread", "NtCreateThreadEx", "QueueUserAPC", "SetThreadContext"],
        },
      },
      required: ["targetPid", "payload"],
    },
  },
  {
    name: "exploitation:chimera_persistence_registry",
    displayName: "Chimera9 Registry Persistence",
    description: "Registry Run key persistence mechanism for auto-start execution",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        hive: { type: "string", enum: ["HKCU", "HKLM", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"] },
        keyName: { type: "string", description: "Registry value name" },
        payloadPath: { type: "string", description: "Full path to payload executable" },
        arguments: { type: "string", description: "Command-line arguments" },
      },
      required: ["hive", "keyName", "payloadPath"],
    },
  },
  {
    name: "exploitation:chimera_persistence_scheduled_task",
    displayName: "Chimera9 Scheduled Task",
    description: "Scheduled Task persistence with customizable triggers",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        taskName: { type: "string", description: "Task name (e.g. 'Microsoft\\Windows\\Update')" },
        trigger: { type: "string", enum: ["logon", "startup", "daily", "idle", "event"] },
        action: { type: "string", description: "Command to execute" },
        hidden: { type: "boolean", default: true },
      },
      required: ["taskName", "action"],
    },
  },
  {
    name: "exploitation:chimera_c2_server",
    displayName: "Chimera9 C2 Server",
    description: "Python-based C2 server with JSON API, stub generation, and client tracking",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        port: { type: "number", default: 8081 },
        host: { type: "string", default: "0.0.0.0" },
        payloadDir: { type: "string", description: "Directory for generated stubs" },
        ssl: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "recon:chimera_beacon_jitter",
    displayName: "Chimera9 Beacon Jitter",
    description: "Jittered beacon timing for C2 traffic obfuscation and IDS evasion",
    tier: "public",
    cell: "RECON",
    parametersSchema: {
      type: "object",
      properties: {
        baseInterval: { type: "number", default: 60, description: "Base beacon interval in seconds" },
        jitterRange: { type: "number", default: 15, description: "Random jitter range (±seconds)" },
        backoffMultiplier: { type: "number", default: 2, description: "Exponential backoff multiplier on failure" },
      },
    },
  },
  {
    name: "audit:chimera_log_cleanup",
    displayName: "Chimera9 Log Cleanup",
    description: "Event log clearing and artifact removal for operational security",
    tier: "sensitive",
    cell: "AUDIT",
    parametersSchema: {
      type: "object",
      properties: {
        logName: { type: "string", enum: ["Security", "System", "Application", "PowerShell", "All"] },
        filter: { type: "string", description: "Event ID or source filter" },
        method: { type: "string", enum: ["wevtutil", "Clear-EventLog", "manual"] },
      },
    },
  },
  {
    name: "audit:chimera_timestomp",
    displayName: "Chimera9 Timestomp",
    description: "Filetime timestamp manipulation to match surrounding files",
    tier: "sensitive",
    cell: "AUDIT",
    parametersSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Target file path" },
        referenceFile: { type: "string", description: "Reference file to copy timestamps from" },
        customTimestamp: { type: "string", description: "Custom ISO8601 timestamp" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "exploitation:chimera_api_hashing",
    displayName: "Chimera9 API Hashing",
    description: "Dynamically resolve ntdll functions via hashing to evade static detection",
    tier: "restricted",
    cell: "EXPLOITATION",
    parametersSchema: {
      type: "object",
      properties: {
        functionName: { type: "string", description: "API function name (e.g. 'NtAllocateVirtualMemory')" },
        hashAlgorithm: { type: "string", enum: ["fnv1a", "crc32", "custom"], default: "fnv1a" },
        dllName: { type: "string", enum: ["ntdll.dll", "kernel32.dll", "user32.dll"], default: "ntdll.dll" },
      },
    },
  },
];

/** Quick lookup: cell → list of tool descriptors assigned to that cell. */
export function getToolsByCell(cell: CellName): ToolkitToolDescriptor[] {
  return CAYSEC_TOOLS.filter((t) => t.cell === cell);
}

/** Quick lookup: tier → list of tool descriptors at that tier. */
export function getToolsByTier(tier: SecurityTier): ToolkitToolDescriptor[] {
  return CAYSEC_TOOLS.filter((t) => t.tier === tier);
}

/** Validate that a given cell/role combination is authorised. */
export function isAuthorized(role: string, requiredTier: SecurityTier): boolean {
  const tool = mapCaySocRoleToTool(role);
  if (!tool) return false;
  return tool.tier === requiredTier || requiredTier === "public";
}

/** Get the rate‑limit bucket name for a given role. */
export function getRateBucket(role: string): CellName {
  return ROLE_CELL[role] ?? "RECON"; // default to recon if unknown
}

/** Get the security tier for a given role. */
export function getTier(role: string): SecurityTier {
  return ROLE_TIER[role] ?? "public"; // default to public if unknown
}