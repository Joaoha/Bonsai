/**
 * Server-Sent Events line parser tailored to OpenAI's `/chat/completions`
 * streaming format. Pure and stream-agnostic: consumes an async iterable of
 * text chunks (any framing), yields one parsed SSE event per `data:` line.
 *
 * The transport layer (@see provider.ts) turns the response body into a
 * text-chunk iterable and pipes it through {@link parseOpenAISseStream}.
 */

export interface OpenAIStreamDelta {
  role?: string;
  content?: string;
}

export interface OpenAIStreamChoice {
  index?: number;
  delta?: OpenAIStreamDelta;
  finish_reason?: string | null;
}

export interface OpenAIStreamUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface OpenAIStreamEvent {
  id?: string;
  choices?: OpenAIStreamChoice[];
  usage?: OpenAIStreamUsage;
}

/**
 * Yields parsed OpenAI stream events from a text-chunk iterable. Buffers
 * partial lines across chunks so callers may split anywhere (byte-boundaries,
 * newlines, keep-alives). Ignores comment lines and `[DONE]` sentinels — the
 * end-of-stream is signalled by the underlying iterable ending.
 */
export async function* parseOpenAISseStream(
  chunks: AsyncIterable<string>,
): AsyncIterable<OpenAIStreamEvent> {
  let buffer = '';
  for await (const chunk of chunks) {
    buffer += chunk;
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const rawLine = buffer.slice(0, newlineIdx);
      buffer = buffer.slice(newlineIdx + 1);
      const line = rawLine.replace(/\r$/, '');
      if (line === '' || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trimStart();
      if (payload === '[DONE]') return;
      try {
        yield JSON.parse(payload) as OpenAIStreamEvent;
      } catch {
        // Malformed frame — provider errors surface via HTTP status; ignore.
      }
    }
  }
}

/**
 * Adapt a WHATWG {@link ReadableStream} of bytes into an async iterable of
 * decoded text chunks. Extracted so tests can bypass the fetch machinery.
 */
export async function* readableStreamToText(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        const tail = decoder.decode();
        if (tail) yield tail;
        return;
      }
      const text = decoder.decode(value, { stream: true });
      if (text) yield text;
    }
  } finally {
    reader.releaseLock();
  }
}
