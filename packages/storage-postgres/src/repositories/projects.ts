import type {
  IdFactory,
  Clock,
  Project,
  ProjectRepository,
  ProjectCreateInput,
} from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import type { PgQueryable } from '../pool.js';
import { rowToProject, type ProjectRow } from '../mappers.js';

export function createProjectRepository(
  pool: PgQueryable,
  ids: IdFactory,
  clock: Clock,
): ProjectRepository {
  return {
    async create(input: ProjectCreateInput): Promise<Project> {
      const id = ids.newId();
      const now = clock.now();
      const { rows } = await pool.query<ProjectRow>(
        `INSERT INTO bonsai_projects (id, name, description, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, created_at`,
        [id, input.name, input.description ?? null, now],
      );
      const row = rows[0];
      if (!row) throw new BonsaiNotFoundError(`insert project ${id} returned no row`);
      return rowToProject(row);
    },
    async findById(id) {
      const { rows } = await pool.query<ProjectRow>(
        `SELECT id, name, description, created_at
         FROM bonsai_projects WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      return row ? rowToProject(row) : null;
    },
  };
}
