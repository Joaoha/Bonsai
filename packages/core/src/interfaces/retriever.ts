import type { Id } from '../domain/ids.js';

export interface RetrieverHit {
  id: Id;
  kind: 'wiki' | 'message';
  title: string;
  snippet: string;
  score: number;
}

export interface RetrieverSearchOptions {
  limit?: number;
}

export interface Retriever {
  search(query: string, opts?: RetrieverSearchOptions): Promise<RetrieverHit[]>;
}
