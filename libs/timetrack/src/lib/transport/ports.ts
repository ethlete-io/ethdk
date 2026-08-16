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

export type ProcessSpec = {
  command: string;
  args: string[];
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
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
};
