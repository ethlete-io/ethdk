import { Drawing } from './define-call';
import { forceBody } from './mark-part';

export { css, drawing, html, ng } from './define-call';
export type { Drawing } from './define-call';
export { embedPage } from './embed-page';
export type { EmbedPageOptions } from './embed-page';
export { svgAsset } from './svg-asset';
export type { SvgAssetOptions } from './svg-asset';

/** An interaction Studio can force on a part's root element. Rest is always drawn and never listed. */
export type Interaction = 'hover' | 'focus-visible' | 'active' | 'disabled';

/**
 * One part of a product's design system. `note` records why the part has its current shape, and
 * `madeBy` the model ids that drew it, written by a sketch merge.
 * `states` names each state it is drawn in with the props for that state, and `render` draws it.
 * A part that responds to its width lists the container `widths` it is drawn at; without them a
 * component or element is drawn at the size of its content, and a page at every viewport preset.
 * `interactions` lists the interactions each state is also drawn in; without it only rest is drawn.
 * `checks.skip` names the render checks of `design check` the part breaks on purpose, such as
 * `CLIPPED` for a part that cuts its content. To skip a check for one element only, put
 * `data-et-skip="CLIPPED"` on it; the check then ignores that element and everything inside it.
 */
export type Part<TProps, TState extends string = string> = {
  note: string;
  madeBy?: string[];
  states: Record<TState, TProps>;
  widths?: number[];
  interactions?: Interaction[];
  checks?: { skip?: RenderCheck[] };
  render: (props: TProps, options?: RenderOptions) => Drawing | Promise<Drawing>;
};

/** A rule of the render check: content larger than its frame, cut off, wrapped onto a second line, or drawn at zero size. */
export type RenderCheck = 'OVERFLOW' | 'CLIPPED' | 'WRAP' | 'ZERO-SIZE';

/** How a composing part draws another one: `interaction` forces it on the root, as a frame does. */
export type RenderOptions = { interaction?: Interaction };

type PartSource<TProps, TState extends string> = Omit<Part<TProps, TState>, 'states' | 'render'> & {
  states: Record<TState, NoInfer<TProps>>;
  render: (props: TProps) => Drawing | Promise<Drawing>;
};

const forced = (drawn: Drawing, interaction: Interaction): Drawing => ({
  ...drawn,
  body: forceBody(drawn.body, interaction),
});

/**
 * Types a part where it is written. A part file default-exports the result, and may export named
 * helpers next to it that other parts import from `@system/<layer>/<name>`. Without type
 * arguments, `TProps` comes from the props `render` takes and the state names stay in the type, so
 * `part.states['open']` is `TProps` and an unknown name does not compile.
 */
export const definePart = <TProps, const TState extends string = string>(
  part: PartSource<TProps, TState>,
): Part<TProps, TState> => ({
  ...part,
  render: (props, options) => {
    const drawn = part.render(props);
    const interaction = options?.interaction;

    if (!interaction) return drawn;

    return drawn instanceof Promise ? drawn.then((done) => forced(done, interaction)) : forced(drawn, interaction);
  },
});
