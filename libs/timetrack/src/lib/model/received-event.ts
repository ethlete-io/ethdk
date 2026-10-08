import { CollectedEvent } from './event';

/** An event a paired machine collected and this machine pulled. It stays apart from this machine's own (ADR 0039). */
export type ReceivedEvent = {
  machineId: string;
  /** The name the machine was paired under. */
  machineName: string;
  event: CollectedEvent;
};
