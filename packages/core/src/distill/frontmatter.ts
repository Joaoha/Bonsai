// Minimal YAML-ish frontmatter renderer/parser. Handles primitive values
// (string / number / boolean / null / ISO Date) and one-level arrays of the
// same. NOT a full YAML implementation — sufficient for @bonsai/core's
// self-emitted frontmatter round-trip and nothing more.

function isSafeBareString(s: string): boolean {
  return /^[A-Za-z0-9_./:@-]+$/.test(s) && s.length > 0;
}

function quote(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function renderScalar(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('frontmatter: non-finite number');
    return String(v);
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    if (isSafeBareString(v)) return v;
    return quote(v);
  }
  throw new Error(`frontmatter: unsupported scalar type: ${typeof v}`);
}

export function renderFrontmatter(fm: Record<string, unknown>): string {
  const keys = Object.keys(fm).sort();
  const lines: string[] = ['---'];
  for (const k of keys) {
    const v = fm[k];
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) {
        lines.push(`  - ${renderScalar(item)}`);
      }
    } else {
      lines.push(`${k}: ${renderScalar(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function parseScalar(raw: string): unknown {
  const s = raw.trim();
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return Number(s);
  }
  return s;
}

export function parseFrontmatter(md: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  if (!md.startsWith('---\n') && !md.startsWith('---\r\n')) {
    return { frontmatter: {}, body: md };
  }
  const nl = md.indexOf('\n');
  const rest = md.slice(nl + 1);
  const endIdx = rest.indexOf('\n---');
  if (endIdx < 0) return { frontmatter: {}, body: md };
  const fmBlock = rest.slice(0, endIdx);
  const afterEnd = rest.slice(endIdx + 4);
  // Strip up to two leading newlines: one to terminate the closing `---`,
  // and one for the conventional blank separator between frontmatter and body.
  let body = afterEnd;
  if (body.startsWith('\n')) body = body.slice(1);
  if (body.startsWith('\n')) body = body.slice(1);

  const fm: Record<string, unknown> = {};
  const lines = fmBlock.split('\n');
  let currentArrayKey: string | null = null;
  for (const line of lines) {
    if (line.startsWith('  - ')) {
      if (currentArrayKey === null) continue;
      const arr = fm[currentArrayKey] as unknown[];
      arr.push(parseScalar(line.slice(4)));
      continue;
    }
    const m = /^([^:]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const rawVal = m[2];
    if (key === undefined) continue;
    if (rawVal === undefined || rawVal === '') {
      fm[key] = [];
      currentArrayKey = key;
    } else {
      fm[key] = parseScalar(rawVal);
      currentArrayKey = null;
    }
  }
  return { frontmatter: fm, body };
}
