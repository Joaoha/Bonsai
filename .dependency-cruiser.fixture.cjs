// Same forbidden rules as .dependency-cruiser.cjs, but WITHOUT excluding the
// __fixtures__ path. Used by `pnpm boundary:verify` to prove the rules would
// fire on a real violation. Never used by the normal `pnpm depcruise` scan.

const base = require('./.dependency-cruiser.cjs');

module.exports = {
  ...base,
  options: {
    ...base.options,
    exclude: {
      path: ['node_modules', 'dist', '\\.tsbuildinfo$'],
    },
  },
};
