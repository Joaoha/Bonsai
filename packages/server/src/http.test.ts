import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Bonsai, LLMChunk } from '@bonsai/core';
import { BonsaiNotFoundError } from '@bonsai/core';
import { createRequestListener } from './http.js';

function stubBonsai(overrides: Partial<Bonsai>): Bonsai {
  return {
    async createProject(input) {
      return { id: 'p1', name: input.name, createdAt: new Date(0) };
    },
    async createBranch(input) {
      return {
        id: 'b2',
        projectId: 'p1',
        name: input.name ?? 'auto',
        parentBranchId: input.fromBranchId,
        forkPoint: input.forkPoint,
        lane: 1,
        autoNamed: !input.name,
        pinnedAgent: null,
        mergedToParent: false,
        createdAt: new Date(0),
      };
    },
    ...overrides,
  } as Bonsai;
}

async function startServer(bonsai: Bonsai): Promise<{ server: Server; base: string }> {
  const server = createServer(createRequestListener({ bonsai }));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${addr.port}` };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
}

describe('createRequestListener', () => {
  let server: Server;
  let base: string;

  afterEach(async () => {
    if (server) await stopServer(server);
  });

  it('POST /projects creates a project (201)', async () => {
    ({ server, base } = await startServer(stubBonsai({})));
    const res = await fetch(`${base}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'proj' }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'p1', name: 'proj' });
  });

  it('POST /projects returns 400 for invalid body', async () => {
    ({ server, base } = await startServer(stubBonsai({})));
    const res = await fetch(`${base}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('invalid_request');
  });

  it('POST /chat streams SSE chunks and closes with end event', async () => {
    const script: LLMChunk[] = [
      { content: 'hel', done: false },
      { content: 'lo', done: false },
      { content: '', done: true },
    ];
    ({ server, base } = await startServer(
      stubBonsai({
        chat: async function* () {
          for (const c of script) yield c;
        } as Bonsai['chat'],
      }),
    ));
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branchId: 'b1', message: 'hi' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    // Split SSE events by blank-line separator.
    const events = text
      .split('\n\n')
      .map((e) => e.trim())
      .filter(Boolean);
    // 3 chunk events + 1 end event
    expect(events.length).toBe(4);
    const chunkEvents = events.filter((e) => e.startsWith('event: chunk'));
    expect(chunkEvents).toHaveLength(3);
    const parsed = chunkEvents.map((e) => JSON.parse(e.split('\ndata: ')[1] ?? '{}'));
    expect(parsed).toEqual(script);
    expect(events.at(-1)?.startsWith('event: end')).toBe(true);
  });

  it('propagates domain errors as SSE error event on chat', async () => {
    ({ server, base } = await startServer(
      stubBonsai({
        chat: async function* () {
          throw new BonsaiNotFoundError('branch missing');
          yield { content: '', done: true } as LLMChunk;
        } as Bonsai['chat'],
      }),
    ));
    const res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ branchId: 'b1', message: 'hi' }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('event: error');
    expect(text).toContain('"status":404');
  });

  it('maps BonsaiNotFoundError to 404 on JSON routes', async () => {
    ({ server, base } = await startServer(
      stubBonsai({
        createBranch: (async () => {
          throw new BonsaiNotFoundError('parent missing');
        }) as Bonsai['createBranch'],
      }),
    ));
    const res = await fetch(`${base}/branches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromBranchId: 'nope', forkPoint: null }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('not_found');
  });

  it('POST /retrieve returns 501 without retriever', async () => {
    ({ server, base } = await startServer(stubBonsai({})));
    const res = await fetch(`${base}/retrieve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'q' }),
    });
    expect(res.status).toBe(501);
  });

  it('unknown route returns 404', async () => {
    ({ server, base } = await startServer(stubBonsai({})));
    const res = await fetch(`${base}/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it('rejects non-JSON body with 400', async () => {
    ({ server, base } = await startServer(stubBonsai({})));
    const res = await fetch(`${base}/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});
