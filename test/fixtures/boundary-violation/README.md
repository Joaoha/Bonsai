# Boundary-violation fixture

Files under this directory intentionally violate the `@bonsai/core` boundary rules
enforced by ESLint (`no-restricted-imports`) and `dependency-cruiser` (forbidden
core → adapter deps).

They are excluded from `pnpm lint`, `pnpm depcruise`, `tsc -b`, and the published
package tarballs. They are consumed only by `pnpm boundary:verify`, which asserts
that the toolchain refuses to accept them. If that script ever exits 0, the boundary
enforcement is broken and this repo's core contract is no longer defended.
