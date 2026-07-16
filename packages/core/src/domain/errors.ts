// Error hierarchy for @bonsai/core. Framework-agnostic; no I/O.

export class BonsaiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BonsaiError';
  }
}

export class BonsaiInvariantError extends BonsaiError {
  constructor(message: string) {
    super(message);
    this.name = 'BonsaiInvariantError';
  }
}

export class BonsaiTokenBudgetError extends BonsaiError {
  constructor(message: string) {
    super(message);
    this.name = 'BonsaiTokenBudgetError';
  }
}

export class BonsaiNotFoundError extends BonsaiError {
  constructor(message: string) {
    super(message);
    this.name = 'BonsaiNotFoundError';
  }
}

export class BonsaiInterfaceError extends BonsaiError {
  constructor(message: string) {
    super(message);
    this.name = 'BonsaiInterfaceError';
  }
}
