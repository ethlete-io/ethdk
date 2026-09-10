import { InjectionToken, inject } from '@angular/core';
import { AgentSessionLogReader, TimetrackPorts } from '@ethlete/timetrack';
import { createTauriAgentSessionLogReader } from './agent-session-log-reader';
import { TauriCallSource, createTauriCallSource } from './call-source';
import { TauriCollectionPause, createTauriCollectionPause } from './collection-pause';
import { createTauriCoverageStore } from './coverage-store';
import { TauriEventStore, createTauriEventStore } from './event-store';
import { TauriGitSource, createTauriGitSource } from './git-source';
import { TauriIngestSource, createTauriIngestSource } from './ingest-source';
import { createTauriLedgerStore } from './ledger-store';
import { TauriNudge, createTauriNudge } from './nudge';
import { TauriOAuth, createTauriOAuth } from './oauth';
import { createTauriProcessRunner } from './process-runner';
import { createTauriReporterBundle } from './reporter-bundle';
import { createTauriReviewStore } from './review-store';
import { createTauriSecretStore } from './secrets';
import { createTauriSettingsStore } from './settings-store';
import { createTauriTimerStore } from './timer-store';
import { createTauriTransport } from './transport';
import { TauriTray, createTauriTray } from './tray';
import { TauriWidget, createTauriWidget } from './widget';
import { TauriWindowControls, createTauriWindowControls } from './window-controls';
import { TauriWindowLock, createTauriWindowLock } from './window-lock';
import { TauriWindowSource, createTauriWindowSource } from './window-source';

export type HostPorts = TimetrackPorts & {
  calls: TauriCallSource;
  collection: TauriCollectionPause;
  events: TauriEventStore;
  agentLogs: AgentSessionLogReader;
  codexLogs: AgentSessionLogReader;
  git: TauriGitSource;
  ingest: TauriIngestSource;
  nudge: TauriNudge;
  oauth: TauriOAuth;
  tray: TauriTray;
  widget: TauriWidget;
  windows: TauriWindowSource;
  windowControls: TauriWindowControls;
  windowLock: TauriWindowLock;
};

export const createHostPorts = (): HostPorts => ({
  transport: createTauriTransport(),
  secrets: createTauriSecretStore(),
  calls: createTauriCallSource(),
  collection: createTauriCollectionPause(),
  events: createTauriEventStore(),
  ledger: createTauriLedgerStore(),
  coverage: createTauriCoverageStore(),
  review: createTauriReviewStore(),
  settings: createTauriSettingsStore(),
  timers: createTauriTimerStore(),
  processes: createTauriProcessRunner(),
  reporter: createTauriReporterBundle(),
  agentLogs: createTauriAgentSessionLogReader(),
  codexLogs: createTauriAgentSessionLogReader({ provider: 'codex' }),
  git: createTauriGitSource(),
  ingest: createTauriIngestSource(),
  nudge: createTauriNudge(),
  oauth: createTauriOAuth(),
  tray: createTauriTray(),
  widget: createTauriWidget(),
  windows: createTauriWindowSource(),
  windowControls: createTauriWindowControls(),
  windowLock: createTauriWindowLock(),
});

export const HOST_PORTS = new InjectionToken<HostPorts>('HOST_PORTS', {
  providedIn: 'root',
  factory: createHostPorts,
});

export const injectHostPorts = () => inject(HOST_PORTS);
