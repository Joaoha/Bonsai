# @bonsai/wiki-fs

Markdown-on-disk `WikiStore` adapter for [@bonsai/core](../core). Persists distilled wiki pages as `<root>/pages/<slug>.md`, maintains an `<root>/index.md`, and appends to a chronological `<root>/log.md`.

## No filesystem default

The constructor requires an explicit absolute `root`. There is no built-in default — the embedder chooses the directory. This is a deliberate hardening: bugs that emit a hostile slug cannot escalate into writes at a well-known path.

```ts
import { FsWikiStore } from '@bonsai/wiki-fs';

const wiki = new FsWikiStore({ root: '/absolute/path/to/wiki' });
```

Constructor is I/O-free (per the [`@bonsai/core` boundary rules](../../EXTRACTION_PLAN.md#1-guiding-rules-from-the-approved-plan)); the `pages/` directory is created lazily on the first `write` / `appendLogEntry` / `upsertIndex` call.

## Path-escape guard

Every slug is validated against `^[a-z0-9][a-z0-9-]*$` and every resolved path is re-checked to sit inside `root/`. Any of these attempts is rejected with `WikiFsPathError`:

- traversal: `..`, `../etc`, `..\etc`
- absolute-looking: `/etc/passwd`, `C:\evil`
- separators or NUL: `a/b`, `a\b`, `react\0`
- non-kebab: `React`, `react hooks`, `.hidden`, `-x`, `%2e%2e`

The guard is exported (`assertSafeSlug`, `resolvePageFile`) so higher layers can validate slugs before they even reach the store.

## Layout on disk

```
<root>/
  pages/
    <slug>.md   # frontmatter + body, exactly what was passed to write()
  index.md      # rewritten on upsertIndex(); markdown bullet list
  log.md        # append-only, one bullet per write
```

## Test

```
pnpm --filter @bonsai/wiki-fs test
```

Tests use `fs.mkdtemp` to create isolated temp roots and include explicit escape-attempt cases.
