import { InjectionToken, inject } from '@angular/core';
import { TimetrackPorts } from '@ethlete/timetrack';
import { TauriEventStore, createTauriEventStore } from './event-store';
import { createTauriLedgerStore } from './ledger-store';
import { createTauriProcessRunner } from './process-runner';
import { createTauriSecretStore } from './secrets';
import { createTauriTransport } from './transport';

export type HostPorts = TimetrackPorts & { events: TauriEventStore };

export const createHostPorts = (): HostPorts => ({
  transport: createTauriTransport(),
  secrets: createTauriSecretStore(),
  events: createTauriEventStore(),
  ledger: createTauriLedgerStore(),
  processes: createTauriProcessRunner(),
});

export const HOST_PORTS = new InjectionToken<HostPorts>('HOST_PORTS', {
  providedIn: 'root',
  factory: createHostPorts,
});

export const injectHostPorts = () => inject(HOST_PORTS);
