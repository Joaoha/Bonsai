// @ts-check
import { defineConfig } from 'astro/config';
import { readdir, rename, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import starlight from '@astrojs/starlight';
import { createStarlightTypeDocPlugin } from 'starlight-typedoc';

/**
 * starlight-typedoc + typedoc-plugin-markdown emit files with a `.html` extension
 * whose content is Markdown. Astro's content collection only globs `.md`/`.mdx`,
 * so we rename them and rewrite internal `href="....html"` links to strip the
 * extension (which is Starlight's link convention). Runs after Starlight's
 * config:setup hook has already generated the pages.
 */
const renameTypeDocOutputs = {
  name: 'bonsai-rename-typedoc-outputs',
  hooks: {
    'astro:config:done': async ({ config }) => {
      const apiRoot = join(config.srcDir.pathname, 'content/docs/api');
      const walk = async (dir) => {
        let entries;
        try {
          entries = await readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            await walk(full);
          } else if (entry.name.endsWith('.html')) {
            const nextName = full.slice(0, -'.html'.length) + '.md';
            let content = await readFile(full, 'utf8');
            content = content.replace(/\.html([)#"'])/g, '$1');
            await writeFile(nextName, content, 'utf8');
            await rename(full, nextName).catch(() => undefined);
          }
        }
      };
      await walk(apiRoot);
    },
  },
};

const [
  starlightTypeDocCore,
  typeDocCoreSidebar,
] = createStarlightTypeDocPlugin();
const [
  starlightTypeDocStorage,
  typeDocStorageSidebar,
] = createStarlightTypeDocPlugin();
const [
  starlightTypeDocProvider,
  typeDocProviderSidebar,
] = createStarlightTypeDocPlugin();
const [
  starlightTypeDocWiki,
  typeDocWikiSidebar,
] = createStarlightTypeDocPlugin();
const [
  starlightTypeDocServer,
  typeDocServerSidebar,
] = createStarlightTypeDocPlugin();

const typedocOptions = {
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  skipErrorChecking: true,
  githubPages: false,
  fileExtension: '.md',
};

export default defineConfig({
  site: 'https://joaoha.github.io/Bonsai',
  integrations: [
    renameTypeDocOutputs,
    starlight({
      title: '@bonsai/core',
      description:
        'Branchable conversations for LLM apps — TypeScript primitives, inspectable context, no framework lock-in.',
      logo: {
        src: './src/assets/bonsai-mark.svg',
        replacesTitle: false,
      },
      social: {
        github: 'https://github.com/Joaoha/Bonsai',
      },
      editLink: {
        baseUrl:
          'https://github.com/Joaoha/Bonsai/edit/main/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      plugins: [
        starlightTypeDocCore({
          entryPoints: ['../packages/core/src/index.ts'],
          tsconfig: '../packages/core/tsconfig.json',
          output: 'api/core',
          sidebar: { label: '@bonsai/core', collapsed: true },
          typeDoc: typedocOptions,
        }),
        starlightTypeDocStorage({
          entryPoints: ['../packages/storage-postgres/src/index.ts'],
          tsconfig: '../packages/storage-postgres/tsconfig.json',
          output: 'api/storage-postgres',
          sidebar: { label: '@bonsai/storage-postgres', collapsed: true },
          typeDoc: typedocOptions,
        }),
        starlightTypeDocProvider({
          entryPoints: ['../packages/provider-openai/src/index.ts'],
          tsconfig: '../packages/provider-openai/tsconfig.json',
          output: 'api/provider-openai',
          sidebar: { label: '@bonsai/provider-openai', collapsed: true },
          typeDoc: typedocOptions,
        }),
        starlightTypeDocWiki({
          entryPoints: ['../packages/wiki-fs/src/index.ts'],
          tsconfig: '../packages/wiki-fs/tsconfig.json',
          output: 'api/wiki-fs',
          sidebar: { label: '@bonsai/wiki-fs', collapsed: true },
          typeDoc: typedocOptions,
        }),
        starlightTypeDocServer({
          entryPoints: ['../packages/server/src/index.ts'],
          tsconfig: '../packages/server/tsconfig.json',
          output: 'api/server',
          sidebar: { label: '@bonsai/server', collapsed: true },
          typeDoc: typedocOptions,
        }),
      ],
      sidebar: [
        { label: 'Quickstart', link: '/quickstart/' },
        {
          label: 'Concepts',
          items: [
            { label: 'Tree Model', link: '/concepts/tree-model/' },
            { label: 'ContextPacket', link: '/concepts/context-packet/' },
            { label: 'Merge', link: '/concepts/merge/' },
            { label: 'Distill', link: '/concepts/distill/' },
            { label: 'Wiki', link: '/concepts/wiki/' },
            { label: 'Retrieval', link: '/concepts/retrieval/' },
          ],
        },
        {
          label: 'Recipes',
          items: [
            { label: 'Embed in Next.js', link: '/recipes/embed-nextjs/' },
            { label: 'Custom Provider', link: '/recipes/custom-provider/' },
            { label: 'Custom Storage', link: '/recipes/custom-storage/' },
            { label: 'Custom Retriever', link: '/recipes/custom-retriever/' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            typeDocCoreSidebar,
            typeDocStorageSidebar,
            typeDocProviderSidebar,
            typeDocWikiSidebar,
            typeDocServerSidebar,
          ],
        },
        { label: 'Examples', link: '/examples/' },
        {
          label: 'Contributing',
          items: [
            { label: 'Setup', link: '/contributing/setup/' },
            { label: 'Testing', link: '/contributing/testing/' },
            { label: 'Changesets', link: '/contributing/changesets/' },
            { label: 'RFC Process', link: '/contributing/rfc-process/' },
          ],
        },
      ],
    }),
  ],
});
