/** One line of a conversation: what the user sent, what the agent said, or what it did. */
export type Turn =
  | { kind: 'ask'; text: string }
  | { kind: 'say'; text: string }
  | { kind: 'act'; action: string; detail: string }
  | { kind: 'note'; text: string };

/** One agent conversation: the session to continue, how much it reads now, and what it said. */
export type StoredSession = {
  /** The session to continue. `null` until the CLI reports one. */
  id: string | null;
  /** The tokens the last turn read. `0` until a run reports it. */
  tokens: number;
  /** Every turn of this session, oldest first. */
  turns: Turn[];
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

/** How many turns one conversation keeps. An older turn falls out, so storage stays small. */
export const TURN_LIMIT = 200;

/** Which conversation a session belongs to: one call, driven by one CLI. */
export const sessionKey = ({ slug, cli }: { slug: string; cli: string }) => `${cli} ${slug}`;

/** How full a session is, as a part of one. A session over `HANDOFF_AT` has to hand over. */
export const fullness = (session: StoredSession | null) => (session ? session.tokens / CONTEXT_LIMIT : 0);

/** Adds a turn to a conversation, and drops the oldest one once it passes `TURN_LIMIT`. */
export const withTurn = (session: StoredSession | null, turn: Turn): StoredSession => {
  const open = session ?? { id: null, tokens: 0, turns: [] };

  return { ...open, turns: [...open.turns, turn].slice(-TURN_LIMIT) };
};

const KINDS: Turn['kind'][] = ['ask', 'say', 'act', 'note'];

const isTurn = (value: unknown): value is Turn =>
  !!value && typeof value === 'object' && KINDS.includes((value as Turn).kind);

const read = (value: unknown): StoredSession | null => {
  if (typeof value === 'string') return { id: value, tokens: 0, turns: [] };
  if (!value || typeof value !== 'object') return null;

  const { id, tokens, turns } = value as Partial<StoredSession>;

  if (typeof id !== 'string' && id !== null && id !== undefined) return null;

  return {
    id: id ?? null,
    tokens: typeof tokens === 'number' ? tokens : 0,
    turns: Array.isArray(turns) ? turns.filter(isTurn) : [],
  };
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
