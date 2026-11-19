import { readFileSync } from 'node:fs';
import { CollectedEvent } from '../src/lib/model/event';
import { ReceivedEvent } from '../src/lib/model/received-event';
import { reviveCollectedEvents } from '../src/lib/model/revive-events';
import { buildBusyDay, syntheticBusyDay } from './busy-day';

type DayDump = {
  day: string;
  events: unknown[];
  received?: { event: unknown; machineId: string; machineName: string }[];
};

const readDump = (path: string) => {
  const dump = JSON.parse(readFileSync(path, 'utf8')) as DayDump;
  const received: ReceivedEvent[] = (dump.received ?? []).map((entry) => ({
    ...entry,
    event: reviveCollectedEvents([entry.event])[0] as CollectedEvent,
  }));

  return { day: dump.day, events: reviveCollectedEvents(dump.events), received: { events: received, repoKeys: {} } };
};

const path = process.argv[2];
const input = path && path !== 'synthetic' ? readDump(path) : syntheticBusyDay();
const runs = Number(process.argv[3] ?? 5);

console.log(`${input.day}: ${input.events.length} own + ${input.received.events.length} received events`);

for (let run = 0; run < runs; run++) {
  const started = performance.now();
  const { review } = buildBusyDay(input);

  console.log(`run ${run}: ${Math.round(performance.now() - started)} ms, ${review.rows.length} review rows`);
}
