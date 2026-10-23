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

const emitted = new Set<string>();

/** The `<style>` tags for the sheets not yet in `seen`, which it then records. */
export const unseenStyles = (styles: string[], seen: Set<string>) => {
  const fresh = [...new Set(styles)].filter((style) => !seen.has(style));

  for (const style of fresh) seen.add(style);

  return fresh.map((style) => `<style>${style}</style>`).join('');
};

const render = async (template: string, imports: string[]) => {
  const response = await fetch('/__design/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ call: new URLSearchParams(location.search).get('call') ?? '', template, imports }),
  });

  if (!response.ok) throw new Error(await response.text());

  return (await response.json()) as { markup: string; styles: string[] };
};

/**
 * Renders an Angular template with the real components on the design server and resolves with its
 * markup, led by the component styles this frame has not received yet. `imports` names exports of
 * `@ethlete/components` (or of the config's `render.modules`). Rejects with the render error.
 */
export const ng = async (template: string, options: { imports?: string[] } = {}) => {
  const { markup, styles } = await render(template, options.imports ?? []);

  return unseenStyles(styles, emitted) + markup;
};

/** A click on an element that matches `click` inside the drawing shows the state `go`. */
export type StateRule<S extends string> = { click: string; go: S };

/**
 * Swaps the content of the drawing's state host for `states[rule.go]` when a click matches a rule.
 * The first matching rule wins. The swap runs in a View Transition where the browser has one.
 */
export const switchStates =
  <S extends string>(states: Record<S, string>, rules: StateRule<S>[]) =>
  (root: HTMLElement) => {
    const host = root.querySelector<HTMLElement>('[data-de-states]');

    if (!host) throw new Error('design-explore: no [data-de-states] host - put the body of ngStates() in the drawing');

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const rule = rules.find((entry) => {
        const matched = target?.closest(entry.click);

        return matched ? root.contains(matched) : false;
      });

      if (!rule) return;

      const swap = () => {
        host.innerHTML = states[rule.go];
        host.dataset['deStates'] = rule.go;
      };

      if (document.startViewTransition) document.startViewTransition(swap);
      else swap();
    });
  };

/**
 * Renders each named template with `ng()` and resolves with a `body` that shows the first state,
 * and `on(rules)`, a `setup` that swaps states on a click. Every state's styles load up front.
 */
export const ngStates = async <S extends string>(
  templates: Record<S, string>,
  options: { imports?: string[] } = {},
) => {
  const names = Object.keys(templates) as S[];
  const rendered = await Promise.all(names.map((name) => render(templates[name], options.imports ?? [])));
  const states = Object.fromEntries(names.map((name, index) => [name, rendered[index]?.markup ?? ''])) as Record<
    S,
    string
  >;
  const first = names[0];

  if (first === undefined) throw new Error('design-explore: ngStates() needs at least one state');

  return {
    body:
      unseenStyles(
        rendered.flatMap((entry) => entry.styles),
        emitted,
      ) + `<div data-de-states="${first}" style="display: contents">${states[first]}</div>`,
    on: (rules: StateRule<S>[]) => switchStates(states, rules),
  };
};

/**
 * One drawn answer, as the frame renders it: the markup that goes in the frame root, and the CSS
 * that styles it. `setup` runs once after the markup is in the frame root, to wire behavior such
 * as a click that restarts an animation. A `<script>` in `body` never runs.
 */
export type Drawing = {
  body: string;
  styles: string;
  setup?: (root: HTMLElement) => void;
};

/** Puts a drawing's markup in `root`, then runs its `setup`. Returns the setup error, or `null`. */
export const mountDrawing = (root: HTMLElement, drawn: Drawing): unknown => {
  root.innerHTML = drawn.body;

  try {
    drawn.setup?.(root);

    return null;
  } catch (error: unknown) {
    return error;
  }
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
 * whose variants all carry a verdict is settled.
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
