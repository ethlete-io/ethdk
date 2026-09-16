import type { Type } from '@angular/core';

/**
 * One drawn answer to a call. `load` resolves the module whose default export is the
 * Angular component that draws it, so a broken option breaks its own frame only.
 */
export type CallOption = {
  key: string;
  name: string;
  claim: string;
  cost: string;
  /** Left out while the call is open. The user sets it, never the drawing. */
  verdict?: 'chosen' | 'rejected';
  load: () => Promise<{ default: Type<unknown> }>;
};

/** One open question of an exploration, with every option drawn at the same geometry. */
export type Call = {
  eyebrow: string;
  headline: string;
  intro: string;
  /** The width every option frame gets, in px. The geometry the thing ships in. */
  frameWidth: number;
  /** What the user decided, and why. Written after the call is settled. */
  result?: string;
  options: CallOption[];
};

export const defineCall = (call: Call): Call => call;
