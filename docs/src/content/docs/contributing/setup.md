---
title: Setup
description: Clone, install, build.
---

```bash
git clone https://github.com/Joaoha/Bonsai.git
cd bonsai-core
pnpm install
pnpm typecheck
pnpm build
```

Requirements: Node `>= 20.11`, pnpm `9.15.4` (pinned via `packageManager`).

See the [monorepo README](https://github.com/Joaoha/Bonsai#readme) for the full command inventory, including the boundary-enforcement suite (`pnpm depcruise`, `pnpm boundary:verify`) and the release gate (`pnpm release:gate`).
