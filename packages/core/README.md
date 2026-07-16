# @bonsai/core

Framework-agnostic primitives for Bonsai — a branchable-conversation library with
inspectable context, editable merges, and durable wiki distillation.

`@bonsai/core` publishes the **domain model**, **ContextPacket assembly**, and
the pluggable **Storage / LLMProvider / WikiStore / Retriever** interfaces. It
has zero runtime dependencies, does no I/O in constructors, and knows nothing
about Postgres, filesystems, HTTP clients, or UI frameworks — those live in
sibling `@bonsai/*` adapter packages.

## Install

```bash
npm install @bonsai/core
```

## Quick example

```ts
import { Bonsai } from '@bonsai/core';
// import concrete adapters from the sibling packages:
// import { PostgresStorage } from '@bonsai/storage-postgres';
// import { OpenAIProvider }   from '@bonsai/provider-openai';
// import { FsWikiStore }      from '@bonsai/wiki-fs';

const bonsai = new Bonsai({
  storage:  /* your Storage */,
  provider: /* your LLMProvider */,
  wiki:     /* your WikiStore */,
});

const project = await bonsai.createProject({ name: 'demo' });
const main = (await /* fetch project's main branch */)!;

for await (const chunk of bonsai.chat(main.id, 'Hello!')) {
  process.stdout.write(chunk.content);
}
```

See the full monorepo — including adapters, examples, and the extraction plan —
at the repository root.
