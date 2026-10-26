import type { Drawing } from './define-call';

export { css, drawing, html, ng } from './define-call';
export type { Drawing } from './define-call';

/**
 * One part of a product's design system. `note` records why the part has its current shape,
 * `states` names each state it is drawn in with the props for that state, and `render` draws it.
 */
export type Part<P> = {
  note: string;
  states: Record<string, P>;
  render: (props: P) => Drawing | Promise<Drawing>;
};

/** Types a part where it is written. A part file default-exports the result. */
export const definePart = <P>(part: Part<P>): Part<P> => part;
