import type { WikiLogEntry } from '../interfaces/wiki-store.js';

/**
 * Deterministic single-line format for wiki activity logs.
 * `<ISO timestamp>\t<action>\t<slug>\t<summary-single-line>`
 */
export function formatWikiLogLine(entry: WikiLogEntry): string {
  const ts = entry.timestamp.toISOString();
  const summary = entry.summary.replace(/[\r\n\t]+/g, ' ').trim();
  return `${ts}\t${entry.action}\t${entry.slug}\t${summary}`;
}
