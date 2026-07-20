#!/bin/bash
# deploy-fleet-v2.sh — Create all 80 CaySoc agents
TOKEN="pcp_board_06479b2dc6292f275f1a059c988019e741d4d97fd22b8cb9"
API="http://localhost:3100/api"

create_agent() {
  local cid="$1" name="$2" slug="$3" model="$4"
  local adapter=""
  case "$model" in
    gemma3:4b|llama3.2:3b) adapter="claude_local" ;;
    qwen2.5:*) adapter="claude_local" ;;
    *) adapter="claude_local" ;;
  esac
  curl -s -H "Authorization: Bearer $TOKEN" -X POST "$API/companies/$cid/agents" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$name\",\"slug\":\"$slug\",\"status\":\"active\",\"enableHeartbeat\":true,\"adapterType\":\"$adapter\",\"adapterConfig\":{\"model\":\"$model\"}}" > /dev/null
  echo -n "."
}

echo "=== Deploying 80 agents ==="

# Company IDs
CAYSOC="7858560e-8f59-4478-a966-24a6211c2943"
XSEC="5b329ede-86db-40dd-a43f-9fd78c7b9483"
XPLOIT="f994bf73-511b-41f1-ae47-0cb9c12e9942"
CAELUM="4dd5dfcb-e8b8-42e3-a584-b73ce0d99254"
AZURE="16c97462-99f1-438b-adca-689eb214835c"

# --- CaySoc Global (2) ---
echo -n "CaySoc Global (2): "
create_agent $CAYSOC "ORACLE" "oracle" "llama3.2:3b"
create_agent $CAYSOC "Reflection Coach" "reflection-coach" "qwen2.5:1.5b"
echo " done"

# --- 0xSec.za (34) ---
echo -n "0xSec.za (34): "
# Lead
create_agent $XSEC "Citadel" "citadel" "llama3.2:3b"
# Recon (6)
for a in Scout Mapper Spider Gatherer Technique Mirror; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "gemma3:4b"
done
# Vuln (6)
for a in Scanner Prober Analyst Docker Cloud Wireless; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "gemma3:4b"
done
# Exploit (6)
for a in Breacher Injector Pivot Escalator Persist Exfiltrator; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "gemma3:4b"
done
# Post-Exploit (5)
for a in Chronicler Analyst Escaper Forensic Cover; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "gemma3:4b"
done
# Eng/Support (5)
for a in Ops Notifier Reporter Archiver Comms; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "qwen2.5:1.5b"
done
# Quality (5)
create_agent $XSEC "Hermes" "hermes" "qwen2.5:1.5b"
for a in QAI Verifier Auditor PM; do
  create_agent $XSEC "$a" "$(echo $a | tr '[:upper:]' '[:lower:]')" "gemma3:4b"
done
create_agent $XSEC "PULSE" "pulse" "qwen2.5:0.5b"
echo " done"

# --- xploit.za (25) ---
echo -n "xploit.za (25): "
create_agent $XPLOIT "Phase" "phase" "llama3.2:3b"
# Research (6)
for a in CVE-Hunter Binary-Analyst Reverser Fuzzer Debugger Scripter; do
  slug=$(echo "$a" | tr '[:upper:]' '[:lower:]')
  create_agent $XPLOIT "$a" "$slug" "gemma3:4b"
done
# Development (6)
for a in Weaponizer Evasion Stager Multi-Platform Integrator Tester; do
  slug=$(echo "$a" | tr '[:upper:]' '[:lower:]')
  create_agent $XPLOIT "$a" "$slug" "gemma3:4b"
done
# Engineering (5)
for a in Builder Packager Doc-Writer DB-Mgr Deployer; do
  slug=$(echo "$a" | tr '[:upper:]' '[:lower:]')
  create_agent $XPLOIT "$a" "$slug" "qwen2.5:1.5b"
done
# Quality (4)
for a in Code-Review Stability Security Audit; do
  slug=$(echo "$a" | tr '[:upper:]' '[:lower:]')
  create_agent $XPLOIT "$a" "$slug" "gemma3:4b"
done
# Support (4)
for a in Coordinator Reporter Infra PULSE; do
  slug=$(echo "$a" | tr '[:upper:]' '[:lower:]')
  create_agent $XPLOIT "$a" "$slug" "qwen2.5:1.5b"
done
echo " done"

# --- Caelum.za (10) ---
echo -n "Caelum.za (10): "
create_agent $CAELUM "Phase" "phase" "llama3.2:3b"
create_agent $CAELUM "Beacon" "beacon" "gemma3:4b"
create_agent $CAELUM "Veil" "veil" "gemma3:4b"
create_agent $CAELUM "Dusk" "dusk" "qwen2.5:1.5b"
create_agent $CAELUM "Apex" "apex" "qwen2.5:1.5b"
create_agent $CAELUM "Reaper" "reaper" "gemma3:4b"
create_agent $CAELUM "Oracle" "oracle" "qwen2.5:1.5b"
create_agent $CAELUM "Whisper" "whisper" "qwen2.5:1.5b"
create_agent $CAELUM "Watchtower" "watchtower" "qwen2.5:1.5b"
create_agent $CAELUM "Archive" "archive" "qwen2.5:0.5b"
echo " done"

# --- Azure (9) ---
echo -n "Azure (9): "
create_agent $AZURE "Pinnacle" "pinnacle" "llama3.2:3b"
create_agent $AZURE "Sentinel" "sentinel" "gemma3:4b"
create_agent $AZURE "Summit" "summit" "gemma3:4b"
create_agent $AZURE "Stratos" "stratos" "qwen2.5:1.5b"
create_agent $AZURE "Horizon" "horizon" "qwen2.5:1.5b"
create_agent $AZURE "Dynamo" "dynamo" "qwen2.5:1.5b"
create_agent $AZURE "Cirrus" "cirrus" "qwen2.5:1.5b"
create_agent $AZURE "Vanguard" "vanguard" "qwen2.5:0.5b"
create_agent $AZURE "Aegis" "aegis" "qwen2.5:0.5b"
echo " done"

echo ""
echo "=== Verification ==="
for cid in $CAYSOC $XSEC $XPLOIT $CAELUM $AZURE; do
  name=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid" | jq -r '.name')
  builtins=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" | jq '[.[] | select(.metadata.paperclipBuiltInAgent // false | not)] | length')
  total=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" | jq 'length')
  echo "  $name: $builtins custom + $(($total - $builtins)) built-in = $total total"
done
