import type { Drawing } from './define-call';

export { css, drawing, html, ng } from './define-call';
export type { Drawing } from './define-call';

/** An interaction Studio can force on a part's root element. Rest is always drawn and never listed. */
export type Interaction = 'hover' | 'focus-visible' | 'active' | 'disabled';

/**
 * One part of a product's design system. `note` records why the part has its current shape, and
 * `madeBy` the model ids that drew it, written by a sketch merge.
 * `states` names each state it is drawn in with the props for that state, and `render` draws it.
 * A part that responds to its width lists the container `widths` it is drawn at; without them a
 * component or element is drawn at the size of its content, and a page at every viewport preset.
 * `interactions` lists the interactions each state is also drawn in; without it only rest is drawn.
 */
export type Part<P> = {
  note: string;
  madeBy?: string[];
  states: Record<string, P>;
  widths?: number[];
  interactions?: Interaction[];
  render: (props: P) => Drawing | Promise<Drawing>;
};

/** Types a part where it is written. A part file default-exports the result. */
export const definePart = <P>(part: Part<P>): Part<P> => part;
