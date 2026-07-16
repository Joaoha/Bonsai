import type {
  IdFactory,
  Clock,
  Distillation,
  DistillationRepository,
  DistillationCreateInput,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import { rowToDistillation, type DistillationRow } from '../mappers.js';

export function createDistillationRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): DistillationRepository {
  return {
    async create(input: DistillationCreateInput): Promise<Distillation> {
      const id = ids.newId();
      const now = clock.now();
      const { rows } = await pool.query<DistillationRow>(
        `INSERT INTO bonsai_distillations
           (id, branch_id, merge_id, wiki_page_slug, wiki_page_title, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, branch_id, merge_id, wiki_page_slug, wiki_page_title, created_at`,
        [id, input.branchId, input.mergeId, input.wikiPageSlug, input.wikiPageTitle, now],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`insert distillation ${id} returned no row`);
      return rowToDistillation(row);
    },
    async findById(id) {
      const { rows } = await pool.query<DistillationRow>(
        `SELECT id, branch_id, merge_id, wiki_page_slug, wiki_page_title, created_at
         FROM bonsai_distillations WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      return row ? rowToDistillation(row) : null;
    },
  };
}
