/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-must-not-depend-on-storage',
      severity: 'error',
      comment:
        '@bonsai/core is the framework-agnostic domain. It must not import any storage adapter. Storage adapters depend on core, not the other way around.',
      from: { path: '^packages/core/' },
      to: { path: '(^packages/storage-|^@bonsai/storage-)' },
    },
    {
      name: 'core-must-not-depend-on-provider',
      severity: 'error',
      comment:
        '@bonsai/core must not import any provider adapter. Providers implement the LLMProvider interface exported by core.',
      from: { path: '^packages/core/' },
      to: { path: '(^packages/provider-|^@bonsai/provider-)' },
    },
    {
      name: 'core-must-not-depend-on-wiki-fs',
      severity: 'error',
      comment:
        '@bonsai/core must not import the filesystem wiki adapter. Core depends only on the WikiStore interface.',
      from: { path: '^packages/core/' },
      to: { path: '(^packages/wiki-fs|^@bonsai/wiki-)' },
    },
    {
      name: 'core-must-not-depend-on-server',
      severity: 'error',
      comment:
        '@bonsai/core must not import @bonsai/server. The HTTP layer wraps core, not the other way around.',
      from: { path: '^packages/core/' },
      to: { path: '(^packages/server|^@bonsai/server)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular deps between packages are a boundary smell.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|tsx)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.[^/]+\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules', 'dist'] },
    exclude: {
      path: [
        'node_modules',
        'dist',
        '\\.tsbuildinfo$',
        '__fixtures__',
        'test/fixtures',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
