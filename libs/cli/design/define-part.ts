import { Drawing } from './define-call';
import { forceBody } from './mark-part';

export { contrastRatioOf } from './contrast';
export { css, drawing, html, ng } from './define-call';
export type { Drawing } from './define-call';
export { embedPage } from './embed-page';
export type { EmbedPageOptions } from './embed-page';
export { iconSheet } from './icon-sheet';
export type { IconSheetIcon, IconSheetOptions } from './icon-sheet';
export { interactionRows } from './interaction-rows';
export type { InteractionRowsOptions } from './interaction-rows';
export { logoSheet } from './logo-sheet';
export type { LogoSheetMark, LogoSheetOptions } from './logo-sheet';
export { spring } from './spring';
export type { Spring } from './spring';
export { svgAsset } from './svg-asset';
export type { SvgAssetOptions } from './svg-asset';
export { tokenSheet } from './token-sheet';
export type { TokenSheetOptions } from './token-sheet';

/** An interaction Studio can force on a part's root element. Rest is always drawn and never listed. */
export type Interaction = 'hover' | 'focus-visible' | 'active' | 'disabled';

/**
 * One part of a product's design system. `note` records why the part has its current shape, and
 * `madeBy` the model ids that drew it, written by a sketch merge.
 * `states` names each state it is drawn in with the props for that state, and `render` draws it.
 * `styles` is the part's stylesheet: every drawing of the part gets it before the styles `render` returns, and a
 * host that embeds a piece of the part's markup takes it from the default export.
 * A part that responds to its width lists the container `widths` it is drawn at; without them a
 * component or element is drawn at the size of its content, and a page at every viewport preset.
 * `interactions` lists the interactions each state is also drawn in; without it only rest is drawn.
 * `grid` draws the states it names as one table in rest, see `StateGrid`.
 * `controls` names each control the part draws, keyed by the id its markup carries in `data-et-control`; `design
 * complete` requires the states and surfaces its `kind` and `input` need, see `Control`.
 * `motions` names each motion between two of its states, see `Motion`; a rule in `rules` can name one.
 * `unreachable` lists the state pairs no user can move between, each with its `reason`; they need no motion.
 * `omits` records mock option values deliberately left off the grid, each with a reason.
 * `checks.skip` names the render checks of `design check` the part breaks on purpose, such as
 * `CLIPPED` for a part that cuts its content. To skip a check for one element only, put
 * `data-et-skip="CLIPPED"` on it; the check then ignores that element and everything inside it.
 * `contrast` feeds the contrast check of `design check`, see `PartContrast`.
 * `implements` links the part to the code that builds it, see `PartLink`.
 */
export type Part<TProps, TState extends string = string> = {
  note: string;
  madeBy?: string[];
  states: Record<TState, TProps>;
  styles?: string;
  widths?: number[];
  interactions?: Interaction[];
  grid?: StateGrid<TState>;
  controls?: Record<string, Control<TState>>;
  checks?: { skip?: RenderCheck[] };
  contrast?: PartContrast;
  motions?: Record<string, Motion<TState>>;
  unreachable?: { from: TState; to: TState; reason: string }[];
  omits?: { option: keyof TProps & string; value: string; reason: string }[];
  rules?: PartRule<TState>[];
  implements?: PartLink;
  render: (props: TProps, options?: RenderOptions) => DrawnPart | Promise<DrawnPart>;
};

/**
 * The code a part is built in: a component or element names the repo-relative path of its `.component.ts`, a page
 * names its route and, for `design compare`, the presentational `component` it renders. `design check` fails on a
 * path that does not exist, and lists a part without a link as open.
 */
export type PartLink = `${string}.component.ts` | { route: `/${string}`; component?: `${string}.component.ts` };

/** What `play` of a motion may use, so Studio controls time: `at` schedules `fn` at `ms` into the motion on the tool's clock, `random` is seeded, `rect` measures a selector in the `from` state. */
export type MotionContext = {
  at: (ms: number, fn: () => void) => void;
  random: () => number;
  rect: (selector: string) => DOMRect;
};

/**
 * A motion from the state `from` to the state `to`; with `from` equal to `to` it is the looping motion inside that state. `at` adds shot times in ms, `interrupt` starts the reverse motion
 * at that time, `viewTransition` uses a View Transition, and `play` runs after the morph for what CSS cannot express.
 */
export type Motion<TState extends string = string> = {
  from: TState;
  to: TState;
  at?: number[];
  interrupt?: number;
  viewTransition?: boolean;
  play?: (ctx: MotionContext) => void;
};

/** A rule of a part: `on` an event on a selector, the part switches `to` a state, with the `motion` it names. */
export type PartRule<TState extends string = string> = { on: string; to: TState; motion?: string };

/** A drawing of a part: its `styles` hold the part's stylesheet and the ones `render` returned, so a host can add them up. */
export type DrawnPart = Drawing & { styles: string };

/**
 * Small states laid out as one table instead of a frame each: `rows` maps a row label to the state drawn under
 * each of the `columns`, and a missing column leaves its cell empty. States it leaves out are drawn as before.
 */
export type StateGrid<TState extends string = string, TColumn extends string = string> = {
  columns: readonly TColumn[];
  rows: Record<string, Partial<Record<TColumn, TState>>>;
};

/** How a control is operated: `pointer` requires a drawn hover and active (a `field` needs no active), `keyboard` a drawn focus-visible. */
export type ControlInput = 'pointer' | 'keyboard';

/** A component or element part that draws a control and its interactions. */
export type ControlPart = `components/${string}` | `elements/${string}`;

/**
 * What a control of each `kind` needs besides the interactions of its `input`. A surface is the element marked
 * `data-et-surface="<id>.<surface>"`, drawn visible and filled in the state its `surfaces` entry names.
 * - `disclosure`: a state that draws it collapsed, and `surfaces.body`.
 * - `button`: `active`.
 * - `field`: a text field (`<input>` or `<textarea>`); nothing beyond its inputs.
 * - `select`, `menu`: `surfaces.open`, and options in it (`role="option"`, `role="menuitem"` or `data-et-option`)
 *   drawn hovered, focus-visible, and selected with a look of their own.
 * - `row`: drawn selected (`aria-selected`, `aria-checked`, `aria-pressed` or `aria-current`) with a look of its own,
 *   and hovered while selected.
 * - `tooltip`: `surfaces.tooltip`, the visible tooltip next to the control in this part.
 *
 * `disabled: true` also requires a state that draws it disabled with a look of its own. With `part`, the
 * interactions, selected and disabled looks and option states come from that part, which must be design complete
 * itself; the surfaces stay with this part. A page control needs `part`. With `input`, a state of this part draws
 * each requirement, e.g. with `forceInteraction`.
 */
export type Control<TState extends string = string> = (
  | { kind: 'disclosure'; surfaces: { body: TState } }
  | { kind: 'button' | 'row' | 'field'; surfaces?: never }
  | { kind: 'select' | 'menu'; surfaces: { open: TState } }
  | { kind: 'tooltip'; surfaces: { tooltip: TState } }
) & { disabled?: boolean } & ({ part: ControlPart; input?: never } | { input: ControlInput[]; part?: never });

/** A rule of the render check: content larger than its frame, cut off, wrapped onto a second line, or drawn at zero size. */
export type RenderCheck = 'OVERFLOW' | 'CLIPPED' | 'WRAP' | 'ZERO-SIZE';

/**
 * The contrast check measures every text of every state against its drawn background, to WCAG 2 AA: 4.5:1, or
 * 3:1 for large text; disabled text is exempt. `pairs` names token pairs it also computes, each `text` token on
 * each `on` token of an entry, for example `{ text: ['--text', '--text-muted'], on: ['--surface'] }`.
 * `exceptions` exempts the text inside each `selector`, with the `reason` it may stay below the limit.
 */
export type PartContrast = {
  pairs?: { text: string[]; on: string[] }[];
  exceptions?: { selector: string; reason: string }[];
};

/** How a composing part draws another one: `interaction` forces it on the root, as a frame does. */
export type RenderOptions = { interaction?: Interaction };

type PartSource<TProps, TState extends string, TColumn extends string> = Omit<
  Part<TProps, TState>,
  'states' | 'grid' | 'controls' | 'motions' | 'rules' | 'render'
> & {
  motions?: Record<string, Motion<NoInfer<TState>>>;
  rules?: PartRule<NoInfer<TState>>[];
  states: Record<TState, NoInfer<TProps>>;
  controls?: Record<string, Control<NoInfer<TState>>>;
  grid?: { columns: readonly TColumn[]; rows: Record<string, Partial<Record<NoInfer<TColumn>, NoInfer<TState>>>> };
  render: (props: TProps) => Drawing | Promise<Drawing>;
};

/**
 * Forces `interaction` on the first element of `markup`, as a frame forces it on a part's root: for a state that
 * shows one element of the part, such as a row of a list, hovered or disabled.
 */
export const forceInteraction = (markup: string, interaction: Interaction) => forceBody(markup, interaction);

/**
 * The attribute that marks an element as the region `name` whose content the implementing component projects with
 * `<ng-content>`, e.g. `<main ${slot('canvas')}>`. `design compare` empties it in the design picture, as the harness
 * projects nothing.
 */
export const slot = (name: string) => `data-et-projected="${name}"`;

const finished = (
  drawn: Drawing,
  { styles, interaction }: { styles?: string; interaction?: Interaction },
): DrawnPart => ({
  ...drawn,
  body: interaction ? forceBody(drawn.body, interaction) : drawn.body,
  styles: [styles, drawn.styles].filter(Boolean).join('\n'),
});

/**
 * Types a part where it is written. A part file default-exports the result, and may export named
 * helpers next to it that other parts import from `@system/<layer>/<name>`. Without type
 * arguments, `TProps` comes from the props `render` takes and the state names stay in the type, so
 * `part.states['open']` is `TProps` and an unknown name does not compile.
 */
export const definePart = <TProps, const TState extends string = string, const TColumn extends string = string>(
  part: PartSource<TProps, TState, TColumn>,
): Part<TProps, TState> => ({
  ...part,
  render: (props, options) => {
    const drawn = part.render(props);
    const interaction = options?.interaction;

    return drawn instanceof Promise
      ? drawn.then((done) => finished(done, { styles: part.styles, interaction }))
      : finished(drawn, { styles: part.styles, interaction });
  },
});
