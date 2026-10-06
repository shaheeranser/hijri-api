/** Public surface of the announcement watcher module. */
export { runWatcher, type Agreement, type WatcherOptions, type WatcherOutcome } from "./watcher.js";
export { buildCandidates, isPollingWindow, type CandidatePair, type MonthCandidate } from "./candidates.js";
export {
  DEFAULT_SOURCES,
  createParser,
  fetchArticles,
  type Article,
  type FetchLike,
  type SourceConfig,
  type SourceError,
} from "./sources.js";
export { extractAnnouncedStart, type Extraction } from "./extract.js";
export {
  applyProposal,
  buildProposal,
  countPublishers,
  renderPullRequestBody,
  type BuildProposalOptions,
  type Evidence,
  type Proposal,
} from "./proposal.js";
