import type { Id } from './ids.js';

export interface Project {
  id: Id;
  name: string;
  description?: string;
  createdAt: Date;
}
