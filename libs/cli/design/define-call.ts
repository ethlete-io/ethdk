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

/** A form field `ng()` builds: its value, the errors it shows (a kind, or a kind and a message), and whether it is touched. */
export type NgField = { value: unknown; errors?: (string | { kind: string; message?: string })[]; touched?: boolean };

/**
 * `imports` names exports of `@ethlete/components` (or of the config's `render.modules`). Each
 * entry of `fields` becomes a signal form field the template binds as `[formField]="fields.<name>"`.
 */
export type NgOptions = { imports?: string[]; fields?: Record<string, NgField> };

const render = async (template: string, options: NgOptions) => {
  const response = await fetch('/__design/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      call: new URLSearchParams(location.search).get('call') ?? '',
      template,
      imports: options.imports ?? [],
      fields: options.fields,
    }),
  });

  if (!response.ok) throw new Error(await response.text());

  return (await response.json()) as { markup: string; styles: string[] };
};

/**
 * Renders an Angular template with the real components on the design server and resolves with its
 * markup, led by the component styles this frame has not received yet. Rejects with the render error.
 */
export const ng = async (template: string, options: NgOptions = {}) => {
  const { markup, styles } = await render(template, options);

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
export const ngStates = async <S extends string>(templates: Record<S, string>, options: NgOptions = {}) => {
  const names = Object.keys(templates) as S[];
  const rendered = await Promise.all(names.map((name) => render(templates[name], options)));
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
 * that styles it. `setup` is a function or a list of them, run in order once after the markup is in the frame root, to wire behavior such
 * as a click that restarts an animation. A `<script>` in `body` never runs.
 */
export type Drawing = {
  body: string;
  styles: string;
  setup?: ((root: HTMLElement) => void) | ((root: HTMLElement) => void)[];
};

/** Puts a drawing's markup in `root`, then runs its `setup`. Returns the setup error, or `null`. */
export const mountDrawing = (root: HTMLElement, drawn: Drawing): unknown => {
  root.innerHTML = drawn.body;

  try {
    for (const setup of [drawn.setup ?? []].flat()) {
      setup(root);
    }

    return null;
  } catch (error: unknown) {
    return error;
  }
};

const OVERLAY_GAP = 4;

const ancestorsOf = (pane: Element, root: HTMLElement) => {
  const ancestors: Element[] = [];

  for (let element = pane.parentElement; element && element !== root; element = element.parentElement) {
    ancestors.push(element);

    if (element.classList.contains('et-overlay-runtime-root')) break;
  }

  return ancestors;
};

const placementOf = (trigger: Element) =>
  trigger.closest('[data-overlay-placement]')?.getAttribute('data-overlay-placement') ??
  trigger.closest('[etoverlay]')?.getAttribute('placement') ??
  'bottom';

const triggerOf = (pane: Element, root: HTMLElement) => {
  const outside = [...root.querySelectorAll('[aria-controls], [aria-expanded="true"]')].filter(
    (element) => !element.closest('.et-overlay-runtime-root'),
  );
  const ids = new Set(
    [pane, ...pane.querySelectorAll('[id]'), ...ancestorsOf(pane, root)].map((element) => element.id).filter(Boolean),
  );
  const controlling = outside.find((element) => {
    const id = element.getAttribute('aria-controls');

    return id ? ids.has(id) : false;
  });

  return (
    controlling ??
    outside
      .filter(
        (element) =>
          element.getAttribute('aria-expanded') === 'true' &&
          element.compareDocumentPosition(pane) & Node.DOCUMENT_POSITION_FOLLOWING,
      )
      .pop() ??
    null
  );
};

const pinToBottom = (pane: HTMLElement) => {
  Object.assign(pane.style, { top: 'auto', bottom: '0px', left: '0px', right: '0px', width: 'auto', minWidth: '' });
};

/**
 * Places every open overlay a server render attached next to the element that opened it (the
 * control frame of its form field, if it has one): below its start, or its end for an `*-end`
 * placement, and above it for a `top*` placement. A bottom sheet is pinned to the bottom, full
 * width. A drawing of an open select, menu or sheet needs no position code. Safe to run again.
 */
export const placeOverlays = (root: HTMLElement) => {
  for (const layer of root.querySelectorAll<HTMLElement>('.et-overlay-runtime-root, .et-overlay-runtime-entry')) {
    layer.style.position = 'absolute';
  }

  for (const pane of root.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')) {
    if (pane.classList.contains('et-overlay--bottom-sheet')) {
      pinToBottom(pane);
      continue;
    }

    const trigger = triggerOf(pane, root);
    const container = pane.parentElement;

    if (!trigger || !container) continue;

    const anchor = (trigger.closest('.et-form-field-control-frame') ?? trigger).getBoundingClientRect();
    const origin = container.getBoundingClientRect();
    const [side, alignment] = placementOf(trigger).split('-');
    const above = side === 'top';
    const atEnd = alignment === 'end';

    Object.assign(pane.style, {
      top: above ? 'auto' : `${anchor.bottom - origin.top + OVERLAY_GAP}px`,
      bottom: above ? `${origin.bottom - anchor.top + OVERLAY_GAP}px` : '',
      left: atEnd ? 'auto' : `${anchor.left - origin.left}px`,
      right: atEnd ? `${origin.right - anchor.right}px` : '',
      minWidth: `${anchor.width}px`,
    });
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
 * Where a call sits in the design order: foundations (`themes`), corporate identity, the
 * wireframes, then the parts of the design system, the pages built from them, and a prototype.
 * A `sketch` is a quick exploration of an idea outside that order.
 */
export type CallStage = 'themes' | 'ci' | 'wireframe' | 'component' | 'element' | 'page' | 'prototype' | 'sketch';

/** A part the wireframes need: the SDK component that covers it, or a new part and the component call that draws it. */
export type InventoryPart = { part: string } & ({ sdk: string } | { new: true; call?: string });

/**
 * One open question of an exploration, with every variant drawn at the same geometry.
 * A call with one variant and no claim is a view: one reference picture, drawn full width.
 */
export type Call = {
  /** The feature this call belongs to, for example 'the hour strip'. Left out by a loose call. */
  feature?: string;
  /** Required, except on a legacy call. */
  stage?: CallStage;
  /** Set by `et design legacy` on a call made before the stage was required. Such a call needs no stage. */
  legacy?: true;
  eyebrow: string;
  headline: string;
  intro: string;
  /** The width every variant frame gets, in px. The geometry the thing ships in. */
  frameWidth: number;
  /** Left out by a call that draws the real thing, which is what `design` means. */
  mode?: CallMode;
  /** Left out by a short call. With rounds, the intro says only what the call is about. */
  rounds?: CallRound[];
  /** Set by a wireframe call only. The parts its wireframes need, in the order the component calls take them. */
  inventory?: InventoryPart[];
  variants: CallVariant[];
};

export const defineCall = (call: Call): Call => call;
