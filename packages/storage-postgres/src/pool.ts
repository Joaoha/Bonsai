// Minimal Pool interface. `pg.Pool` and `pg.PoolClient` both implement this,
// so we depend on a shape rather than the `pg` module itself. Embedders who
// prefer a different driver (e.g. postgres.js wrappers) can adapt to the
// same interface.

export interface PgQueryResult<R> {
  rows: R[];
}

export interface PgQueryable {
  query<R = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<PgQueryResult<R>>;
}
