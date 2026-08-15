import { InjectionToken, inject } from '@angular/core';
import { AgentSessionLogReader, TimetrackPorts } from '@ethlete/timetrack';
import { createTauriAgentSessionLogReader } from './agent-session-log-reader';
import { TauriCollectionPause, createTauriCollectionPause } from './collection-pause';
import { TauriEventStore, createTauriEventStore } from './event-store';
import { TauriGitSource, createTauriGitSource } from './git-source';
import { createTauriLedgerStore } from './ledger-store';
import { TauriOAuth, createTauriOAuth } from './oauth';
import { createTauriProcessRunner } from './process-runner';
import { createTauriReviewStore } from './review-store';
import { createTauriSecretStore } from './secrets';
import { createTauriSettingsStore } from './settings-store';
import { createTauriTimerStore } from './timer-store';
import { createTauriTransport } from './transport';
import { TauriTray, createTauriTray } from './tray';
import { TauriWindowControls, createTauriWindowControls } from './window-controls';
import { TauriWindowSource, createTauriWindowSource } from './window-source';

export type HostPorts = TimetrackPorts & {
  collection: TauriCollectionPause;
  events: TauriEventStore;
  agentLogs: AgentSessionLogReader;
  git: TauriGitSource;
  oauth: TauriOAuth;
  tray: TauriTray;
  windows: TauriWindowSource;
  windowControls: TauriWindowControls;
};

export const createHostPorts = (): HostPorts => ({
  transport: createTauriTransport(),
  secrets: createTauriSecretStore(),
  collection: createTauriCollectionPause(),
  events: createTauriEventStore(),
  ledger: createTauriLedgerStore(),
  review: createTauriReviewStore(),
  settings: createTauriSettingsStore(),
  timers: createTauriTimerStore(),
  processes: createTauriProcessRunner(),
  agentLogs: createTauriAgentSessionLogReader(),
  git: createTauriGitSource(),
  oauth: createTauriOAuth(),
  tray: createTauriTray(),
  windows: createTauriWindowSource(),
  windowControls: createTauriWindowControls(),
});

export const HOST_PORTS = new InjectionToken<HostPorts>('HOST_PORTS', {
  providedIn: 'root',
  factory: createHostPorts,
});

export const injectHostPorts = () => inject(HOST_PORTS);
