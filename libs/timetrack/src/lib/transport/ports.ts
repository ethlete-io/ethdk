import { Observable } from 'rxjs';
import {
  TimetrackCoverageStore,
  TimetrackEventStore,
  TimetrackLedgerStore,
  TimetrackReviewStore,
  TimetrackSettingsStore,
  TimetrackTimerStore,
} from '../store/ports';

export type TimetrackRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type TimetrackRequest = {
  method: TimetrackRequestMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  /**
   * A form-encoded body, sent instead of `body`. OAuth token endpoints take
   * `application/x-www-form-urlencoded` and reject JSON, so a provider that talks to one has no other
   * way to ask for a token.
   */
  form?: Record<string, string>;
};

export type TimetrackResponse<T> = {
  status: number;
  headers: Record<string, string>;
  body: T;
};

/**
 * Every outbound call goes through the host. Jira, Tempo and Google all reject browser-origin
 * requests, and the tokens must never be readable from the webview, so the core never issues a
 * request itself.
 */
export type TimetrackTransport = {
  request$<T>(req: TimetrackRequest): Observable<TimetrackResponse<T>>;
};

/**
 * The OS keychain. `has$` exists so a settings screen can say whether a provider is configured without
 * pulling the secret into the window to look at it.
 */
export type TimetrackSecretStore = {
  read$(key: string): Observable<string | null>;
  write$(key: string, value: string): Observable<void>;
  /** Whether a non-empty secret is stored under `key`. */
  has$(key: string): Observable<boolean>;
  delete$(key: string): Observable<void>;
};

/** What one run asks the model for. A spec that names none is no model call, and nothing meters it. */
export type ModelAsk = 'the day' | 'a ticket' | 'a match';

export type ProcessSpec = {
  command: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  /** Names this run as a model call, so `meteredRunner` records what it spent. */
  ask?: ModelAsk;
};

export type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
};

/** Runs the user's local agent CLI. The core never spawns a process itself. */
export type TimetrackProcessRunner = {
  run$(spec: ProcessSpec): Observable<ProcessResult>;
};

/** The two files a spec directory holds, as the host read them off disk. */
export type SpecFiles = {
  /** The candidate that held them, as the caller ranked it. */
  directory: string;
  metadata: string;
  index?: string;
};

/**
 * Reads a spec out of a checkout. The host walks the ranked candidates and answers the first that
 * holds a spec, so one read covers the whole guess rather than one call per candidate.
 */
export type TimetrackSpecSource = {
  read$(options: { repoPath: string; directories: readonly string[] }): Observable<SpecFiles | null>;
};

/**
 * The reporter extension this build ships, so an editor can be given it without a checkout.
 *
 * `vsix$` answers `null` when the bundle holds none, which is what a build that skipped the staging
 * step produces. That is a state to report, not a failure.
 */
export type TimetrackReporterBundle = {
  vsix$(): Observable<string | null>;
};

export type TimetrackPorts = {
  transport: TimetrackTransport;
  secrets: TimetrackSecretStore;
  events: TimetrackEventStore;
  ledger: TimetrackLedgerStore;
  coverage: TimetrackCoverageStore;
  review: TimetrackReviewStore;
  settings: TimetrackSettingsStore;
  timers: TimetrackTimerStore;
  processes: TimetrackProcessRunner;
  specs: TimetrackSpecSource;
  reporter: TimetrackReporterBundle;
};
