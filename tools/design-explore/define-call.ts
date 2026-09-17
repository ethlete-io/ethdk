import type { Type } from '@angular/core';

/**
 * One drawn answer to a call. `load` resolves the module whose default export is the
 * Angular component that draws it, so a broken option breaks its own frame only.
 */
export type CallOption = {
  key: string;
  name: string;
  /** Left out by a view: a single drawing answers no question, so it argues nothing. */
  claim?: string;
  cost?: string;
  /** Left out while the call is open. The user sets it, never the drawing. */
  verdict?: 'chosen' | 'rejected';
  /** The `key` of the round that drew it. Left out by a call that runs no rounds. */
  round?: string;
  load: () => Promise<{ default: Type<unknown> }>;
};

/**
 * One pass over a call: the options drawn together, and what came out of them. A round
 * whose options all carry a verdict is settled, and the page folds it down to its winner.
 */
export type CallRound = {
  key: string;
  /** What this pass asked, in a few words. */
  title: string;
  /** What it answered. Write it once the user has ruled, so the next round reads as a reply. */
  note: string;
};

/**
 * One open question of an exploration, with every option drawn at the same geometry.
 * A call with one option and no claim is a view: one reference picture, drawn full width.
 */
export type Call = {
  /** The feature this call belongs to, for example 'the hour strip'. Left out by a loose call. */
  feature?: string;
  eyebrow: string;
  headline: string;
  intro: string;
  /** The width every option frame gets, in px. The geometry the thing ships in. */
  frameWidth: number;
  /** Left out by a short call. With rounds, the intro says only what the call is about. */
  rounds?: CallRound[];
  options: CallOption[];
};

export const defineCall = (call: Call): Call => call;
