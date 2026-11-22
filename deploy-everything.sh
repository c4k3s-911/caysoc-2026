#!/bin/bash
# deploy-everything.sh — Full CaySoc fleet deployment
# Creates: skills, routines, agent permissions, AGENTS.md, LEARNINGS.md
TOKEN="pcp_board_06479b2dc6292f275f1a059c988019e741d4d97fd22b8cb9"
API="http://localhost:3100/api"

# Company IDs
CAYSOC="7858560e-8f59-4478-a966-24a6211c2943"
XSEC="5b329ede-86db-40dd-a43f-9fd78c7b9483"
XPLOIT="f994bf73-511b-41f1-ae47-0cb9c12e9942"
CAELUM="4dd5dfcb-e8b8-42e3-a584-b73ce0d99254"
AZURE="16c97462-99f1-438b-adca-689eb214835c"

# ==========================================
# PHASE 1: SKILLS
# ==========================================
echo "=== PHASE 1: Creating Skills ==="

create_skill() {
  local cid="$1" name="$2" slug="$3" desc="$4" md="$5"
  curl -s -H "Authorization: Bearer $TOKEN" -X POST "$API/companies/$cid/skills" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"slug\":\"$slug\",\"description\":\"$desc\",\"markdown\":\"$md\"}" > /dev/null
  echo -n "."
}

# Skills for ALL companies
for cid in $CAYSOC $XSEC $XPLOIT $CAELUM $AZURE; do
  create_skill "$cid" "CVE-to-Exploit Pipeline" "cve-to-exploit-pipeline" \
    "Reverse-engineer patches, write PoC exploits, test, ship" \
    "# CVE-to-Exploit Pipeline\nCVE Monitor → Patch RE → Weaponize → Test → Ship"
  create_skill "$cid" "Cyber Warfare Simulation" "cyber-warfare-simulation" \
    "Red-vs-blue wargames with APT adversary simulation" \
    "# Cyber Warfare Simulation\n12 APT groups, 66-agent army, \$500k+/engagement"
  create_skill "$cid" "Reputation Scoring Bureau" "reputation-scoring" \
    "Credit-rating-style security posture index" \
    "# Reputation Scoring\n35% Attack Surface, 25% Patch Velocity, 20% Breach History, 20% Controls"
  create_skill "$cid" "Cross-Company Ops" "cross-company-ops" \
    "Inter-company coordination and data routing" \
    "# Cross-Company Ops\nRoute findings between Caelum→xploit→0xSec→Azure→CaySoc"
  create_skill "$cid" "Incident Response" "incident-response" \
    "IR procedures and playbooks" \
    "# Incident Response\nDetection → Triage → Contain → Eradicate → Recover"
  echo ""
done

# Company-specific skills
echo -n "Company-specific skills: "
# 0xSec.za specific
for skill in "pentest-operations:Full pentest methodology:Core pentest ops" \
  "reconnaissance:Active and passive recon:Recon techniques" \
  "vulnerability-assessment:Vuln scanning and analysis:VA methodology" \
  "post-exploitation:Post-exploit operations:Post-exploit framework" \
  "social-engineering:Phishing and pretexting:SE framework" \
  "wireless-audit:WiFi and Bluetooth assessment:Wireless testing"; do
  IFS=":" read -r slug name desc <<< "$skill"
  create_skill "$XSEC" "$name" "$slug" "$desc" "# $name\n$desc for 0xSec.za operations"
done

# xploit.za specific
for skill in "exploit-development:CVE-to-exploit pipeline:Exploit dev framework" \
  "binary-analysis:RE, fuzzing, debugging:Binary analysis" \
  "payload-development:Shellcode and implants:Payload development" \
  "evasion-techniques:AV and EDR bypass:Evasion methodology"; do
  IFS=":" read -r slug name desc <<< "$skill"
  create_skill "$XPLOIT" "$name" "$slug" "$desc" "# $name\n$desc for xploit.za"
done

# Caelum.za specific
for skill in "intelligence-analysis:OSINT and threat intel:Intel analysis" \
  "osint-collection:Open source intelligence gathering:OSINT collection" \
  "dark-web-monitoring:Dark web intelligence:Dark web monitoring"; do
  IFS=":" read -r slug name desc <<< "$skill"
  create_skill "$CAELUM" "$name" "$slug" "$desc" "# $name\n$desc for Caelum.za"
done

# Azure specific
for skill in "cloud-security:Multi-CSP security assessment:Cloud security" \
  "cloud-hardening:CSP hardening benchmarks:Cloud hardening" \
  "compliance-audit:SOC2/ISO/PCI audit procedures:Compliance audit"; do
  IFS=":" read -r slug name desc <<< "$skill"
  create_skill "$AZURE" "$name" "$slug" "$desc" "# $name\n$desc for Azure"
done

echo " done"

# ==========================================
# PHASE 2: ROUTINES
# ==========================================
echo "=== PHASE 2: Creating Routines ==="

create_routine() {
  local cid="$1" title="$2" desc="$3" schedule="$4"
  local rid=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST "$API/companies/$cid/routines" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"$title\",\"description\":\"$desc\",\"status\":\"active\"}" | jq -r '.id')
  # Create trigger
  curl -s -H "Authorization: Bearer $TOKEN" -X POST "$API/routines/$rid/triggers" \
    -H "Content-Type: application/json" \
    -d "{\"kind\":\"schedule\",\"cronExpression\":\"$schedule\",\"timezone\":\"UTC\",\"enabled\":true}" > /dev/null 2>&1
  echo -n "."
}

echo -n "Routines: "
# CaySoc Global (4)
create_routine "$CAYSOC" "Daily Briefing" "Synthesize outputs from all 4 subsidiaries" "0 5 * * *"
create_routine "$CAYSOC" "Strategic Review" "Portfolio health, revenue, resource allocation" "0 8 * * 1"
create_routine "$CAYSOC" "Self-Improvement" "Review agent performance, suggest upgrades" "0 */12 * * *"
create_routine "$CAYSOC" "Weekly Report" "Board-level weekly summary" "0 12 * * 5"

# 0xSec.za (7)
create_routine "$XSEC" "Daily Recon" "Scout→Mapper→Spider→Gatherer cycle" "0 4 * * *"
create_routine "$XSEC" "Vulnerability Scan" "Scanner→Prober→Analyst pipeline" "0 5 * * *"
create_routine "$XSEC" "Exploit Attempt" "Breacher→Injector→Escalator cycle" "0 6 * * *"
create_routine "$XSEC" "Post-Exploit Review" "Chronicler→Analyst→Forensic" "0 7 * * *"
create_routine "$XSEC" "Report Generation" "Reporter→Archiver→Notifier" "0 8 * * *"
create_routine "$XSEC" "Quality Gate" "QAI→Verifier→Auditor cross-check" "0 9 * * *"
create_routine "$XSEC" "Cover Tracks" "Escaper→Persist→Cover rotation" "0 */8 * * *"

# xploit.za (7)
create_routine "$XPLOIT" "CVE Research" "CVE-Hunter→Binary-Analyst→Reverser" "0 3 * * *"
create_routine "$XPLOIT" "Fuzzing Ops" "Fuzzer→Debugger→Scripter cycle" "0 4 * * *"
create_routine "$XPLOIT" "Exploit Development" "Weaponizer→Evasion→Stager" "0 5 * * *"
create_routine "$XPLOIT" "Integration" "Integrator→Tester→Multi-Platform" "0 6 * * *"
create_routine "$XPLOIT" "Build & Package" "Builder→Packager→Doc-Writer" "0 7 * * *"
create_routine "$XPLOIT" "QC Gate" "Code-Review→Stability→Security" "0 8 * * *"
create_routine "$XPLOIT" "OpSec Cycle" "Audit→Deployer→Coordinator" "0 */6 * * *"

# Caelum.za (7)
create_routine "$CAELUM" "OSINT Collection" "Beacon→Veil→Whisper cycle" "0 4 * * *"
create_routine "$CAELUM" "Threat Analysis" "Reaper→Oracle→Apex" "0 5 * * *"
create_routine "$CAELUM" "Dark Web Sweep" "Veil deep scan" "0 6 * * *"
create_routine "$CAELUM" "Recon Oscillation" "Dusk differential scan" "0 7 * * *"
create_routine "$CAELUM" "Fusion Intel" "Apex cross-correlation" "0 8 * * *"
create_routine "$CAELUM" "Archive & Index" "Archive data retention" "0 9 * * *"
create_routine "$CAELUM" "OpSec Cover" "Cover track cycle" "0 */6 * * *"

# Azure (7)
create_routine "$AZURE" "Cloud Posture Scan" "Summit→Sentinel→Cirrus" "0 4 * * *"
create_routine "$AZURE" "Compliance Check" "Horizon→Aegis audit" "0 5 * * *"
create_routine "$AZURE" "Remediation" "Dynamo auto-fix cycle" "0 6 * * *"
create_routine "$AZURE" "Threat Hunt" "Vanguard→Sentinel analysis" "0 7 * * *"
create_routine "$AZURE" "Container Audit" "Stratos docker/k8s check" "0 8 * * *"
create_routine "$AZURE" "IAM Review" "Aegis permission audit" "0 9 * * *"
create_routine "$AZURE" "Report & Escalate" "Pinnacle summary" "0 10 * * *"

# Coaching reviews (5)
create_routine "$CAYSOC" "Coaching Review" "CEO agent efficiency review" "0 12 * * 1"
create_routine "$XSEC" "Coaching Review" "Lead agent efficiency review" "0 13 * * 1"
create_routine "$XPLOIT" "Coaching Review" "Lead agent efficiency review" "0 14 * * 1"
create_routine "$CAELUM" "Coaching Review" "Lead agent efficiency review" "0 15 * * 1"
create_routine "$AZURE" "Coaching Review" "Lead agent efficiency review" "0 16 * * 1"

echo " done ($(curl -s "$API/routines?limit=1" -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq '.count // "?"') total)"

# ==========================================
# PHASE 3: AGENTS.md + LEARNINGS.md + PERMISSIONS
# ==========================================
echo "=== PHASE 3: Agent Instructions & Permissions ==="

push_instructions() {
  local aid="$1" aname="$2"
  # AGENTS.md
  curl -s -H "Authorization: Bearer $TOKEN" -X PUT "$API/agents/$aid/instructions-bundle/file" \
    -H "Content-Type: application/json" \
    -d "{\"path\":\"AGENTS.md\",\"content\":\"# $aname — Agent Instructions\n\n## 1. Primary Mission\nExecute your assigned routines and produce structured JSON output for the dashboard.\n\n## 2. Data Output Protocol\nAfter every run, write results to /tmp/<service>/output.json.\nFormat: {\\\"metrics\\\": {...}, \\\"items\\\": [...], \\\"timestamp\\\": \\\"YYYY-MM-DDTHH:mm:ssZ\\\"}\n\n## 3. Self-Learning\nMaintain LEARNINGS.md in your instructions bundle.\nLog every decision, root cause, and workaround.\nMax 50 entries or 8KB before archiving.\n\n## 4. Self-Improvement\nYou can create skills, create agents, and assign tasks.\nCreate new skills for repetitive tasks.\nPropose routine improvements to your lead.\n\n## 5. Innovation\nDocument new tools and APIs.\nShare useful findings with sibling agents.\n\n## 6. Heartbeat\nHeartbeat every run with status and summary.\nReport errors that exceed 20% rate.\",\"clearLegacyPromptTemplate\":true}" > /dev/null
  # LEARNINGS.md
  curl -s -H "Authorization: Bearer $TOKEN" -X PUT "$API/agents/$aid/instructions-bundle/file" \
    -H "Content-Type: application/json" \
    -d "{\"path\":\"LEARNINGS.md\",\"content\":\"# LEARNINGS.md — $aname\n\n## Rules\n- Max 50 entries or 8KB. Archive to LEARNINGS-ARCHIVE.md.\n- Keep entries 3-6 lines. Reference issue numbers.\n- Review before starting new work.\n\n## Entries\n\"}" > /dev/null
  # Permissions
  curl -s -H "Authorization: Bearer $TOKEN" -X PATCH "$API/agents/$aid/permissions" \
    -H "Content-Type: application/json" \
    -d '{"canCreateAgents":true,"canCreateSkills":true,"canAssignTasks":true}' > /dev/null
  echo -n "."
}

# Apply to ALL agents across all companies
for cid in $CAYSOC $XSEC $XPLOIT $CAELUM $AZURE; do
  agents=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" | jq -r '.[] | select(.metadata.paperclipBuiltInAgent // false | not) | "\(.id):\(.name)"')
  while IFS=":" read -r aid aname; do
    push_instructions "$aid" "$aname" 2>/dev/null &
  done <<< "$agents"
  wait
done
echo " done"

# ==========================================
# PHASE 4: SYNC SKILLS TO AGENTS
# ==========================================
echo "=== PHASE 4: Syncing Skills ==="

sync_skills() {
  local aid="$1" skills="$2"
  curl -s -H "Authorization: Bearer $TOKEN" -X POST "$API/agents/$aid/skills/sync" \
    -H "Content-Type: application/json" \
    -d "{\"desiredSkills\":$skills}" > /dev/null
  echo -n "."
}

# Get skill keys for each company
for cid in $CAYSOC $XSEC $XPLOIT $CAELUM $AZURE; do
  skill_keys=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/skills" | jq -r '[.[].key]')
  agents=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" | jq -r '.[] | select(.metadata.paperclipBuiltInAgent // false | not) | .id')
  for aid in $agents; do
    sync_skills "$aid" "$skill_keys" 2>/dev/null &
  done
  wait
done
echo " done"

# ==========================================
# VERIFICATION
# ==========================================
echo ""
echo "=== VERIFICATION ==="
for cid in $CAYSOC $XSEC $XPLOIT $CAELUM $AZURE; do
  name=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid" | jq -r '.name')
  total=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" | jq 'length')
  routines=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/routines" | jq 'length')
  skills=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/skills" | jq 'length')
  echo "  $name: $total agents, $routines routines, $skills skills"
done

echo ""
echo "=== FLEET DEPLOYMENT COMPLETE ==="
echo "All agents have: AGENTS.md, LEARNINGS.md, full permissions, skill sync"
echo ""
