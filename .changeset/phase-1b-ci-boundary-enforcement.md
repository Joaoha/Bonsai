---
"@bonsai/core": patch
"@bonsai/storage-postgres": patch
"@bonsai/provider-openai": patch
"@bonsai/wiki-fs": patch
"@bonsai/server": patch
---

Phase 1B: land CI boundary enforcement (ESLint `no-restricted-imports` on `packages/core/**`, dependency-cruiser forbidding core→adapter deps, `publint` + `arethetypeswrong` release gates, TruffleHog secret scan, and a `boundary:verify` positive test).
