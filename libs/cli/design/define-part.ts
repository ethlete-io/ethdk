import { Drawing } from './define-call';
import { forceBody } from './mark-part';

export { css, drawing, html, ng } from './define-call';
export type { Drawing } from './define-call';
export { embedPage } from './embed-page';
export type { EmbedPageOptions } from './embed-page';
export { interactionRows } from './interaction-rows';
export type { InteractionRowsOptions } from './interaction-rows';
export { svgAsset } from './svg-asset';
export type { SvgAssetOptions } from './svg-asset';

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
 * `checks.skip` names the render checks of `design check` the part breaks on purpose, such as
 * `CLIPPED` for a part that cuts its content. To skip a check for one element only, put
 * `data-et-skip="CLIPPED"` on it; the check then ignores that element and everything inside it.
 */
export type Part<TProps, TState extends string = string> = {
  note: string;
  madeBy?: string[];
  states: Record<TState, TProps>;
  styles?: string;
  widths?: number[];
  interactions?: Interaction[];
  grid?: StateGrid<TState>;
  checks?: { skip?: RenderCheck[] };
  render: (props: TProps, options?: RenderOptions) => DrawnPart | Promise<DrawnPart>;
};

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

/** A rule of the render check: content larger than its frame, cut off, wrapped onto a second line, or drawn at zero size. */
export type RenderCheck = 'OVERFLOW' | 'CLIPPED' | 'WRAP' | 'ZERO-SIZE';

/** How a composing part draws another one: `interaction` forces it on the root, as a frame does. */
export type RenderOptions = { interaction?: Interaction };

type PartSource<TProps, TState extends string, TColumn extends string> = Omit<
  Part<TProps, TState>,
  'states' | 'grid' | 'render'
> & {
  states: Record<TState, NoInfer<TProps>>;
  grid?: { columns: readonly TColumn[]; rows: Record<string, Partial<Record<NoInfer<TColumn>, NoInfer<TState>>>> };
  render: (props: TProps) => Drawing | Promise<Drawing>;
};

/**
 * Forces `interaction` on the first element of `markup`, as a frame forces it on a part's root: for a state that
 * shows one element of the part, such as a row of a list, hovered or disabled.
 */
export const forceInteraction = (markup: string, interaction: Interaction) => forceBody(markup, interaction);

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
