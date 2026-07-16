// Public API surface for @bonsai/server. Deep paths are NOT part of the contract.

export { createRequestListener } from './http.js';

export {
  handleCreateProject,
  handleCreateBranch,
  handleChat,
  handleMerge,
  handleDistill,
  handleInspectContext,
  handleRetrieve,
  handleResolveTrace,
  parseCreateProject,
  parseCreateBranch,
  parseChat,
  parseMerge,
  parseDistill,
  parseInspectContext,
  parseRetrieve,
  HttpNotImplementedError,
} from './handlers.js';
export type {
  HandlerDeps,
  CreateProjectRequest,
  CreateBranchRequest,
  ChatRequest,
  MergeRequest,
  DistillRequest,
  InspectContextRequest,
  RetrieveRequest,
} from './handlers.js';

export { HttpValidationError, mapErrorToHttp } from './errors.js';
export type { HttpErrorPayload } from './errors.js';
