import { Observable } from 'rxjs';
import { CollectedEvent } from '../model';

export type TimetrackRequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type TimetrackRequest = {
  method: TimetrackRequestMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
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

export type TimetrackSecretStore = {
  read$(key: string): Observable<string | null>;
  write$(key: string, value: string): Observable<void>;
};

export type TimetrackEventStore = {
  eventsBetween$(from: Date, to: Date): Observable<CollectedEvent[]>;
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
  processes: TimetrackProcessRunner;
};
