import type {
  IdFactory,
  Clock,
  WikiPage,
  WikiPageHit,
  WikiPageRepository,
  WikiPageUpsertInput,
  WikiPageSearchInput,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import { rowToWikiPage, type WikiPageRow } from '../mappers.js';

const SELECT = `SELECT id, project_id, slug, title, content, created_at, updated_at
                FROM bonsai_wiki_pages`;

export function createWikiPageRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): WikiPageRepository {
  return {
    async upsert(input: WikiPageUpsertInput): Promise<WikiPage> {
      const now = clock.now();
      const newId = ids.newId();
      const { rows } = await pool.query<WikiPageRow>(
        `INSERT INTO bonsai_wiki_pages
           (id, project_id, slug, title, content, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6)
         ON CONFLICT (project_id, slug) DO UPDATE
           SET title = EXCLUDED.title,
               content = EXCLUDED.content,
               updated_at = EXCLUDED.updated_at
         RETURNING id, project_id, slug, title, content, created_at, updated_at`,
        [newId, input.projectId, input.slug, input.title, input.content, now],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`upsert wiki page ${input.slug} returned no row`);
      return rowToWikiPage(row);
    },
    async list(projectId) {
      const { rows } = await pool.query<WikiPageRow>(
        `${SELECT} WHERE project_id = $1 ORDER BY updated_at DESC`,
        [projectId],
      );
      return rows.map(rowToWikiPage);
    },
    async search(input: WikiPageSearchInput): Promise<WikiPageHit[]> {
      const limit = input.limit ?? 10;
      const { rows } = await pool.query<WikiPageRow & { score: number }>(
        `SELECT id, project_id, slug, title, content, created_at, updated_at,
                ts_rank(search_tsv, plainto_tsquery('english', $2))::float AS score
         FROM bonsai_wiki_pages
         WHERE project_id = $1
           AND search_tsv @@ plainto_tsquery('english', $2)
         ORDER BY score DESC, updated_at DESC
         LIMIT $3`,
        [input.projectId, input.keywords, limit],
      );
      return rows.map((r) => ({ ...rowToWikiPage(r), score: r.score }));
    },
  };
}
