/** One turn in the conversation about the open call. */
export type ChatTurn = {
  who: 'agent' | 'you';
  /** What the turn said. */
  text: string;
  at: string;
  /** The verb that started this turn, if a verb did. */
  verb?: string;
};

/** One drawn option of the open call, as the chat names it. */
export type ChatVariant = {
  key: string;
  name: string;
  verdict: '' | 'chosen' | 'rejected';
  round: string;
  current?: boolean;
};

/** The data every option of this call draws. An option may read it and may not change it. */
export const chat = {
  call: {
    eyebrow: 'Fifagg · call 16',
    headline: 'How does the row carry a 72-character competition name?',
    round: 'Round 2 · Somebody else gives way',
  },
  agent: 'Claude Code 1.1.276',
  variants: [
    { key: 'c', name: 'C · One line, the control names the page', verdict: 'chosen', round: 'r1' },
    { key: 'd', name: 'D · The stage name truncates, the round does not', verdict: '', round: 'r2' },
    { key: 'e', name: 'E · Two lines, the stage below', verdict: '', round: 'r2', current: true },
    { key: 'f', name: 'F · The name wraps, the chip moves under it', verdict: '', round: 'r2' },
  ] as ChatVariant[],
  turns: [
    {
      who: 'agent',
      at: '11:04',
      text: 'Round 1 is settled on C. The control names the page, so the row only has to carry the stage. Round 2 asks what the row does when the name runs to 72 characters, and I drew three answers: D, E and F.',
    },
    {
      who: 'you',
      at: '11:09',
      verb: 'Iterate',
      text: 'E, but the stage line is too quiet. It reads like a caption, not like the second half of the name.',
    },
    {
      who: 'agent',
      at: '11:10',
      text: 'Understood. I will redraw E with the stage line at the same weight as the name and only the colour separating them, and keep D and F as they are.',
    },
  ] as ChatTurn[],
  verbs: ['Accept', 'Iterate', 'Reject', 'More like this', 'Open again'],
  /** What the last verb press put in the input, waiting to be edited and sent. */
  draft: 'Reject E. ',
  placeholder: 'Say what you want changed',
};
