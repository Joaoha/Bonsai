import type { Retriever, RetrieverHit, RetrieverSearchOptions, Id } from '@bonsai/core';
import type { PgQueryable } from './pool.js';

export interface PostgresFtsRetrieverOptions {
  pool: PgQueryable;
  projectId: Id;
  /** Passed to `to_tsvector` / `plainto_tsquery`. Defaults to 'english'. */
  language?: string;
  /** Cap on returned hits when `opts.limit` is not passed. Defaults to 10. */
  defaultLimit?: number;
}

/**
 * Postgres FTS retriever over `bonsai_wiki_pages`. Bound to a single project
 * because the core `Retriever.search` contract does not thread `projectId` —
 * embedders instantiate one retriever per project.
 *
 * Snippet extraction uses `ts_headline`, which is deterministic given the
 * same query and content.
 */
export class PostgresFtsRetriever implements Retriever {
  private readonly pool: PgQueryable;
  private readonly projectId: Id;
  private readonly language: string;
  private readonly defaultLimit: number;

  constructor(opts: PostgresFtsRetrieverOptions) {
    this.pool = opts.pool;
    this.projectId = opts.projectId;
    this.language = opts.language ?? 'english';
    this.defaultLimit = opts.defaultLimit ?? 10;
  }

  async search(query: string, opts?: RetrieverSearchOptions): Promise<RetrieverHit[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const limit = opts?.limit ?? this.defaultLimit;
    const { rows } = await this.pool.query<{
      id: string;
      title: string;
      snippet: string;
      score: number;
    }>(
      `SELECT id,
              title,
              ts_headline($3, content, plainto_tsquery($3, $2),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=25, MinWords=10') AS snippet,
              ts_rank(search_tsv, plainto_tsquery($3, $2))::float AS score
       FROM bonsai_wiki_pages
       WHERE project_id = $1
         AND search_tsv @@ plainto_tsquery($3, $2)
       ORDER BY score DESC, updated_at DESC
       LIMIT $4`,
      [this.projectId, trimmed, this.language, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: 'wiki' as const,
      title: r.title,
      snippet: r.snippet,
      score: r.score,
    }));
  }
}
