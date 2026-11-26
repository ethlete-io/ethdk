/**
 * The wire format a reporter posts to the local ingest endpoint, and the file it finds the endpoint
 * through. Both sides of the wire read these types: the app that receives a heartbeat and the editor
 * extension that sends one.
 */

/** The path the endpoint answers on. Anything else is a 404, including `/`. */
export const INGEST_PATH = '/ingest';

/**
 * The shape of this contract. A reporter refuses a discovery file it does not understand rather than
 * guessing, because a mismatch means the app is newer than the extension and the fields moved.
 */
export const INGEST_PROTOCOL_VERSION = 1;

/**
 * How a reporter finds the endpoint: the app writes this file, readable only by its owner, and the
 * reporter reads it at startup and again whenever a post is refused.
 *
 * The token is generated at every app start rather than kept, so there is no durable secret to leak
 * and a reporter that keeps posting to a stale port is refused instead of ignored.
 */
export type IngestDiscovery = {
  version: number;
  port: number;
  token: string;
};

/** The one request body the endpoint accepts. */
export type IngestEnvelope = {
  /** Which reporter this is — `vscode`. One reporter is one program on this machine. */
  reporter: string;
  events: IngestRecord[];
};

/**
 * One observation, as a reporter writes it. `atMs` and `kind` are the only fields the app's host
 * reads; everything else is passed through to the core, which is what lets a new kind of reporter
 * arrive without the host changing at all.
 */
export type IngestRecord = {
  atMs: number;
  kind: string;
  [field: string]: unknown;
};

/** A record as the host hands it back, with the reporter it arrived from. */
export type IngestedRecord = {
  reporter: string;
  atMs: number;
  kind: string;
  /** Everything the reporter sent beyond `atMs` and `kind`, uninterpreted. */
  payload: Record<string, unknown>;
};

/** Where a reporter posts, once the discovery file has named the port. */
export const ingestEndpoint = (port: number) => `http://127.0.0.1:${port}${INGEST_PATH}`;

/** The name of the discovery file inside the application's own data directory. */
export const INGEST_DISCOVERY_FILENAME = 'ingest.json';

/**
 * Whether a discovery file can be used. A file from a protocol this reporter does not know, or one
 * missing either half of the address, is refused — posting to a guessed port is how one program ends
 * up talking to another.
 */
export const isUsableDiscovery = (value: unknown): value is IngestDiscovery => {
  const discovery = value as Partial<IngestDiscovery> | null;

  return (
    !!discovery &&
    discovery.version === INGEST_PROTOCOL_VERSION &&
    Number.isInteger(discovery.port) &&
    (discovery.port ?? 0) > 0 &&
    typeof discovery.token === 'string' &&
    discovery.token.length > 0
  );
};
