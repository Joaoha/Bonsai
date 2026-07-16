import type {
  IdFactory,
  Clock,
  Message,
  MessageRepository,
  MessageCreateInput,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import { rowToMessage, type MessageRow } from '../mappers.js';

const SELECT = `SELECT id, branch_id, role, content, sequence, parent_ids,
  source_message_id, is_merge_commit, merged_branch_name, merged_branch_id,
  merged_source_last_message_id, provider, adapter_metadata, created_at
  FROM bonsai_messages`;

export function createMessageRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): MessageRepository {
  return {
    async create(input: MessageCreateInput): Promise<Message> {
      const id = ids.newId();
      const now = clock.now();
      const { rows } = await pool.query<MessageRow>(
        `INSERT INTO bonsai_messages
          (id, branch_id, role, content, sequence, parent_ids,
           source_message_id, is_merge_commit, merged_branch_name,
           merged_branch_id, merged_source_last_message_id,
           provider, adapter_metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id, branch_id, role, content, sequence, parent_ids,
                   source_message_id, is_merge_commit, merged_branch_name,
                   merged_branch_id, merged_source_last_message_id,
                   provider, adapter_metadata, created_at`,
        [
          id,
          input.branchId,
          input.role,
          input.content,
          input.sequence,
          JSON.stringify(input.parentIds),
          input.sourceMessageId ?? null,
          input.isMergeCommit ?? false,
          input.mergedBranchName ?? null,
          input.mergedBranchId ?? null,
          input.mergedSourceLastMessageId ?? null,
          input.provider ?? null,
          input.adapterMetadata ?? null,
          now,
        ],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`insert message ${id} returned no row`);
      return rowToMessage(row);
    },
    async findById(id) {
      const { rows } = await pool.query<MessageRow>(`${SELECT} WHERE id = $1`, [id]);
      const row = rows[0];
      return row ? rowToMessage(row) : null;
    },
    async findByBranchId(branchId) {
      const { rows } = await pool.query<MessageRow>(
        `${SELECT} WHERE branch_id = $1 ORDER BY sequence ASC`,
        [branchId],
      );
      return rows.map(rowToMessage);
    },
    async findManyByIds(idsIn) {
      if (idsIn.length === 0) return [];
      const { rows } = await pool.query<MessageRow>(
        `${SELECT} WHERE id = ANY($1::text[]) ORDER BY sequence ASC`,
        [idsIn],
      );
      return rows.map(rowToMessage);
    },
    async lastByBranch(branchId) {
      const { rows } = await pool.query<MessageRow>(
        `${SELECT} WHERE branch_id = $1 ORDER BY sequence DESC LIMIT 1`,
        [branchId],
      );
      const row = rows[0];
      return row ? rowToMessage(row) : null;
    },
  };
}
