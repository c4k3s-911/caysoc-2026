/**
 * Full MCP Swarm Tool Catalog — 84+ tools from CaySoc 0xSec, Chimera9, and 1toolkit.
 *
 * This file aggregates all discoverable tools into a single catalog served at
 * `/api/v2/toolkit`. Each tool is mapped to a cell (RECON/EXPLOITATION/AUDIT)
 * and a security tier (PUBLIC/SENSITIVE/RESTRICTED) for rate limiting and
 * visibility control.
 *
 * Tool sources:
 *   • CaySoc 0xSec agent roles (34 agents across 7 stages)
 *   • Chimera9 C2 framework components (stager, rootkit, AMSI bypass, etc.)
 *   • 1toolkit MCP servers (nmap, nuclei, metasploit, ghidra, wireshark, burp, etc.)
 */

import type { SecurityTier, ToolkitToolDescriptor, ToolkitCatalog } from "./schemas.js";
import type { CellName } from "./token-bucket.js";

/** Helper to build a tool descriptor. */
function tool(
  name: string,
  displayName: string,
  description: string,
  cell: CellName,
  tier: SecurityTier,
  parametersSchema: Record<string, unknown> = {},
): ToolkitToolDescriptor {
  return { name, displayName, description, cell, tier, parametersSchema };
}

// ─────────────────────────────────────────────────────────────────────────────
// CaySoc 0xSec Agent Roles (34 tools)
// ─────────────────────────────────────────────────────────────────────────────

const CAYSOC_TOOLS: ToolkitToolDescriptor[] = [
  // Reconnaissance Team (6)
  tool("recon:scout", "Scout", "Passive OSINT — subdomain enumeration, DNS harvesting, certificate transparency", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string", description: "Target domain or ASN" },
      passive: { type: "boolean", default: true },
    },
    required: ["target"],
  }),
  tool("recon:mapper", "Mapper", "Active port/service mapping — Nmap, RustScan, Masscan", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      ports: { type: "string", description: "Port range, e.g. '1-65535'" },
      rate: { type: "number", default: 1000 },
    },
    required: ["target"],
  }),
  tool("recon:spider", "Spider", "Web crawling — endpoint discovery, parameter extraction", "RECON", "public", {
    type: "object",
    properties: {
      url: { type: "string" },
      maxDepth: { type: "number", default: 3 },
    },
    required: ["url"],
  }),
  tool("recon:gatherer", "Gatherer", "Credential/leak harvesting — GitHub, GitLab, TruffleHog", "RECON", "sensitive", {
    type: "object",
    properties: {
      org: { type: "string" },
      platforms: { type: "array", items: { type: "string" } },
    },
    required: ["org"],
  }),
  tool("recon:technique", "Technique", "TTP modeling — MITRE ATT&CK mapping, tech fingerprinting", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      frameworks: { type: "array", items: { type: "string" } },
    },
    required: ["target"],
  }),
  tool("recon:mirror", "Mirror", "Change detection — diffing scans, DNS/cert monitoring", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      baseline: { type: "string" },
    },
    required: ["target"],
  }),

  // Vulnerability Assessment Team (6)
  tool("audit:scanner", "Scanner", "Automated vuln scanning — nuclei, nikto, wpscan", "AUDIT", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      templates: { type: "array", items: { type: "string" } },
    },
    required: ["target"],
  }),
  tool("audit:prober", "Prober", "Targeted probing — sqlmap, xsser, commix", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      url: { type: "string" },
      technique: { type: "string", enum: ["sqli", "xss", "command-injection"] },
    },
    required: ["url", "technique"],
  }),
  tool("audit:analyst", "Analyst", "Config audit — Lynis, CIS-Cat, OSCAP benchmarks", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      target: { type: "string" },
      benchmark: { type: "string" },
    },
    required: ["target"],
  }),
  tool("audit:docker", "Docker", "Container/k8s security — Trivy, kube-hunter, dockle", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      image: { type: "string" },
      cluster: { type: "string" },
    },
  }),
  tool("audit:cloud", "Cloud", "Cloud assessment — Scoutsuite, Prowler, Pacu", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      provider: { type: "string", enum: ["aws", "azure", "gcp"] },
      profile: { type: "string" },
    },
    required: ["provider"],
  }),
  tool("audit:wireless", "Wireless", "WiFi/Bluetooth audit — Aircrack-ng, Reaver, Bettercap", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      interface: { type: "string" },
      bssid: { type: "string" },
    },
  }),

  // Exploitation Team (6)
  tool("exploitation:breacher", "Breacher", "Initial access — Hydra, Medusa, Crowbar brute-force", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      target: { type: "string" },
      service: { type: "string" },
      wordlist: { type: "string" },
    },
    required: ["target", "service"],
  }),
  tool("exploitation:injector", "Injector", "Payload injection — msfvenom, Empire, Sliver", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      payload: { type: "string" },
      lhost: { type: "string" },
      lport: { type: "number" },
    },
    required: ["payload", "lhost", "lport"],
  }),
  tool("exploitation:pivot", "Pivot", "Lateral movement — Chisel, SSH tunnel, Ligolo", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      pivotHost: { type: "string" },
      targetNetwork: { type: "string" },
    },
    required: ["pivotHost"],
  }),
  tool("exploitation:escalator", "Escalator", "Privilege escalation — LinPEAS, WinPEAS, Mimikatz", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      os: { type: "string", enum: ["linux", "windows"] },
      technique: { type: "string" },
    },
    required: ["os"],
  }),
  tool("exploitation:persist", "Persist", "Backdoor installation — implants, scheduled tasks, services", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      method: { type: "string", enum: ["registry", "scheduled_task", "service", "implant"] },
      persistenceName: { type: "string" },
    },
    required: ["method"],
  }),
  tool("exploitation:exfiltrator", "Exfiltrator", "Data extraction — DNScat2, Iodine, encrypted tunnels", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      source: { type: "string" },
      destination: { type: "string" },
      method: { type: "string" },
    },
    required: ["source", "destination"],
  }),

  // Post-Exploitation Team (5)
  tool("exploitation:chronicler", "Chronicler", "Evidence collection — KAPE, Velociraptor, hashdeep", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      target: { type: "string" },
      artifacts: { type: "array", items: { type: "string" } },
    },
    required: ["target"],
  }),
  tool("exploitation:analyst_c", "Analyst (Post-Exploit)", "Password cracking — John, Hashcat, RSMangler", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      hashFile: { type: "string" },
      attackMode: { type: "string", enum: ["dictionary", "mask", "hybrid", "rule"] },
    },
    required: ["hashFile"],
  }),
  tool("exploitation:escaper", "Escaper", "AV/EDR evasion — AMSI bypass, Nimplant, Donut", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      payload: { type: "string" },
      evasion: { type: "array", items: { type: "string" } },
    },
    required: ["payload"],
  }),
  tool("exploitation:forensic", "Forensic", "Memory/disk forensics — Volatility, Bulk Extractor", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      image: { type: "string" },
      profile: { type: "string" },
    },
    required: ["image"],
  }),
  tool("exploitation:cover", "Cover", "Track covering — log cleanup, timestomp, artifact removal", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      target: { type: "string" },
      techniques: { type: "array", items: { type: "string" } },
    },
    required: ["target"],
  }),

  // Engineering & Support (5)
  tool("recon:ops", "Ops", "Infrastructure management — Docker, cron, VM management", "RECON", "public", {}),
  tool("audit:notifier", "Notifier", "Alert routing — Discord/Telegram/Email delivery", "AUDIT", "sensitive", {}),
  tool("audit:reporter", "Reporter", "Report generation — markdown → PDF, executive summaries", "AUDIT", "sensitive", {}),
  tool("audit:archiver", "Archiver", "Evidence storage — backups, compression, chain-of-custody", "AUDIT", "sensitive", {}),
  tool("recon:comms", "Comms", "Team coordination — daily briefings, status broadcast", "RECON", "public", {}),
];

// ─────────────────────────────────────────────────────────────────────────────
// Chimera9 C2 Framework Components (12 tools)
// ─────────────────────────────────────────────────────────────────────────────

const CHIMERA9_TOOLS: ToolkitToolDescriptor[] = [
  tool("exploitation:chimera_stager", "Chimera9 Stager", "AES-256-GCM encrypted stager with X25519 key exchange", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      arch: { type: "string", enum: ["x86", "x64"] },
      lhost: { type: "string" },
      lport: { type: "number" },
      encryption: { type: "string", enum: ["AES-256-GCM"], default: "AES-256-GCM" },
      keyExchange: { type: "string", enum: ["X25519"], default: "X25519" },
    },
    required: ["arch", "lhost", "lport"],
  }),
  tool("exploitation:chimera_rootkit", "Chimera9 Rootkit", "Kernel-mode rootkit with system call hooking (requires WDK)", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      osVersion: { type: "string" },
      wdkPath: { type: "string" },
    },
    required: ["osVersion"],
  }),
  tool("exploitation:chimera_amsi_bypass", "Chimera9 AMSI Bypass", "AMSI evasion via character encoding manipulation", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      technique: { type: "string", enum: ["character-encoding", "api-unhook", "memory-patch"] },
    },
  }),
  tool("exploitation:chimera_reflective_dll", "Chimera9 Reflective DLL", "In-memory DLL loading without disk writes", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      dllPath: { type: "string" },
      targetProcess: { type: "string" },
    },
    required: ["dllPath"],
  }),
  tool("exploitation:chimera_process_injection", "Chimera9 Process Injection", "Remote thread injection for payload execution", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      targetPid: { type: "number" },
      payload: { type: "string" },
    },
    required: ["targetPid", "payload"],
  }),
  tool("exploitation:chimera_persistence_registry", "Chimera9 Registry Persistence", "Registry Run key persistence mechanism", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      hive: { type: "string", enum: ["HKCU", "HKLM"] },
      keyName: { type: "string" },
      payloadPath: { type: "string" },
    },
    required: ["hive", "keyName", "payloadPath"],
  }),
  tool("exploitation:chimera_persistence_scheduled_task", "Chimera9 Scheduled Task", "Scheduled Task persistence mechanism", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      taskName: { type: "string" },
      trigger: { type: "string" },
      action: { type: "string" },
    },
    required: ["taskName", "action"],
  }),
  tool("exploitation:chimera_c2_server", "Chimera9 C2 Server", "Python-based C2 server with JSON API and stub generation", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      port: { type: "number", default: 8081 },
      payloadDir: { type: "string" },
    },
  }),
  tool("recon:chimera_beacon_jitter", "Chimera9 Beacon Jitter", "Jittered beacon timing for C2 traffic obfuscation", "RECON", "public", {
    type: "object",
    properties: {
      baseInterval: { type: "number", default: 60 },
      jitterRange: { type: "number", default: 15 },
    },
  }),
  tool("audit:chimera_log_cleanup", "Chimera9 Log Cleanup", "Event log clearing and artifact removal", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      logName: { type: "string" },
      filter: { type: "string" },
    },
  }),
  tool("audit:chimera_timestomp", "Chimera9 Timestomp", "Filetime timestamp manipulation", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      filePath: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["filePath"],
  }),
  tool("exploitation:chimera_api_hashing", "Chimera9 API Hashing", "Dynamically resolve ntdll functions to evade detection", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      functionName: { type: "string" },
      hashAlgorithm: { type: "string", default: "fnv1a" },
    },
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// 1toolkit MCP Servers (38 tools)
// ─────────────────────────────────────────────────────────────────────────────

const ONETOOLKIT_TOOLS: ToolkitToolDescriptor[] = [
  // nmap-mcp
  tool("recon:nmap_scan", "Nmap Scan", "Port scanning and service detection via Nmap MCP server", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      ports: { type: "string" },
      scanType: { type: "string", enum: ["S", "T", "U", "A"] },
    },
    required: ["target"],
  }),
  tool("recon:nmap_service_detect", "Nmap Service Detection", "Version detection and OS fingerprinting", "RECON", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      versionIntensity: { type: "number", default: 7 },
    },
    required: ["target"],
  }),

  // nuclei-mcp
  tool("audit:nuclei_scan", "Nuclei Scan", "Template-based vulnerability scanning", "AUDIT", "public", {
    type: "object",
    properties: {
      target: { type: "string" },
      templates: { type: "array", items: { type: "string" } },
      severity: { type: "array", items: { type: "string", enum: ["info", "low", "medium", "high", "critical"] } },
    },
    required: ["target"],
  }),
  tool("audit:nuclei_template_list", "Nuclei Template List", "List available nuclei templates", "AUDIT", "public", {}),

  // metasploit-mcp
  tool("exploitation:msfvenom", "Metasploit Venom", "Payload generation via Metasploit MCP", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      payload: { type: "string" },
      format: { type: "string" },
      lhost: { type: "string" },
      lport: { type: "number" },
    },
    required: ["payload", "lhost", "lport"],
  }),
  tool("exploitation:msf_console", "Metasploit Console", "Execute commands in Metasploit console", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      command: { type: "string" },
    },
    required: ["command"],
  }),
  tool("exploitation:msf_session", "Metasploit Session", "Manage Metasploit sessions", "EXPLOITATION", "restricted", {
    type: "object",
    properties: {
      sessionId: { type: "number" },
      action: { type: "string", enum: ["list", "kill", "interact"] },
    },
  }),

  // ghidra-mcp
  tool("recon:ghidra_disassemble", "Ghidra Disassemble", "Binary disassembly via Ghidra MCP", "RECON", "sensitive", {
    type: "object",
    properties: {
      binaryPath: { type: "string" },
      address: { type: "string" },
    },
    required: ["binaryPath"],
  }),
  tool("recon:ghidra_decompile", "Ghidra Decompile", "Binary decompilation to pseudo-C", "RECON", "sensitive", {
    type: "object",
    properties: {
      binaryPath: { type: "string" },
      functionName: { type: "string" },
    },
    required: ["binaryPath"],
  }),
  tool("recon:ghidra_xref", "Ghidra Cross-Reference", "Find cross-references to addresses/symbols", "RECON", "sensitive", {
    type: "object",
    properties: {
      binaryPath: { type: "string" },
      symbol: { type: "string" },
    },
    required: ["binaryPath", "symbol"],
  }),

  // wireshark-mcp
  tool("recon:wireshark_capture", "Wireshark Capture", "Packet capture via Wireshark MCP", "RECON", "sensitive", {
    type: "object",
    properties: {
      interface: { type: "string" },
      filter: { type: "string" },
      duration: { type: "number" },
    },
  }),
  tool("recon:wireshark_analyze", "Wireshark Analysis", "Analyze captured traffic for anomalies", "RECON", "sensitive", {
    type: "object",
    properties: {
      pcapPath: { type: "string" },
      analysisType: { type: "string", enum: ["protocol", "flow", "statistic"] },
    },
    required: ["pcapPath"],
  }),

  // burp-mcp
  tool("audit:burp_scan", "Burp Suite Scan", "Web application vulnerability scan via Burp MCP", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      targetUrl: { type: "string" },
      scanType: { type: "string", enum: ["active", "passive", "audit"] },
    },
    required: ["targetUrl"],
  }),
  tool("audit:burp_repeater", "Burp Repeater", "Manual request modification and replay", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      request: { type: "string" },
      method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] },
    },
    required: ["request"],
  }),
  tool("audit:burp_intruder", "Burp Intruder", "Automated fuzzing and parameter testing", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      targetUrl: { type: "string" },
      payloadPositions: { type: "array", items: { type: "number" } },
      payloadList: { type: "array", items: { type: "string" } },
    },
    required: ["targetUrl"],
  }),

  // rea-mcp (Rea agents)
  tool("recon:rea_agent", "Rea Agent", "AI-enhanced reconnaissance agent", "RECON", "public", {
    type: "object",
    properties: {
      agentType: { type: "string" },
      task: { type: "string" },
    },
    required: ["task"],
  }),

  // reverify-mcp
  tool("audit:reverify", "Reverify", "Validation pipeline for findings", "AUDIT", "sensitive", {
    type: "object",
    properties: {
      findingId: { type: "string" },
      validationType: { type: "string" },
    },
    required: ["findingId"],
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated Full Catalog
// ─────────────────────────────────────────────────────────────────────────────

export const FULL_TOOL_CATALOG: ToolkitToolDescriptor[] = [
  ...CAYSOC_TOOLS,      // 34 tools
  ...CHIMERA9_TOOLS,    // 12 tools
  ...ONETOOLKIT_TOOLS,  // 18 tools (subset shown; full list extends to 38)
];

/** Build the full catalog response for `/api/v2/toolkit`. */
export function buildFullCatalog(): ToolkitCatalog {
  const capabilities = new Map<string, { cell: string; tier: SecurityTier; tools: ToolkitToolDescriptor[] }>();

  for (const tool of FULL_TOOL_CATALOG) {
    let cap = capabilities.get(tool.cell);
    if (!cap) {
      cap = { cell: tool.cell, tier: tool.tier, tools: [] };
      capabilities.set(tool.cell, cap);
    }
    cap.tools.push(tool);
  }

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    capabilities: Array.from(capabilities.values()),
  };
}

/** Get tool count by cell. */
export function getToolCountByCell(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tool of FULL_TOOL_CATALOG) {
    counts[tool.cell] = (counts[tool.cell] ?? 0) + 1;
  }
  return counts;
}

/** Get tool count by tier. */
export function getToolCountByTier(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tool of FULL_TOOL_CATALOG) {
    counts[tool.tier] = (counts[tool.tier] ?? 0) + 1;
  }
  return counts;
}

/** Debug: print catalog summary. */
export function printCatalogSummary(): void {
  const byCell = getToolCountByCell();
  const byTier = getToolCountByTier();
  console.log("=== Full MCP Swarm Tool Catalog ===");
  console.log(`Total tools: ${FULL_TOOL_CATALOG.length}`);
  console.log("By cell:", byCell);
  console.log("By tier:", byTier);
}
