/**
 * A value inside a template. An array joins with nothing between, and `null`, `undefined` and
 * `false` write nothing, so `${rows.map(row)}` and `${isOn && html`…`}` both read as they look.
 */
const flatten = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (value === null || value === undefined || value === false) return '';

  return String(value);
};

const join = (strings: TemplateStringsArray, values: unknown[]) =>
  strings.reduce((out, part, index) => out + flatten(values[index - 1]) + part);

/**
 * Marks a template literal as HTML, so Prettier formats it and an editor highlights it. It escapes
 * nothing: a drawing writes its own markup, and nothing a call draws comes from outside the
 * repository.
 */
export const html = (strings: TemplateStringsArray, ...values: unknown[]) => join(strings, values);

/** Marks a template literal as CSS, for the same reason `html` does it for markup. */
export const css = (strings: TemplateStringsArray, ...values: unknown[]) => join(strings, values);

/**
 * One drawn answer, as the frame renders it: the markup that goes in the frame root, and the CSS
 * that styles it. A drawing runs no logic, so it is a value the module builds when the frame
 * imports it, not a component the frame has to instantiate.
 */
export type Drawing = {
  body: string;
  styles: string;
};

/** Types a drawing where it is written, so a mistake reads in its own file and not in `call.ts`. */
export const drawing = (drawn: Drawing): Drawing => drawn;

/**
 * One drawn answer to a call. `load` resolves the module whose default export is the
 * drawing that answers it, so a broken variant breaks its own frame only.
 */
export type CallVariant = {
  key: string;
  name: string;
  /** Left out by a view: a single drawing answers no question, so it argues nothing. */
  claim?: string;
  cost?: string;
  /** Left out while the call is open. The user sets it, never the drawing. */
  verdict?: 'chosen' | 'rejected';
  /** The `key` of the round that drew it. Left out by a call that runs no rounds. */
  round?: string;
  load: () => Promise<{ default: Drawing }>;
};

/**
 * One pass over a call: the variants drawn together, and what came out of them. A round
 * whose variants all carry a verdict is settled, and the page folds it down to its winner.
 */
export type CallRound = {
  key: string;
  /** What this pass asked, in a few words. */
  title: string;
  /** What it answered. Write it once the user has ruled, so the next round reads as a reply. */
  note: string;
};

/**
 * How a call is drawn. A wireframe shows the bare workflow with mocked values, and draws no
 * logic and no interaction state. A design call draws the real thing.
 */
export type CallMode = 'wireframe' | 'design';

/**
 * One open question of an exploration, with every variant drawn at the same geometry.
 * A call with one variant and no claim is a view: one reference picture, drawn full width.
 */
export type Call = {
  /** The feature this call belongs to, for example 'the hour strip'. Left out by a loose call. */
  feature?: string;
  eyebrow: string;
  headline: string;
  intro: string;
  /** The width every variant frame gets, in px. The geometry the thing ships in. */
  frameWidth: number;
  /** Left out by a call that draws the real thing, which is what `design` means. */
  mode?: CallMode;
  /** Left out by a short call. With rounds, the intro says only what the call is about. */
  rounds?: CallRound[];
  variants: CallVariant[];
};

export const defineCall = (call: Call): Call => call;
