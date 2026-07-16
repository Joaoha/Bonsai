/**
 * Headless end-to-end demo for the @bonsai/* packages.
 *
 * Flow (per EXTRACTION_PLAN §3.11):
 *   create project → chat on main → branch → chat in branch
 *   → merge summary → distill → retrieve
 *
 * The demo uses:
 *   - @bonsai/storage-postgres against a temp Postgres (env-provided URL
 *     or a testcontainers-launched container)
 *   - @bonsai/wiki-fs against a fresh temp directory
 *   - a deterministic FakeProvider by default; set BONSAI_DEMO_USE_REAL_OPENAI=1
 *     (plus OPENAI_API_KEY) to swap in @bonsai/provider-openai
 *
 * Every domain transition is asserted; the process exits non-zero on any
 * failure so the demo doubles as a CI smoke test.
 */
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Bonsai, parseFrontmatter } from '@bonsai/core';
import type { LLMProvider } from '@bonsai/core';
import {
  applyMigrations,
  createPostgresStorage,
  PostgresFtsRetriever,
} from '@bonsai/storage-postgres';
import { FsWikiStore } from '@bonsai/wiki-fs';
import { OpenAIProvider } from '@bonsai/provider-openai';
import { Pool } from 'pg';

import { FakeProvider } from './fake-provider.js';

interface PgHandle {
  url: string;
  stop: () => Promise<void>;
}

async function startPostgres(): Promise<PgHandle> {
  const envUrl = process.env['BONSAI_DEMO_DATABASE_URL'];
  if (envUrl) {
    log(`Using BONSAI_DEMO_DATABASE_URL (${redactUrl(envUrl)})`);
    return { url: envUrl, stop: async () => undefined };
  }
  log('BONSAI_DEMO_DATABASE_URL not set — starting an ephemeral Postgres via testcontainers');
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('bonsai_demo')
    .withUsername('bonsai')
    .withPassword('bonsai')
    .start();
  return {
    url: container.getConnectionUri(),
    stop: async () => {
      await container.stop({ remove: true, removeVolumes: true });
    },
  };
}

function redactUrl(u: string): string {
  return u.replace(/:\/\/[^@]+@/, '://***@');
}

function log(msg: string): void {
  console.log(`[bonsai-demo] ${msg}`);
}

async function consumeStream(stream: AsyncIterable<{ content: string }>): Promise<string> {
  let out = '';
  for await (const chunk of stream) out += chunk.content;
  return out;
}

function pickProvider(): LLMProvider {
  if (process.env['BONSAI_DEMO_USE_REAL_OPENAI'] === '1') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('BONSAI_DEMO_USE_REAL_OPENAI=1 requires OPENAI_API_KEY');
    log('Using @bonsai/provider-openai (BONSAI_DEMO_USE_REAL_OPENAI=1)');
    return new OpenAIProvider({
      apiKey,
      ...(process.env['OPENAI_BASE_URL'] ? { baseUrl: process.env['OPENAI_BASE_URL'] } : {}),
      defaultModel: process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini',
    });
  }
  log('Using deterministic FakeProvider (default)');
  return new FakeProvider();
}

async function main(): Promise<void> {
  const migrationsRoot = resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '..',
    '..',
    '..',
    'packages',
    'storage-postgres',
    'migrations',
  );

  const pg = await startPostgres();
  const wikiRoot = await mkdtemp(join(tmpdir(), 'bonsai-demo-wiki-'));
  log(`Wiki root: ${wikiRoot}`);

  const pool = new Pool({ connectionString: pg.url, max: 4 });
  let failure: unknown = null;

  try {
    await applyMigrations(pool, migrationsRoot);

    const storage = createPostgresStorage({ pool });
    const provider = pickProvider();
    const wiki = new FsWikiStore({ root: wikiRoot });
    const bonsai = new Bonsai({ storage, provider, wiki });
    await bonsai.init();

    // 1. Create project (server-side auto-creates `main`).
    const project = await bonsai.createProject({ name: 'demo', description: 'headless E2E' });
    log(`Created project ${project.id}`);
    const branches = await storage.branches.findByProjectId(project.id);
    assert.equal(branches.length, 1, 'createProject must seed exactly one branch');
    const main = branches[0]!;
    assert.equal(main.name, 'main');

    // 2. Chat on main.
    const mainReply = await consumeStream(bonsai.chat(main.id, 'seed the project'));
    assert.ok(mainReply.length > 0, 'main chat produced no reply');
    const mainMessages = await storage.messages.findByBranchId(main.id);
    assert.equal(mainMessages.length, 2, 'expected user + assistant on main');
    assert.equal(mainMessages[0]!.role, 'user');
    assert.equal(mainMessages[1]!.role, 'assistant');

    // 3. Branch off main at the last message.
    const forkPoint = mainMessages[mainMessages.length - 1]!.id;
    const explore = await bonsai.createBranch({
      fromBranchId: main.id,
      forkPoint,
      name: 'explore',
    });
    assert.equal(explore.parentBranchId, main.id);
    assert.equal(explore.forkPoint, forkPoint);

    // 4. Chat in the branch.
    const branchReply = await consumeStream(
      bonsai.chat(explore.id, 'test alternative approach'),
    );
    assert.ok(branchReply.length > 0, 'branch chat produced no reply');
    const branchMessages = await storage.messages.findByBranchId(explore.id);
    assert.equal(branchMessages.length, 2, 'expected user + assistant on branch');

    // Sibling isolation: main still has only its 2 messages.
    const mainAfter = await storage.messages.findByBranchId(main.id);
    assert.equal(mainAfter.length, 2, 'branch chat must not leak into main');

    // 5. Merge explore → main. Assert full status transition and that the
    //    editSummary hook fires (proposed → summarized → applied).
    let editHookFired = false;
    const { merge, appliedMessage } = await bonsai.merge({
      sourceBranchId: explore.id,
      targetBranchId: main.id,
      editSummary: (draft) => {
        editHookFired = true;
        return `${draft}\n\n(reviewed by demo)`;
      },
    });
    assert.equal(editHookFired, true, 'editSummary hook was not invoked');
    assert.equal(merge.status, 'applied');
    assert.ok(merge.summary?.endsWith('(reviewed by demo)'), 'edited summary was not persisted');
    assert.equal(merge.appliedMessageId, appliedMessage.id);
    assert.equal(appliedMessage.isMergeCommit, true);
    assert.equal(appliedMessage.branchId, main.id);

    const mergedInto = await storage.messages.findByBranchId(main.id);
    assert.equal(mergedInto.length, 3, 'main must gain exactly one merge-commit message');
    assert.equal(mergedInto[2]!.isMergeCommit, true);

    const sourceAfterMerge = await storage.branches.findById(explore.id);
    assert.equal(sourceAfterMerge?.mergedToParent, true);

    // 6. Distill the merge → wiki page with frontmatter + row in storage.
    const distillation = await bonsai.distill({ mergeId: merge.id });
    assert.ok(distillation.wikiPageSlug.length > 0);
    assert.equal(distillation.mergeId, merge.id);
    assert.equal(distillation.branchId, null);

    const pageFile = join(wikiRoot, 'pages', `${distillation.wikiPageSlug}.md`);
    const raw = await readFile(pageFile, 'utf8');
    const { frontmatter, body } = parseFrontmatter(raw);
    assert.equal(frontmatter['title'], distillation.wikiPageTitle);
    assert.equal(frontmatter['mergeId'], merge.id);
    assert.ok(Array.isArray(frontmatter['sources']), 'frontmatter.sources must be an array');
    assert.ok(
      (frontmatter['sources'] as unknown[]).length > 0,
      'frontmatter.sources must not be empty',
    );
    assert.ok(body.includes(distillation.wikiPageTitle), 'body must contain the page title');

    // 7. Retrieve: FTS lookup on a term we know appears in the merge summary
    //    (the FakeProvider echoes user prompts back, so `alternative` is
    //    guaranteed to be in the distilled page). Real-provider mode may
    //    produce different wording, so guard the exact assertion.
    const retriever = new PostgresFtsRetriever({ pool, projectId: project.id });
    if (process.env['BONSAI_DEMO_USE_REAL_OPENAI'] === '1') {
      // Try a more permissive query built from the page title.
      const titleTerm = distillation.wikiPageTitle.split(/\s+/).slice(-1)[0] ?? 'merge';
      const hits = await retriever.search(titleTerm);
      assert.ok(hits.length > 0, `retriever returned no hits for "${titleTerm}"`);
    } else {
      const hits = await retriever.search('alternative');
      assert.ok(hits.length > 0, 'retriever returned no hits for "alternative"');
      assert.ok(
        hits.some((h) => h.title === distillation.wikiPageTitle),
        'retriever did not surface the distilled page',
      );
    }

    // 8. Audit trace end-to-end reachability.
    const trace = await bonsai.resolveTrace(distillation.wikiPageSlug);
    assert.ok(trace, 'resolveTrace returned null for a freshly written wiki page');

    log('OK: create → chat → branch → chat → merge → distill → retrieve');
  } catch (err) {
    failure = err;
  } finally {
    await pool.end().catch(() => undefined);
    await pg.stop().catch(() => undefined);
  }

  if (failure) {
    console.error('[bonsai-demo] FAIL:', failure);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[bonsai-demo] unexpected:', err);
  process.exit(1);
});
