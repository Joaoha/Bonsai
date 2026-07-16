#!/usr/bin/env node
// Positive test for the boundary toolchain.
// Runs ESLint and dependency-cruiser against the fixture files and asserts they FAIL.
// If either passes, the enforcement layer is broken and this script exits non-zero.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const ESLINT_FIXTURE = 'packages/core/src/__fixtures__/eslint-boundary-violation.fixture.ts';
const DEPCRUISE_FIXTURE = 'packages/core/src/__fixtures__/depcruise-boundary-violation.fixture.ts';

for (const f of [ESLINT_FIXTURE, DEPCRUISE_FIXTURE]) {
  if (!existsSync(resolve(root, f))) {
    console.error(`[boundary:verify] missing fixture: ${f}`);
    process.exit(1);
  }
}

function run(label, cmd, args) {
  console.log(`\n[boundary:verify] ${label}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  if (r.error) {
    console.error(`[boundary:verify] ${label} failed to spawn: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status === 0) {
    console.error(`\n[boundary:verify] FAIL: ${label} exited 0 but was expected to fail.`);
    console.error('---- stdout ----\n' + (r.stdout || ''));
    console.error('---- stderr ----\n' + (r.stderr || ''));
    console.error(`\nThe boundary enforcement layer is not catching the fixture. Fix the config before merging.`);
    process.exit(2);
  }
  console.log(`[boundary:verify] OK: ${label} exited ${r.status} as expected`);
}

run(
  'ESLint on eslint boundary fixture',
  'pnpm',
  ['exec', 'eslint', '--no-ignore', '--no-warn-ignored', ESLINT_FIXTURE],
);

run(
  'dependency-cruiser on depcruise boundary fixture',
  'pnpm',
  [
    'exec',
    'depcruise',
    '--config',
    '.dependency-cruiser.fixture.cjs',
    '--ts-config',
    'tsconfig.base.json',
    DEPCRUISE_FIXTURE,
  ],
);

console.log('\n[boundary:verify] all fixtures rejected as expected. Boundary toolchain is live.');
