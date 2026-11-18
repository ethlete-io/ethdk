import { CollectedEvent } from '../model/event';

/** What proves a person was at the desk during a row: their own input and windows, and prompts they typed. */
export type RowPresence = {
  deskEvents: number;
  humanPrompts: number;
};

/** Counts the presence evidence inside `[from, to]`. A prompt another program typed is not a human one. */
export const rowPresenceOf = (options: { events: readonly CollectedEvent[]; from: Date; to: Date }): RowPresence => {
  const from = options.from.getTime();
  const to = options.to.getTime();
  const presence: RowPresence = { deskEvents: 0, humanPrompts: 0 };

  for (const event of options.events) {
    const at = event.at.getTime();

    if (at < from || at > to) continue;

    if (event.kind === 'agent-prompt') {
      if (event.askedBy !== 'machine') presence.humanPrompts++;
    } else if (event.kind === 'window-focus' || event.kind === 'input-active') {
      presence.deskEvents++;
    }
  }

  return presence;
};
