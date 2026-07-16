import { RandomIdFactory, type IdFactory } from '@bonsai/core';

// The interfaces in @bonsai/core do NOT pass an id to repository create()
// methods — the adapter is responsible for generating one. Embedders can
// override by constructing storage with a custom IdFactory.
export const defaultIdFactory: IdFactory = new RandomIdFactory();
