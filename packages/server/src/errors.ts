import {
  BonsaiError,
  BonsaiInvariantError,
  BonsaiNotFoundError,
  BonsaiTokenBudgetError,
  BonsaiInterfaceError,
} from '@bonsai/core';

export interface HttpErrorPayload {
  status: number;
  body: { error: { code: string; message: string } };
}

export function mapErrorToHttp(err: unknown): HttpErrorPayload {
  if (err instanceof BonsaiNotFoundError) {
    return { status: 404, body: { error: { code: 'not_found', message: err.message } } };
  }
  if (err instanceof BonsaiInvariantError) {
    return {
      status: 422,
      body: { error: { code: 'invariant_violation', message: err.message } },
    };
  }
  if (err instanceof BonsaiTokenBudgetError) {
    return {
      status: 413,
      body: { error: { code: 'token_budget_exceeded', message: err.message } },
    };
  }
  if (err instanceof BonsaiInterfaceError) {
    return {
      status: 502,
      body: { error: { code: 'adapter_error', message: err.message } },
    };
  }
  if (err instanceof BonsaiError) {
    return { status: 500, body: { error: { code: 'bonsai_error', message: err.message } } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, body: { error: { code: 'internal_error', message } } };
}

export class HttpValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'HttpValidationError';
  }
}
