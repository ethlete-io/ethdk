/** One thing that happened in the conversation, in the order it happened. */
export type Turn =
  | { kind: 'ask'; text: string }
  | { kind: 'say'; text: string }
  | { kind: 'act'; action: string; detail: string };

export const TURNS: Turn[] = [
  { kind: 'ask', text: 'Iterate: option "B · A hairline frame and the change" of the call "How a summary tile carries its number".' },
  { kind: 'act', action: 'Read', detail: 'calls/sandbox/00-stat-tile/call.ts' },
  { kind: 'act', action: 'Read', detail: 'calls/sandbox/00-stat-tile/option-b.ts' },
  {
    kind: 'say',
    text: 'The frame stays and the change moves onto the number‘s baseline, so a tile is two lines. I drew D, E and F for the new round.',
  },
  { kind: 'act', action: 'Write', detail: 'calls/sandbox/00-stat-tile/option-d.ts' },
  { kind: 'ask', text: 'D is the one. Draw one more where the change carries no colour at all.' },
  { kind: 'act', action: 'Read', detail: 'calls/sandbox/00-stat-tile/option-d.ts' },
];

/** The action the run is doing right now. A finished run leaves this one out. */
export const LIVE = { action: 'Write', detail: 'calls/sandbox/00-stat-tile/option-g.ts' };

/** What stands in the prompt box, written by a verb and not yet sent. */
export const DRAFT =
  'More like this: option "D · The change joins the number" of the call "How a summary tile carries its number".';

/** The conversation this call continues, and how full it is. */
export const SESSION = { id: 'd7afca82', tokens: 152_000, limit: 200_000 };

export const CLI = 'Claude Code · opus';

/** The call the window is open on, so every option draws the same window. */
export const CALL = {
  project: 'sandbox',
  headline: 'How a summary tile carries its number',
  option: 'D · The change joins the number',
};

export const GROUND = '#14161a';
export const PLATE = '#1b1e24';
export const LINE = '#2b2f36';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8ed2bb';
