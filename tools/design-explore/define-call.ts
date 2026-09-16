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
  load: () => Promise<{ default: Type<unknown> }>;
};

/**
 * One open question of an exploration, with every option drawn at the same geometry.
 * A call with one option and no claim is a view: one reference picture, drawn full width.
 */
export type Call = {
  eyebrow: string;
  headline: string;
  intro: string;
  /** The width every option frame gets, in px. The geometry the thing ships in. */
  frameWidth: number;
  options: CallOption[];
};

export const defineCall = (call: Call): Call => call;
