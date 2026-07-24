---
title: Changesets
description: How releases are cut.
---

The monorepo uses [Changesets](https://github.com/changesets/changesets). Every PR that changes a package under `packages/*` must add a changeset entry.

```bash
pnpm changeset          # add a changeset entry
pnpm changeset:status   # show pending changesets
```

Release gate (run before publishing):

```bash
pnpm release:gate       # build + publint + attw
```

> **Stub.** Full policy (semver rules, prerelease flow, tagging) tracked in the [issue tracker](https://github.com/Joaoha/Bonsai/issues).
