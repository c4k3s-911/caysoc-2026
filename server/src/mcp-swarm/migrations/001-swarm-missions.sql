-- Migration: Add MCP Swarm mission persistence tables
-- These tables store durable mission state for audit trails and compliance.
-- They link to the existing `issues` table but live parallel to the core lifecycle.

-- Swarm missions: top-level mission records tied to an issue
CREATE TABLE IF NOT EXISTS swarm_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cell VARCHAR(50) NOT NULL, -- 'RECON', 'EXPLOITATION', 'AUDIT'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by issue and company
CREATE INDEX IF NOT EXISTS idx_swarm_missions_issue_id ON swarm_missions(issue_id);
CREATE INDEX IF NOT EXISTS idx_swarm_missions_company_id ON swarm_missions(company_id);
CREATE INDEX IF NOT EXISTS idx_swarm_missions_status ON swarm_missions(status);

-- Swarm tasks: individual task records within a mission (ephemeral DAG nodes persisted for audit)
CREATE TABLE IF NOT EXISTS swarm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES swarm_missions(id) ON DELETE CASCADE,
  tool_name VARCHAR(255) NOT NULL,
  cell VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, succeeded, failed, rate_limited
  input JSONB,
  output JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by mission
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_mission_id ON swarm_tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_swarm_tasks_status ON swarm_tasks(status);

-- Add trigger to update updated_at on swarm_missions
CREATE OR REPLACE FUNCTION update_swarm_mission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_swarm_missions_updated_at
  BEFORE UPDATE ON swarm_missions
  FOR EACH ROW
  EXECUTE FUNCTION update_swarm_mission_updated_at();

-- Grant appropriate permissions (adjust based on your deployment)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON swarm_missions TO paperclip_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON swarm_tasks TO paperclip_app;

COMMENT ON TABLE swarm_missions IS 'Durable mission state for MCP Swarm operations, linked to issues for audit trails';
COMMENT ON TABLE swarm_tasks IS 'Individual task execution records within a mission, persisted for compliance and replay';
COMMENT ON COLUMN swarm_missions.cell IS 'Agent cell: RECON, EXPLOITATION, AUDIT';
COMMENT ON COLUMN swarm_missions.status IS 'Mission lifecycle state: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN swarm_tasks.status IS 'Task execution state: pending, running, succeeded, failed, rate_limited';
