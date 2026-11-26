/** One drawn option of the open call, as the workspace lists it. */
export type WorkspaceVariant = {
  key: string;
  name: string;
  verdict: '' | 'chosen' | 'rejected';
  /** The round that drew it. */
  round: string;
  /** True for the variant the reader is looking at. Exactly one is true. */
  current?: boolean;
};

/** The data every option of this call draws. An option may read it and may not change it. */
export const workspace = {
  call: {
    eyebrow: 'Fifagg · call 16',
    headline: 'How does the row carry a 72-character competition name?',
    round: 'Round 2 · Somebody else gives way',
    rounds: ['r1', 'r2'],
    mode: 'design',
    frameWidth: 390,
  },
  variants: [
    { key: 'a', name: 'A · The page, then the stage', verdict: 'rejected', round: 'r1' },
    { key: 'b', name: 'B · The stage, then the pages', verdict: 'rejected', round: 'r1' },
    { key: 'c', name: 'C · One line, the control names the page', verdict: 'chosen', round: 'r1' },
    { key: 'd', name: 'D · The stage name truncates, the round does not', verdict: '', round: 'r2' },
    { key: 'e', name: 'E · Two lines, the stage below', verdict: '', round: 'r2', current: true },
    { key: 'f', name: 'F · The name wraps, the chip moves under it', verdict: '', round: 'r2' },
  ] as WorkspaceVariant[],
  /** What the current variant claims, and what it costs. */
  claim: 'The name takes two lines and the stage sits under it, so nothing is cut at 72 characters.',
  cost: 'A two-line row is 18px taller, so one fewer competition fits above the fold.',
  check: 'check passed',
  address: 'http://localhost:4402/frame?call=fifagg/16-long-name&option=e',
  verbs: ['Accept', 'Iterate', 'Reject', 'More like this', 'Open again'],
  chat: 'Nothing said in this call yet.',
};
