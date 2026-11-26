import { IngestDiscovery, IngestEnvelope, IngestRecord, ingestEndpoint, isUsableDiscovery } from '@ethlete/timetrack';

/** The name this reporter posts under. It is what the app's Sources view names it by. */
export const REPORTER = 'vscode';

/**
 * How many unsent records are held while the app is not running. Half an hour of heartbeats at the
 * default interval, which covers a restart of the app without ever growing into a log of the day: an
 * editor is not the right place to keep one, and the app refuses anything older anyway.
 */
export const MAX_HELD = 60;

export type PostOutcome = 'accepted' | 'unauthorized' | 'unreachable';

/** What the reporter needs from its host, so the loop itself never touches the file system or a socket. */
export type ReporterPorts = {
  /** The discovery file as parsed JSON, or `null` when it is missing or unreadable. */
  readDiscovery: () => Promise<unknown>;
  post: (options: { endpoint: string; token: string; envelope: IngestEnvelope }) => Promise<PostOutcome>;
};

export type Reporter = {
  /**
   * Offers a record. It is posted with anything still held, and held itself when the post does not
   * land. A `null` record — a window with nothing worth reporting — still flushes what is held.
   */
  report: (record: IngestRecord | null) => Promise<PostOutcome | 'idle'>;
  /** How many records are waiting for an app to come back. */
  held: () => number;
};

/**
 * Posts what the editor observed, and holds what it could not deliver.
 *
 * The discovery file is re-read whenever a post fails rather than once at startup, because the app
 * generates a new port and a new token at every start: a reporter that cached either would go quiet
 * for the rest of the editor's session the first time the app restarted.
 */
export const createReporter = (ports: ReporterPorts): Reporter => {
  const holding: IngestRecord[] = [];
  let discovery: IngestDiscovery | null = null;

  const refresh = async () => {
    const read = await ports.readDiscovery();

    discovery = isUsableDiscovery(read) ? read : null;

    return discovery;
  };

  const send = async (events: IngestRecord[]): Promise<PostOutcome> => {
    const current = discovery ?? (await refresh());

    if (!current) return 'unreachable';

    return ports.post({
      endpoint: ingestEndpoint(current.port),
      token: current.token,
      envelope: { reporter: REPORTER, events },
    });
  };

  const hold = (events: IngestRecord[]) => {
    holding.push(...events);
    holding.splice(0, Math.max(0, holding.length - MAX_HELD));
  };

  return {
    report: async (record) => {
      const events = [...holding, ...(record ? [record] : [])];

      if (!events.length) return 'idle';

      holding.length = 0;

      const outcome = await send(events);

      if (outcome === 'accepted') return outcome;

      // A refused token means the app restarted under this reporter, so the address it was refused at
      // is stale. Dropping it makes the next attempt re-read the file rather than repeat the failure.
      if (outcome === 'unauthorized') discovery = null;

      hold(events);

      return outcome;
    },
    held: () => holding.length,
  };
};
