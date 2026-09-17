/** The agent session each call runs its conversation in, one per CLI. */
export type SessionTable = Record<string, string>;

const KEY = 'ethlete-studio.sessions';

/** Which conversation a session belongs to: one call, driven by one CLI. */
export const sessionKey = ({ slug, cli }: { slug: string; cli: string }) => `${cli} ${slug}`;

export const storedSessions = (): SessionTable => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    return Object.fromEntries(
      Object.entries(stored as Record<string, unknown>).filter(([, id]) => typeof id === 'string'),
    ) as SessionTable;
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
