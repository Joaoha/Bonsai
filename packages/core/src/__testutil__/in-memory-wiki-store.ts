import type {
  WikiStore,
  WikiPageInput,
  WikiLogEntry,
  WikiIndexEntry,
} from '../interfaces/wiki-store.js';

export class InMemoryWikiStore implements WikiStore {
  readonly pages = new Map<string, WikiPageInput>();
  readonly log: WikiLogEntry[] = [];
  index: WikiIndexEntry[] = [];

  async write(input: WikiPageInput): Promise<void> {
    this.pages.set(input.slug, { ...input });
  }
  async read(slug: string): Promise<WikiPageInput | null> {
    const p = this.pages.get(slug);
    return p ? { ...p } : null;
  }
  async list(): Promise<WikiIndexEntry[]> {
    return Array.from(this.pages.values()).map((p) => ({
      slug: p.slug,
      title: p.title,
    }));
  }
  async appendLogEntry(entry: WikiLogEntry): Promise<void> {
    this.log.push({ ...entry });
  }
  async upsertIndex(index: WikiIndexEntry[]): Promise<void> {
    this.index = index.map((e) => ({ ...e }));
  }
}
