import { describe, it, expect } from 'vitest';
import { parseOpenAISseStream } from './sse.js';

async function* fromStrings(chunks: string[]): AsyncIterable<string> {
  for (const c of chunks) yield c;
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

const wrap = (payload: object | string) =>
  `data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`;

describe('parseOpenAISseStream', () => {
  it('parses one event per data line', async () => {
    const events = await collect(
      parseOpenAISseStream(
        fromStrings([
          wrap({ choices: [{ delta: { content: 'hel' } }] }),
          wrap({ choices: [{ delta: { content: 'lo' } }] }),
          'data: [DONE]\n\n',
        ]),
      ),
    );
    expect(events).toHaveLength(2);
    expect(events[0]?.choices?.[0]?.delta?.content).toBe('hel');
    expect(events[1]?.choices?.[0]?.delta?.content).toBe('lo');
  });

  it('reassembles events split across arbitrary byte boundaries', async () => {
    const full = wrap({ choices: [{ delta: { content: 'abcd' } }] });
    const mid = Math.floor(full.length / 2);
    const events = await collect(
      parseOpenAISseStream(fromStrings([full.slice(0, mid), full.slice(mid)])),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.choices?.[0]?.delta?.content).toBe('abcd');
  });

  it('ignores comments, keep-alives, and malformed JSON frames', async () => {
    const events = await collect(
      parseOpenAISseStream(
        fromStrings([
          ': keepalive ping\n',
          '\n',
          'data: not-json\n\n',
          wrap({ choices: [{ delta: { content: 'ok' } }] }),
        ]),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.choices?.[0]?.delta?.content).toBe('ok');
  });

  it('honours CRLF line endings', async () => {
    const events = await collect(
      parseOpenAISseStream(
        fromStrings([
          `data: ${JSON.stringify({ choices: [{ delta: { content: 'crlf' } }] })}\r\n\r\n`,
        ]),
      ),
    );
    expect(events[0]?.choices?.[0]?.delta?.content).toBe('crlf');
  });

  it('stops after [DONE] and drops trailing events', async () => {
    const events = await collect(
      parseOpenAISseStream(
        fromStrings([
          wrap({ choices: [{ delta: { content: 'a' } }] }),
          'data: [DONE]\n\n',
          wrap({ choices: [{ delta: { content: 'b' } }] }),
        ]),
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.choices?.[0]?.delta?.content).toBe('a');
  });
});
