import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpValidationError, mapErrorToHttp } from './errors.js';
import {
  handleChat,
  handleCreateBranch,
  handleCreateProject,
  handleDistill,
  handleInspectContext,
  handleMerge,
  handleResolveTrace,
  handleRetrieve,
  HttpNotImplementedError,
  parseChat,
  parseCreateBranch,
  parseCreateProject,
  parseDistill,
  parseInspectContext,
  parseMerge,
  parseRetrieve,
} from './handlers.js';
import type { HandlerDeps } from './handlers.js';

const MAX_BODY_BYTES = 1_048_576; // 1 MiB — small on purpose; embedders can wrap.

/**
 * Build a Node HTTP request listener that dispatches Bonsai routes.
 *
 * Routes (all JSON except SSE on chat):
 *   POST /projects                -> createProject
 *   POST /branches                -> createBranch
 *   POST /chat                    -> streams LLMChunk as text/event-stream
 *   POST /merges                  -> merge
 *   POST /distillations           -> distill
 *   POST /context:assemble        -> inspectContext (ContextPacket)
 *   POST /retrieve                -> retriever hits (501 if no retriever)
 *   GET  /traces/:wikiSlug        -> resolveTrace
 *
 * The listener is intentionally framework-agnostic. Embedders who already run
 * Fastify/Express/Next can call the exported `handle*` functions directly
 * instead of using this listener.
 */
export function createRequestListener(deps: HandlerDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(req.url ?? '/', 'http://localhost');
      const pathname = url.pathname;

      if (method === 'POST' && pathname === '/projects') {
        const body = await readJsonBody(req);
        const project = await handleCreateProject(deps, parseCreateProject(body));
        return sendJson(res, 201, project);
      }
      if (method === 'POST' && pathname === '/branches') {
        const body = await readJsonBody(req);
        const branch = await handleCreateBranch(deps, parseCreateBranch(body));
        return sendJson(res, 201, branch);
      }
      if (method === 'POST' && pathname === '/chat') {
        const body = await readJsonBody(req);
        const chatReq = parseChat(body);
        return sendChatStream(res, handleChat(deps, chatReq));
      }
      if (method === 'POST' && pathname === '/merges') {
        const body = await readJsonBody(req);
        const result = await handleMerge(deps, parseMerge(body));
        return sendJson(res, 201, result);
      }
      if (method === 'POST' && pathname === '/distillations') {
        const body = await readJsonBody(req);
        const distillation = await handleDistill(deps, parseDistill(body));
        return sendJson(res, 201, distillation);
      }
      if (method === 'POST' && pathname === '/context:assemble') {
        const body = await readJsonBody(req);
        const packet = await handleInspectContext(deps, parseInspectContext(body));
        return sendJson(res, 200, packet);
      }
      if (method === 'POST' && pathname === '/retrieve') {
        const body = await readJsonBody(req);
        const hits = await handleRetrieve(deps, parseRetrieve(body));
        return sendJson(res, 200, { hits });
      }
      if (method === 'GET' && pathname.startsWith('/traces/')) {
        const slug = decodeURIComponent(pathname.slice('/traces/'.length));
        if (slug.length === 0) {
          return sendJson(res, 400, {
            error: { code: 'invalid_request', message: 'wiki slug required' },
          });
        }
        const trace = await handleResolveTrace(deps, slug);
        if (!trace) {
          return sendJson(res, 404, {
            error: { code: 'not_found', message: `no trace for wiki slug ${slug}` },
          });
        }
        return sendJson(res, 200, trace);
      }
      return sendJson(res, 404, {
        error: { code: 'route_not_found', message: `${method} ${pathname}` },
      });
    } catch (err: unknown) {
      if (err instanceof HttpValidationError) {
        return sendJson(res, err.status, {
          error: { code: 'invalid_request', message: err.message },
        });
      }
      if (err instanceof HttpNotImplementedError) {
        return sendJson(res, err.status, {
          error: { code: 'not_implemented', message: err.message },
        });
      }
      const mapped = mapErrorToHttp(err);
      return sendJson(res, mapped.status, mapped.body);
    }
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk instanceof Buffer ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new HttpValidationError(`request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    chunks.push(buf);
  }
  if (total === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpValidationError('body is not valid JSON');
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body).toString(),
  });
  res.end(body);
}

async function sendChatStream(
  res: ServerResponse,
  stream: AsyncIterable<{ content: string; done: boolean }>,
): Promise<void> {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  try {
    for await (const chunk of stream) {
      res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
      if (chunk.done) break;
    }
    res.write('event: end\ndata: {}\n\n');
  } catch (err) {
    const mapped = mapErrorToHttp(err);
    res.write(
      `event: error\ndata: ${JSON.stringify({ status: mapped.status, ...mapped.body })}\n\n`,
    );
  } finally {
    res.end();
  }
}
