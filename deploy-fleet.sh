#!/bin/bash
# deploy-companies.sh — Create 5 CaySoc companies + all 80 agents
TOKEN="pcp_board_06479b2dc6292f275f1a059c988019e741d4d97fd22b8cb9"
API="http://localhost:3100/api"
COMPANIES_FILE="/tmp/companies.json"

echo "=== Creating all 80 agents across 5 companies ==="

# Verify companies exist
echo "=== Companies ==="
curl -s -H "Authorization: Bearer $TOKEN" $API/companies | jq -r '.[] | "\(.id) \(.name) \(.slug)"'

# Save company IDs
curl -s -H "Authorization: Bearer $TOKEN" $API/companies > $COMPANIES_FILE

# ==========================================
# COMPANY: CaySoc Global (parent/oversight)
# ==========================================
CID_CAYSOC=$(cat $COMPANIES_FILE | jq -r '.[] | select(.slug=="caysoc-global") | .id')
echo "--- CaySoc Global ($CID_CAYSOC) -- 2 agents ---"

# Create project
PID_CAYSOC=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Strategic Oversight\",\"companyId\":\"$CID_CAYSOC\"}" | jq -r '.id')
echo "  Project: $PID_CAYSOC"

# ORACLE (CEO)
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"ORACLE\",\"slug\":\"oracle\",\"model\":\"llama3.2:3b\",\"projectId\":\"$PID_CAYSOC\",\"companyId\":\"$CID_CAYSOC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null

# Reflection Coach
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Reflection Coach\",\"slug\":\"reflection-coach\",\"model\":\"qwen2.5:1.5b\",\"projectId\":\"$PID_CAYSOC\",\"companyId\":\"$CID_CAYSOC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null

echo "  Created 2 agents"

# ==========================================
# COMPANY: 0xSec.za (pentest — 34 agents)
# ==========================================
CID_XSEC=$(cat $COMPANIES_FILE | jq -r '.[] | select(.slug=="0xsec-za") | .id')
echo "--- 0xSec.za ($CID_XSEC) -- 34 agents ---"

PID_XSEC=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Security Operations\",\"companyId\":\"$CID_XSEC\"}" | jq -r '.id')
echo "  Project: $PID_XSEC"

# Lead
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Citadel\",\"slug\":\"citadel\",\"model\":\"llama3.2:3b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null

# Recon Team (6)
for agent in Scout Mapper Spider Gatherer Technique Mirror; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Vuln Team (6)
for agent in Scanner Prober Analyst Docker Cloud Wireless; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Exploit Team (6)
for agent in Breacher Injector Pivot Escalator Persist Exfiltrator; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Post-Exploit Team (5)
for agent in Chronicler Analyst Escaper Forensic Cover; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Eng/Support (5)
for agent in Ops Notifier Reporter Archiver Comms; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"qwen2.5:1.5b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Quality & Mgmt (6)
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Hermes\",\"slug\":\"hermes\",\"model\":\"qwen2.5:1.5b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
for agent in QAI Verifier Auditor PM; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"PULSE\",\"slug\":\"pulse\",\"model\":\"qwen2.5:0.5b\",\"projectId\":\"$PID_XSEC\",\"companyId\":\"$CID_XSEC\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null

echo "  Created 34 agents"

# ==========================================
# COMPANY: xploit.za (exploit R&D — 25 agents)
# ==========================================
CID_XPLOIT=$(cat $COMPANIES_FILE | jq -r '.[] | select(.slug=="xploit-za") | .id')
echo "--- xploit.za ($CID_XPLOIT) -- 25 agents ---"

PID_XPLOIT=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Exploit Development Pipeline\",\"companyId\":\"$CID_XPLOIT\"}" | jq -r '.id')
echo "  Project: $PID_XPLOIT"

# Lead
curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Phase\",\"slug\":\"phase\",\"model\":\"llama3.2:3b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null

# Research (6)
for agent in CVE-Hunter Binary-Analyst Reverser Fuzzer Debugger Scripter; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Development (6)
for agent in Weaponizer Evasion Stager Multi-Platform Integrator Tester; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Engineering (5)
for agent in Builder Packager Doc-Writer DB-Mgr Deployer; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"qwen2.5:1.5b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Quality (4)
for agent in Code-Review Stability Security Audit; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"gemma3:4b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

# Support (4)
for agent in Coordinator Reporter Infra PULSE; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"qwen2.5:1.5b\",\"projectId\":\"$PID_XPLOIT\",\"companyId\":\"$CID_XPLOIT\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done

echo "  Created 25 agents"

# ==========================================
# COMPANY: Caelum.za (intel — 10 agents)
# ==========================================
CID_CAELUM=$(cat $COMPANIES_FILE | jq -r '.[] | select(.slug=="caelum-za") | .id')
echo "--- Caelum.za ($CID_CAELUM) -- 10 agents ---"

PID_CAELUM=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Intelligence Operations\",\"companyId\":\"$CID_CAELUM\"}" | jq -r '.id')
echo "  Project: $PID_CAELUM"

for agent in Phase Beacon Veil Dusk Apex Reaper Oracle Whisper Watchtower Archive; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  if [ "$agent" = "Phase" ]; then model="llama3.2:3b"
  elif [ "$agent" = "Beacon" ] || [ "$agent" = "Veil" ] || [ "$agent" = "Reaper" ]; then model="gemma3:4b"
  elif [ "$agent" = "Archive" ]; then model="qwen2.5:0.5b"
  else model="qwen2.5:1.5b"
  fi
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"$model\",\"projectId\":\"$PID_CAELUM\",\"companyId\":\"$CID_CAELUM\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done
echo "  Created 10 agents"

# ==========================================
# COMPANY: Azure (cloud — 9 agents)
# ==========================================
CID_AZURE=$(cat $COMPANIES_FILE | jq -r '.[] | select(.slug=="azure") | .id')
echo "--- Azure ($CID_AZURE) -- 9 agents ---"

PID_AZURE=$(curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/projects \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Cloud Security Monitoring\",\"companyId\":\"$CID_AZURE\"}" | jq -r '.id')
echo "  Project: $PID_AZURE"

for agent in Pinnacle Sentinel Summit Stratos Horizon Dynamo Cirrus Vanguard Aegis; do
  slug=$(echo "$agent" | tr '[:upper:]' '[:lower:]')
  if [ "$agent" = "Pinnacle" ]; then model="llama3.2:3b"
  elif [ "$agent" = "Sentinel" ] || [ "$agent" = "Summit" ]; then model="gemma3:4b"
  elif [ "$agent" = "Vanguard" ] || [ "$agent" = "Aegis" ]; then model="qwen2.5:0.5b"
  else model="qwen2.5:1.5b"
  fi
  curl -s -H "Authorization: Bearer $TOKEN" -X POST $API/agents \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$agent\",\"slug\":\"$slug\",\"model\":\"$model\",\"projectId\":\"$PID_AZURE\",\"companyId\":\"$CID_AZURE\",\"status\":\"active\",\"enableHeartbeat\":true}" > /dev/null
done
echo "  Created 9 agents"

echo ""
echo "=== VERIFICATION ==="
echo "Total agents:"
curl -s -H "Authorization: Bearer $TOKEN" $API/companies | jq -r '.[] | "\(.name): \((.id | tostring))"' | while read line; do
  cid=$(echo $line | grep -oP '[a-f0-9-]{36}')
  name=$(echo $line | sed 's/:.*//')
  count=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/companies/$cid/agents" 2>/dev/null | jq '.data | length' 2>/dev/null || echo "?")
  echo "  $name: $count agents"
done
