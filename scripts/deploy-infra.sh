#!/bin/bash
# ===========================================================
# CaySoc Global — Complete Stack Deploy
# Run: bash /home/cakes/portfolio/deploy-all.sh
# Cockpit-safe: each line is independent
# ===========================================================
set -e

echo "=== PHASE 1: Infrastructure ==="

# 1a. Restart Docker daemon
sudo dockerd > /tmp/dockerd.log 2>&1 &
sleep 4
docker info --format '{{.ServerVersion}}' 2>/dev/null || { echo "DOCKER_FAILED"; exit 1; }

# 1b. Rebuild Paperclip from source
cd /home/cakes/paperclip
docker build -t paperclip:latest -f Dockerfile . 2>&1 | tail -5

# 1c. Start Postgres
docker run -d --name paperclip-db --network host \
  -e POSTGRES_USER=paperclip \
  -e POSTGRES_PASSWORD=paperclip \
  -e POSTGRES_DB=paperclip \
  postgres:16 2>/dev/null || docker start paperclip-db

sleep 3

# 1d. Start Paperclip
docker run -d --name cakesec-paperclip --network host \
  -e DATABASE_URL=postgresql://paperclip:paperclip@127.0.0.1:5432/paperclip \
  -e BETTER_AUTH_SECRET=paperclip-dev-secret \
  -e PAPERCLIP_AGENT_JWT_SECRET=paperclip-dev-secret \
  -e HOST=0.0.0.0 -e PORT=3100 \
  -e NODE_ENV=production \
  -e PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  -e PAPERCLIP_DEPLOYMENT_EXPOSURE=private \
  -e SERVE_UI=true \
  -e OPENCODE_ALLOW_ALL_MODELS=true \
  paperclip:latest 2>/dev/null || docker start cakesec-paperclip

sleep 5

echo "=== PHASE 2: LobeHub (Agent CAO) ==="
docker pull lobehub/lobehub
docker run -it -d --restart unless-stopped --name lobehub -p 3210:3210 \
  -e APP_URL="http://192.168.0.7:3210" \
  -e KEY_VAULTS_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e DATABASE_URL="postgresql://paperclip:paperclip@127.0.0.1:5432/paperclip" \
  lobehub/lobehub 2>/dev/null || docker start lobehub

echo "=== PHASE 3: Cangjie Skill (Content→Skill Distillation) ==="
cd /opt
sudo git clone https://github.com/kangarooking/cangjie-skill.git 2>/dev/null || true
sudo chown -R cakes:cakes cangjie-skill
cd cangjie-skill
pip install -r requirements.txt 2>&1 | tail -3

echo "=== PHASE 4: Product Line Skills ==="
# Wait for Paperclip API to be ready
for i in 1 2 3 4 5; do
  curl -sf http://localhost:3100/api/companies > /dev/null && break
  sleep 3
done

# Get board token auth
TOKEN="pcp_board_06479b2dc6292f275f1a059c988019e741d4d97fd22b8cb9"

# Create product-line skills in each company
for CID in $(curl -sf http://localhost:3100/api/companies -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;[print(c['id']) for c in json.load(sys.stdin)]" 2>/dev/null); do
  NAME=$(curl -sf "http://localhost:3100/api/companies/$CID" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
  echo "Company: $NAME ($CID)"

  # CVE-to-Exploit Pipeline skill
  curl -s -X POST "http://localhost:3100/api/companies/$CID/skills" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"CVE-to-Exploit Pipeline","slug":"cve-to-exploit-pipeline","description":"Reverse-engineer patches, write PoC exploits, test on live targets, package for subscriber feed","markdown":"# CVE-to-Exploit Pipeline\n\n## Pipeline Stages\n1. **CVE Monitor** — 24/7 watch on NVD, Twitter, GitHub for new disclosures\n2. **Patch RE** — Binary diff patches to find root cause\n3. **Weaponize** — Auto-write exploit PoC\n4. **Test** — Validate on live targets\n5. **Ship** — Package for subscriber feed\n\n## Output Format\nEach completed exploit must write JSON to /tmp/cve-pipeline/output.json:\n{\"cve\":\"CVE-2026-XXXX\",\"product\":\"...\",\"timeToExploit\":\"3.2h\",\"status\":\"delivered|testing|patch-re\",\"date\":\"YYYY-MM-DD\"}"}' > /dev/null

  # Warfare Simulation skill
  curl -s -X POST "http://localhost:3100/api/companies/$CID/skills" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Cyber Warfare Simulation","slug":"cyber-warfare-simulation","description":"Red-vs-blue wargames using agent army as APT adversaries","markdown":"# Cyber Warfare Battle Simulation\n\n## Capabilities\n- 12 APT groups simulated (Lazarus, APT29, Kimsuky, APT41, APT33)\n- 66-agent army as enemy force\n- $500k+/engagement pricing\n\n## Engagement Lifecycle\n1. **Recon Phase** — Map client attack surface\n2. **Breach Phase** — Execute APT-specific TTP chains\n3. **Exfil Phase** — Simulate data theft scenarios\n4. **Cover Phase** — OpSec cleanup\n5. **Report Phase** — After-action report with MTTD/MTTR metrics\n\n## Output Format\nWrite engagement JSON to /tmp/warfare/output.json:\n{\"engagement\":\"...\",\"client\":\"...\",\"duration\":14,\"mttd\":47,\"crownJewelsBreached\":3,\"totalCrownJewels\":12,\"status\":\"active|completed|standby\"}"}' > /dev/null

  # Reputation Bureau skill
  curl -s -X POST "http://localhost:3100/api/companies/$CID/skills" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Cyber Reputation Bureau","slug":"cyber-reputation-bureau","description":"Live credit-rating-style security posture index — recurring SaaS","markdown":"# Cyber Reputation Scoring Bureau\n\n## Scoring Methodology\n- Attack Surface (35%)\n- Patch Velocity (25%)\n- Breach History (20%)\n- Security Controls (20%)\n\n## Score Tiers\n- 81-100: Low Risk\n- 61-80: Medium Risk\n- 41-60: Elevated Risk\n- 21-40: High Risk\n- 0-20: Critical Risk\n\n## Output Format\nWrite scored entities JSON to /tmp/reputation/output.json:\n{\"entity\":\"Company Name\",\"score\":85,\"trend\":\"up|down|stable\",\"riskLevel\":\"low|medium|high|critical\",\"lastUpdated\":\"YYYY-MM-DD\"}"}' > /dev/null

  echo "  Skills created for $NAME"
done

echo "=== PHASE 5: Live Data Proxy ==="
# Update SOC dashboard server.py to add data collection endpoints
cd /home/cakes/portfolio

# Add CVE pipeline data endpoint
python3 -c "
import json, os
# Create data directories
for d in ['/tmp/cve-pipeline', '/tmp/warfare', '/tmp/reputation']:
    os.makedirs(d, exist_ok=True)
    # Seed with demo data
    if not os.path.exists(f'{d}/output.json'):
        with open(f'{d}/output.json', 'w') as f:
            json.dump([], f)
"

echo "=== DEPLOY COMPLETE ==="
echo "Access endpoints:"
echo "  SOC Dashboard:    http://192.168.0.7:8080"
echo "  LobeHub CAO:      http://192.168.0.7:3210"
echo "  Paperclip API:    http://192.168.0.7:3100"
echo "  Cockpit:          https://192.168.0.7:9090"
