/**
 * Swarm persistence service — PostgreSQL storage layer for missions and tasks.
 *
 * This service provides atomic CRUD for the durable audit trail required by
 * the MIT Lincoln review. Missions are keyed by issue ID, ensuring every
 * automated action is discoverable through the core Paperclip board.
 */

import { eq, and, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues, companies } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import {
  SWARM_MISSION_STATUSES,
  type SwarmMissionStatus,
  type SwarmMission,
} from "./schemas.js";
import type { CellName } from "./token-bucket.js";

/** Raw schema definitions (Drizzle-style, matching the migration). */
// Note: In a real run, these would be exported from @paperclipai/db
// but for the parallel layer we define the names here for the service.
const TABLE_MISSIONS = "swarm_missions";
const TABLE_TASKS = "swarm_tasks";

export interface SwarmPersistenceService {
  createMission(params: {
    issueId: string;
    companyId: string;
    cell: CellName;
  }): Promise<string>;

  updateMissionStatus(
    missionId: string,
    status: SwarmMissionStatus,
    result?: Record<string, unknown>,
  ): Promise<void>;

  createTask(params: {
    missionId: string;
    toolName: string;
    cell: CellName;
    input: Record<string, unknown>;
  }): Promise<string>;

  updateTaskResult(
    taskId: string,
    status: "succeeded" | "failed" | "rate_limited",
    output?: Record<string, unknown>,
    errorMessage?: string,
  ): Promise<void>;

  getMissionByIssue(issueId: string): Promise<SwarmMission | null>;
}

export function createSwarmPersistenceService(db: Db): SwarmPersistenceService {
  const log = logger.child({ service: "mcp-swarm-persistence" });

  return {
    async createMission({ issueId, companyId, cell }) {
      const result = await db.execute(sql`
        INSERT INTO ${sql.identifier(TABLE_MISSIONS)} (issue_id, company_id, cell, status)
        VALUES (${issueId}, ${companyId}, ${cell}, ${SWARM_MISSION_STATUSES.PENDING})
        RETURNING id
      `);
      const id = (result[0] as { id: string }).id;
      log.info({ missionId: id, issueId, cell }, "Created swarm mission");
      return id;
    },

    async updateMissionStatus(missionId, status, result) {
      const now = new Date();
      let startedAtSql = sql`started_at`;
      let completedAtSql = sql`completed_at`;

      if (status === SWARM_MISSION_STATUSES.RUNNING) {
        startedAtSql = sql`${now}`;
      } else if (
        status === SWARM_MISSION_STATUSES.COMPLETED ||
        status === SWARM_MISSION_STATUSES.FAILED ||
        status === SWARM_MISSION_STATUSES.CANCELLED
      ) {
        completedAtSql = sql`${now}`;
      }

      await db.execute(sql`
        UPDATE ${sql.identifier(TABLE_MISSIONS)}
        SET status = ${status},
            started_at = ${startedAtSql},
            completed_at = ${completedAtSql},
            result = ${result ? JSON.stringify(result) : sql`result`}
        WHERE id = ${missionId}
      `);
      log.info({ missionId, status }, "Updated mission status");
    },

    async createTask({ missionId, toolName, cell, input }) {
      const result = await db.execute(sql`
        INSERT INTO ${sql.identifier(TABLE_TASKS)} (mission_id, tool_name, cell, input, status)
        VALUES (${missionId}, ${toolName}, ${cell}, ${JSON.stringify(input)}, 'running')
        RETURNING id
      `);
      return (result[0] as { id: string }).id;
    },

    async updateTaskResult(taskId, status, output, errorMessage) {
      const now = new Date();
      await db.execute(sql`
        UPDATE ${sql.identifier(TABLE_TASKS)}
        SET status = ${status},
            output = ${output ? JSON.stringify(output) : sql`output`},
            error_message = ${errorMessage ?? sql`error_message`},
            completed_at = ${now}
        WHERE id = ${taskId}
      `);
    },

    async getMissionByIssue(issueId) {
      const result = await db.execute(sql`
        SELECT * FROM ${sql.identifier(TABLE_MISSIONS)}
        WHERE issue_id = ${issueId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
      if (result.length === 0) return null;
      const row = result[0] as Record<string, any>;
      return {
        id: row.id,
        issueId: row.issue_id,
        status: row.status as SwarmMissionStatus,
        cell: row.cell as CellName,
        startedAt: row.started_at ? row.started_at.toISOString() : null,
        completedAt: row.completed_at ? row.completed_at.toISOString() : null,
        result: row.result,
      };
    },
  };
}
