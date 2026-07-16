import type {
  IdFactory,
  Clock,
  Branch,
  BranchRepository,
  BranchCreateInput,
  BranchPatch,
  Id,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import { rowToBranch, type BranchRow } from '../mappers.js';

const SELECT = `SELECT id, project_id, name, parent_branch_id, fork_point,
  lane, auto_named, merged_to_parent, created_at FROM bonsai_branches`;

export function createBranchRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): BranchRepository {
  return {
    async create(input: BranchCreateInput): Promise<Branch> {
      const id = ids.newId();
      const now = clock.now();
      const { rows } = await pool.query<BranchRow>(
        `INSERT INTO bonsai_branches
          (id, project_id, name, parent_branch_id, fork_point, lane, auto_named, merged_to_parent, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8)
         RETURNING id, project_id, name, parent_branch_id, fork_point,
                   lane, auto_named, merged_to_parent, created_at`,
        [
          id,
          input.projectId,
          input.name,
          input.parentBranchId,
          input.forkPoint,
          input.lane,
          input.autoNamed,
          now,
        ],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`insert branch ${id} returned no row`);
      return rowToBranch(row);
    },
    async findById(id) {
      const { rows } = await pool.query<BranchRow>(`${SELECT} WHERE id = $1`, [id]);
      const row = rows[0];
      return row ? rowToBranch(row) : null;
    },
    async findByProjectId(projectId) {
      const { rows } = await pool.query<BranchRow>(
        `${SELECT} WHERE project_id = $1 ORDER BY lane ASC, created_at ASC`,
        [projectId],
      );
      return rows.map(rowToBranch);
    },
    async update(id: Id, patch: BranchPatch): Promise<Branch> {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (patch.name !== undefined) {
        sets.push(`name = $${i++}`);
        params.push(patch.name);
      }
      if (patch.autoNamed !== undefined) {
        sets.push(`auto_named = $${i++}`);
        params.push(patch.autoNamed);
      }
      if (patch.mergedToParent !== undefined) {
        sets.push(`merged_to_parent = $${i++}`);
        params.push(patch.mergedToParent);
      }
      if (sets.length === 0) {
        const existing = await this.findById(id);
        if (!existing) throw new BonsaiNotFoundError(`branch ${id} not found`);
        return existing;
      }
      params.push(id);
      const { rows } = await pool.query<BranchRow>(
        `UPDATE bonsai_branches SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, project_id, name, parent_branch_id, fork_point,
                   lane, auto_named, merged_to_parent, created_at`,
        params,
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`branch ${id} not found`);
      return rowToBranch(row);
    },
    async maxLane(projectId) {
      const { rows } = await pool.query<{ max: number | null }>(
        `SELECT MAX(lane)::int AS max FROM bonsai_branches WHERE project_id = $1`,
        [projectId],
      );
      const row = rows[0];
      return row?.max ?? -1;
    },
  };
}
