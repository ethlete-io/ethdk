import { CollectedEvent } from './event';
import { CheckoutKeys } from './peer-path';

/** An event a paired machine collected and this machine pulled. It stays apart from this machine's own (ADR 0039). */
export type ReceivedEvent = {
  machineId: string;
  /** The name the machine was paired under. */
  machineName: string;
  event: CollectedEvent;
};

/** The received events of a range, with each paired machine's checkout keys by machine id. */
export type ReceivedRange = {
  events: ReceivedEvent[];
  repoKeys: Readonly<Record<string, CheckoutKeys>>;
};
