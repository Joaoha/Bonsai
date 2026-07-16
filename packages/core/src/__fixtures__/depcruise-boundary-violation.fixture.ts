// Intentional boundary violation. Consumed only by `pnpm boundary:verify`.
// If dependency-cruiser stops flagging this as forbidden (core -> adapters), the depcruise config is broken.

// @ts-expect-error - workspace peer not declared; intentional for the fixture
import * as pgAdapter from '@bonsai/storage-postgres';
// @ts-expect-error - workspace peer not declared; intentional for the fixture
import * as wikiFs from '@bonsai/wiki-fs';
// @ts-expect-error - workspace peer not declared; intentional for the fixture
import * as openaiAdapter from '@bonsai/provider-openai';

export const violations = { pgAdapter, wikiFs, openaiAdapter };
