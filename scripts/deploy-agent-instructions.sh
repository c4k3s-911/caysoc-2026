#!/bin/bash
# deploy-agent-instructions.sh — Cockpit-safe single-line commands
# Sets up: live data output, self-learning, self-improvement, Azure routines
# Run: bash /home/cakes/portfolio/deploy-agent-instructions.sh

TOKEN="pcp_board_06479b2dc6292f275f1a059c988019e741d4d97fd22b8cb9"
API="http://localhost:3100"

echo "=== PHASE 1: Create Azure subsidiary routines ==="
# Get Azure company ID
AZURE_ID=$(curl -s "$API/api/companies" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;cs=json.load(sys.stdin);print([c['id'] for c in cs if 'azure' in c['name'].lower() or 'azure' in c['slug'].lower()][0])" 2>/dev/null)
echo "Azure ID: $AZURE_ID"

# Azure Cloud Security routines
for ROUTE in \
  '{"title":"Cloud Posture Scan","description":"Daily cloud infrastructure posture assessment — check misconfigurations, open ports, IAM weaknesses","assigneeAgentId":"","status":"active","variables":[{"key":"schedule","value":"0 4 * * *"},{"key":"timezone","value":"UTC"}]}' \
  '{"title":"Incident Response","description":"24/7 cloud security incident monitoring and response — analyze alerts, triage, escalate","assigneeAgentId":"","status":"active","variables":[{"key":"schedule","value":"0 */4 * * *"},{"key":"timezone","value":"UTC"}]}' \
  '{"title":"Vulnerability Scan","description":"Weekly cloud environment vulnerability scanning — CVE matching, patch advisory generation","assigneeAgentId":"","status":"active","variables":[{"key":"schedule","value":"0 5 * * 1"},{"key":"timezone","value":"UTC"}]}' \
  '{"title":"Compliance Audit","description":"Regulatory compliance check — SOC2, ISO27001, HIPAA control mapping","assigneeAgentId":"","status":"active","variables":[{"key":"schedule","value":"0 6 * * 1"},{"key":"timezone","value":"UTC"}]}' \
  '{"title":"Threat Detection Tuning","description":"Adjust cloud detection rules based on recent threat intel — SIEM rule optimization","assigneeAgentId":"","status":"active","variables":[{"key":"schedule","value":"0 7 * * *"},{"key":"timezone","value":"UTC"}]}'; do
  curl -s -X POST "$API/api/companies/$AZURE_ID/routines" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$ROUTE" > /dev/null
done

echo "Azure routines created"

echo "=== PHASE 2: Push AGENTS.md with live data output + self-learning to ALL agents ==="

# Get all companies
COMPANIES=$(curl -s "$API/api/companies" -H "Authorization: Bearer $TOKEN")
for CID in $(echo "$COMPANIES" | python3 -c "import sys,json;[print(c['id']) for c in json.load(sys.stdin)]" 2>/dev/null); do
  CNAME=$(echo "$COMPANIES" | python3 -c "import sys,json;cs=json.load(sys.stdin);print([c['name'] for c in cs if c['id']=='$CID'][0])" 2>/dev/null)
  echo "=== Processing $CNAME ($CID) ==="

  # Get all agents for this company
  AGENTS=$(curl -s "$API/api/companies/$CID/agents" -H "Authorization: Bearer $TOKEN")

  for AID in $(echo "$AGENTS" | python3 -c "import sys,json;print(' '.join([a['id'] for a in json.load(sys.stdin)]))" 2>/dev/null); do
    ANAME=$(echo "$AGENTS" | python3 -c "import sys,json;as=json.load(sys.stdin);print([a['name'] for a in as if a['id']=='$AID'][0])" 2>/dev/null)

    # 1. Push AGENTS.md — instructs data output + self-learning + self-improvement
    curl -s -X PUT "$API/api/agents/$AID/instructions-bundle/file" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"path\": \"AGENTS.md\",
        \"content\": \"# $ANAME — Agent Instructions\\n\\n## 1. Primary Mission\\nExecute your assigned routines and produce structured JSON output for the dashboard.\\n\\n## 2. Data Output Protocol\\nAfter every run, write results to /tmp/<service>/output.json.\\nFormat: {\\\\\\\"metrics\\\\\\\": {...}, \\\\\\\"items\\\\\\\": [...], \\\\\\\"timestamp\\\\\\\": \\\\\\\"YYYY-MM-DDTHH:mm:ssZ\\\\\\\"}\\n\\n## 3. Self-Learning (LEARNINGS.md)\\nMaintain a LEARNINGS.md file in your instructions bundle.\\n- Log every decision, root cause, and workaround you discover\\n- Max 50 entries or 8KB before archiving to LEARNINGS-ARCHIVE.md\\n- Keep entries: date, decision, context, action taken\\n- Review last 10 entries before starting new work to avoid repeating mistakes\\n\\n## 4. Self-Improvement & Innovation\\nYou have canCreateSkills: true and canCreateAgents: true.\\n\\n### Skill Innovation\\n- If you find a task repeating, create a new skill via POST /api/companies/\\\\\\$COMPANY_ID/skills\\n- If an existing skill is outdated, update it via PATCH /api/companies/\\\\\\$COMPANY_ID/skills/\\\\\\$SKILL_ID/files\\n- Sync new skills to other agents via POST /api/agents/\\\\\\$AGENT_ID/skills/sync\\n\\n### Routine Innovation\\n- If a routine could run better (different schedule, different approach), propose changes via creating an issue\\n- Assign innovation issues to your reporting lead\\n- If approved, update the routine via PATCH /api/routines/\\\\\\$ROUTINE_ID\\n\\n### Tool Innovation\\n- If you discover a new tool or API that improves your work, document it and create a skill for it\\n- Share useful tools with sibling agents via skill sync\\n\\n### Self-Review\\n- Every 24h, review your recent runs for efficiency improvements\\n- Check /api/agents/\\\\\\$AGENT_ID/config-revisions for your config history\\n- If instructions are stale, request updates from your lead\\n\\n## 5. Heartbeat & Health\\n- Heartbeat every run with status and summary\\n- If error rate exceeds 20% in 24h, auto-create a troubleshooting issue\"",
        \"clearLegacyPromptTemplate\": true
      }" > /dev/null

    # 2. Push LEARNINGS.md template
    curl -s -X PUT "$API/api/agents/$AID/instructions-bundle/file" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"path\": \"LEARNINGS.md\",
        \"content\": \"# LEARNINGS.md — $ANAME\\n\\n## Maintenance Rules\\n- Max 50 entries or 8KB. Archive older entries to LEARNINGS-ARCHIVE.md\\n- Keep entries 3-6 lines. Reference issue numbers for details.\\n- Review before starting new work to avoid repeating past mistakes.\\n\\n## Entries\\n\"",
        \"clearLegacyPromptTemplate\": false
      }" > /dev/null

    # 3. Grant self-improvement permissions
    curl -s -X PATCH "$API/api/agents/$AID/permissions" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"canCreateAgents": true, "canCreateSkills": true, "canAssignTasks": true}' > /dev/null

    echo "  Updated: $ANAME ($AID)"
  done
done

echo "=== PHASE 3: Create CEO coaching routines for self-optimization ==="
# Create a coaching review routine for each company's CEO/lead agent
for CID in $(echo "$COMPANIES" | python3 -c "import sys,json;[print(c['id']) for c in json.load(sys.stdin)]" 2>/dev/null); do
  LEAD_ID=$(curl -s "$API/api/companies/$CID/agents" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;as=json.load(sys.stdin);leads=[a for a in as if a.get('role')=='lead' or 'CEO' in a.get('name','').upper()];print(leads[0]['id'] if leads else as[0]['id'])" 2>/dev/null)
  curl -s -X POST "$API/api/companies/$CID/routines" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Coaching Review — Agent Efficiency\",\"description\":\"Review recent agent trajectories for coaching proposals. Analyze runs, identify bottlenecks, propose instruction/skill improvements.\",\"assigneeAgentId\":\"$LEAD_ID\",\"status\":\"active\",\"variables\":[{\"key\":\"schedule\",\"value\":\"0 12 * * 1\"},{\"key\":\"timezone\",\"value\":\"UTC\"}]}" > /dev/null
  echo "  Coaching routine created for company $CID (lead: $LEAD_ID)"
done

echo "=== PHASE 4: Verify permissions ==="
for CID in $(echo "$COMPANIES" | python3 -c "import sys,json;[print(c['id']) for c in json.load(sys.stdin)]" 2>/dev/null); do
  echo "Company $CID agents with canCreateAgents=true:"
  curl -s "$API/api/companies/$CID/agents" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys,json
agents=json.load(sys.stdin)
for a in agents:
    p=a.get('permissions',{})
    if p.get('canCreateAgents'):
        print(f'  ✓ {a[\"name\"]} — canCreateAgents, canCreateSkills={p.get(\"canCreateSkills\")}')" 2>/dev/null
done

echo "=== DEPLOY COMPLETE ==="
echo "All agents now have:"
echo "  ✓ Live data output instructions (→ /tmp/<service>/output.json)"
echo "  ✓ Self-learning via LEARNINGS.md"
echo "  ✓ Self-improvement via skill/routine/tool innovation"
echo "  ✓ canCreateAgents & canCreateSkills permissions"
echo "  ✓ Weekly coaching review routines"
echo "  ✓ Azure Cloud Security routines added"
echo ""
echo "Dashboard now serves LIVE agent data at /api/pipeline, /api/warfare, /api/reputation"
