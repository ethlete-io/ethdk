import { ComponentFixture } from '@angular/core/testing';
import { query } from '../../testing/driver-core';
import { ScrollbarOrientation } from '../headless';

export type ScrollbarTargetLayout = {
  /** The mirrored container's own size along the mirrored axis - `client{Width,Height}`. */
  viewportSize: number;
  /** The mirrored container's scrollable content along the mirrored axis - `scroll{Width,Height}`. */
  contentSize: number;
};

/**
 * Fakes the one pair of metrics `ScrollbarDirective` reads straight off the target that `fakeLayout`
 * does not cover (`scrollWidth`/`scrollHeight`, not among its metric names). Defined on the element
 * instance rather than the prototype, so there is nothing to restore once the fixture is gone.
 */
export const fakeScrollbarTarget = (
  target: HTMLElement,
  orientation: ScrollbarOrientation,
  { viewportSize, contentSize }: ScrollbarTargetLayout,
) => {
  const [clientProperty, scrollProperty] =
    orientation === 'horizontal'
      ? (['clientWidth', 'scrollWidth'] as const)
      : (['clientHeight', 'scrollHeight'] as const);

  Object.defineProperty(target, clientProperty, { configurable: true, value: viewportSize });
  Object.defineProperty(target, scrollProperty, { configurable: true, value: contentSize });
};

export type ScrollbarThumbDrag = {
  down: (position: { x: number; y: number }) => void;
  move: (position: { x: number; y: number }) => void;
  up: (position: { x: number; y: number }) => void;
  cancel: (position: { x: number; y: number }) => void;
};

/**
 * Drags `thumb` as the pointer sequence `startThumbDrag` listens for: one `pointerId` shared across
 * a `pointerdown` on the thumb and `pointermove`/`pointerup`/`pointercancel` on the document - the
 * shape `dragGestureFrom` requires to track a single gesture at all.
 */
export const dragScrollbarThumb = (thumb: HTMLElement, pointerId = 1): ScrollbarThumbDrag => {
  const dispatch = (target: EventTarget, type: string, position: { x: number; y: number }) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        clientX: position.x,
        clientY: position.y,
        pointerId,
        button: 0,
        bubbles: true,
        cancelable: true,
      }),
    );

  return {
    down: (position) => dispatch(thumb, 'pointerdown', position),
    move: (position) => dispatch(document, 'pointermove', position),
    up: (position) => dispatch(document, 'pointerup', position),
    cancel: (position) => dispatch(document, 'pointercancel', position),
  };
};

/** The scrollbar element and its thumb under `fixture`. */
export const createScrollbarDriver = <T>(fixture: ComponentFixture<T>, selector = 'et-scrollbar') => ({
  fixture,

  scrollbar: () => query<HTMLElement>(fixture, selector),
  thumb: () => query<HTMLElement>(fixture, `${selector} .et-scrollbar-thumb`),

  fakeTarget: fakeScrollbarTarget,
  drag: dragScrollbarThumb,
});
