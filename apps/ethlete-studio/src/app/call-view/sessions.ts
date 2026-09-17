/** One agent conversation: the session to continue, and how much it reads now. */
export type StoredSession = {
  id: string;
  /** The tokens the last turn read. `0` until a run reports it. */
  tokens: number;
};

/** The agent session each call runs its conversation in, one per CLI. */
export type SessionTable = Record<string, StoredSession>;

const KEY = 'ethlete-studio.sessions';

/**
 * The context a session may read before the next turn costs the long-context rate. Every CLI Studio
 * drives charges that rate past the same number.
 */
export const CONTEXT_LIMIT = 200_000;

/** A session this full hands over: one more turn of real work would cross `CONTEXT_LIMIT`. */
export const HANDOFF_AT = 0.7;

/** Which conversation a session belongs to: one call, driven by one CLI. */
export const sessionKey = ({ slug, cli }: { slug: string; cli: string }) => `${cli} ${slug}`;

/** How full a session is, as a part of one. A session over `HANDOFF_AT` has to hand over. */
export const fullness = (session: StoredSession | null) => (session ? session.tokens / CONTEXT_LIMIT : 0);

const read = (value: unknown): StoredSession | null => {
  if (typeof value === 'string') return { id: value, tokens: 0 };
  if (!value || typeof value !== 'object') return null;

  const { id, tokens } = value as Partial<StoredSession>;

  if (typeof id !== 'string') return null;

  return { id, tokens: typeof tokens === 'number' ? tokens : 0 };
};

export const storedSessions = (): SessionTable => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    return Object.fromEntries(
      Object.entries(stored as Record<string, unknown>)
        .map(([key, value]) => [key, read(value)] as const)
        .filter((entry): entry is readonly [string, StoredSession] => entry[1] !== null),
    );
  } catch {
    return {};
  }
};

export const writeSessions = (table: SessionTable) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(table));
  } catch {
    // A window without storage starts every run as a new conversation.
  }
};
