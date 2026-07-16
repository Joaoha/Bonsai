import type {
  IdFactory,
  Clock,
  Merge,
  MergeRepository,
  MergeCreateInput,
  MergePatch,
  Message,
  Id,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import {
  rowToMerge,
  rowToMessage,
  type MergeRow,
  type MessageRow,
} from '../mappers.js';

const SELECT_MERGE = `SELECT id, source_branch_id, target_branch_id, status,
  summary, applied_message_id, applied_at, created_at FROM bonsai_merges`;

const SELECT_MSG = `SELECT id, branch_id, role, content, sequence, parent_ids,
  source_message_id, is_merge_commit, merged_branch_name, merged_branch_id,
  merged_source_last_message_id, provider, adapter_metadata, created_at
  FROM bonsai_messages`;

export function createMergeRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): MergeRepository {
  return {
    async create(input: MergeCreateInput): Promise<Merge> {
      const id = ids.newId();
      const now = clock.now();
      const { rows } = await pool.query<MergeRow>(
        `INSERT INTO bonsai_merges
          (id, source_branch_id, target_branch_id, status, summary,
           applied_message_id, applied_at, created_at)
         VALUES ($1,$2,$3,$4,$5,NULL,NULL,$6)
         RETURNING id, source_branch_id, target_branch_id, status, summary,
                   applied_message_id, applied_at, created_at`,
        [
          id,
          input.sourceBranchId,
          input.targetBranchId,
          input.status,
          input.summary ?? null,
          now,
        ],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`insert merge ${id} returned no row`);
      return rowToMerge(row);
    },
    async findById(id) {
      const { rows } = await pool.query<MergeRow>(`${SELECT_MERGE} WHERE id = $1`, [id]);
      const row = rows[0];
      return row ? rowToMerge(row) : null;
    },
    async update(id: Id, patch: MergePatch): Promise<Merge> {
      const sets: string[] = [];
      const params: unknown[] = [];
      let i = 1;
      if (patch.status !== undefined) {
        sets.push(`status = $${i++}`);
        params.push(patch.status);
      }
      if (patch.summary !== undefined) {
        sets.push(`summary = $${i++}`);
        params.push(patch.summary);
      }
      if (patch.appliedMessageId !== undefined) {
        sets.push(`applied_message_id = $${i++}`);
        params.push(patch.appliedMessageId);
      }
      if (patch.appliedAt !== undefined) {
        sets.push(`applied_at = $${i++}`);
        params.push(patch.appliedAt);
      }
      if (sets.length === 0) {
        const existing = await this.findById(id);
        if (!existing) throw new BonsaiNotFoundError(`merge ${id} not found`);
        return existing;
      }
      params.push(id);
      const { rows } = await pool.query<MergeRow>(
        `UPDATE bonsai_merges SET ${sets.join(', ')}
         WHERE id = $${i}
         RETURNING id, source_branch_id, target_branch_id, status, summary,
                   applied_message_id, applied_at, created_at`,
        params,
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`merge ${id} not found`);
      return rowToMerge(row);
    },
    async lastMergeCommitBetween(sourceId, targetId): Promise<Message | null> {
      const { rows } = await pool.query<MessageRow>(
        `${SELECT_MSG}
         WHERE branch_id = $1
           AND is_merge_commit = TRUE
           AND merged_branch_id = $2
         ORDER BY sequence DESC LIMIT 1`,
        [targetId, sourceId],
      );
      const row = rows[0];
      return row ? rowToMessage(row) : null;
    },
  };
}
