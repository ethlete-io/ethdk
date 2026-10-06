import { QueryDevtoolsEntry } from '@ethlete/query/devtools-contract';
import { AnyQuery, EventLogItem } from './query-devtools-types';

const requestOf = (entry: QueryDevtoolsEntry) => (entry.handle as AnyQuery).subtle.request();

/** A tombstone holds a copy of its request, not the request, so only the url can match it. */
export const resolveQueryDevtoolsEventOwner = (entries: QueryDevtoolsEntry[], event: EventLogItem) => {
  if (!event.url) return null;

  const request = event.request?.deref();
  const live = entries.filter((e) => !e.destroyedAt);
  const owner =
    (request && live.find((e) => requestOf(e) === request)) ?? live.find((e) => requestOf(e)?.url === event.url);

  if (owner) return owner.id;

  let nearest: QueryDevtoolsEntry | null = null;

  for (const entry of entries) {
    if (!entry.destroyedAt || requestOf(entry)?.url !== event.url) continue;

    const distance = Math.abs(entry.destroyedAt - event.timestamp);

    if (!nearest || distance < Math.abs((nearest.destroyedAt ?? 0) - event.timestamp)) nearest = entry;
  }

  return nearest?.id ?? null;
};
