export const AGENT_API_LOCKED_MESSAGE = 'Timetrack is locked. Unlock it, then ask again.';

/** The refusal a locked app answers every op with, read or write, or `null` while it is unlocked. */
export const agentApiLockRefusal = (options: { locked: boolean }) => (options.locked ? AGENT_API_LOCKED_MESSAGE : null);
