import { InjectionToken, inject } from '@angular/core';
import { AgentSessionLogReader, TimetrackPorts } from '@ethlete/timetrack';
import { createTauriAgentSessionLogReader } from './agent-session-log-reader';
import { TauriEventStore, createTauriEventStore } from './event-store';
import { createTauriLedgerStore } from './ledger-store';
import { createTauriProcessRunner } from './process-runner';
import { createTauriSecretStore } from './secrets';
import { createTauriTransport } from './transport';
import { TauriWindowSource, createTauriWindowSource } from './window-source';

export type HostPorts = TimetrackPorts & {
  events: TauriEventStore;
  agentLogs: AgentSessionLogReader;
  windows: TauriWindowSource;
};

export const createHostPorts = (): HostPorts => ({
  transport: createTauriTransport(),
  secrets: createTauriSecretStore(),
  events: createTauriEventStore(),
  ledger: createTauriLedgerStore(),
  processes: createTauriProcessRunner(),
  agentLogs: createTauriAgentSessionLogReader(),
  windows: createTauriWindowSource(),
});

export const HOST_PORTS = new InjectionToken<HostPorts>('HOST_PORTS', {
  providedIn: 'root',
  factory: createHostPorts,
});

export const injectHostPorts = () => inject(HOST_PORTS);
