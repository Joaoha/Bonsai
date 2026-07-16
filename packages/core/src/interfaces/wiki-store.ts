export interface WikiPageInput {
  slug: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface WikiLogEntry {
  timestamp: Date;
  slug: string;
  action: 'created' | 'updated';
  summary: string;
}

export interface WikiIndexEntry {
  slug: string;
  title: string;
}

export interface WikiStore {
  write(input: WikiPageInput): Promise<void>;
  read(slug: string): Promise<WikiPageInput | null>;
  list(): Promise<WikiIndexEntry[]>;
  appendLogEntry(entry: WikiLogEntry): Promise<void>;
  upsertIndex(index: WikiIndexEntry[]): Promise<void>;
}
