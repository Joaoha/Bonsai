// ID abstraction. Default uses Node's Web Crypto randomUUID; embedders may
// inject a deterministic factory (e.g. tests, ULIDs).

import { randomUUID } from 'crypto';

export type Id = string;

export interface IdFactory {
  newId(): Id;
}

export class RandomIdFactory implements IdFactory {
  newId(): Id {
    return randomUUID();
  }
}
