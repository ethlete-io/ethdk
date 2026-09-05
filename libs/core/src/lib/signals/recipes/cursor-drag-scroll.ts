import { DOCUMENT, DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, fromEvent, map, merge, of, switchMap, take, takeUntil, tap } from 'rxjs';
import { injectRenderer } from '../../providers';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from '../element';
import { signalElementScrollState } from '../element-scroll-state';
import { MaybeSignal, maybeSignalValue } from '../signal-data-utils';

export type CursorDragScrollDirection = 'horizontal' | 'vertical' | 'both';

export type CursorDragScrollOptions = {
  /** If true, cursor drag scrolling will be enabled. */
  enabled?: Signal<boolean>;

  /** The allowed scroll direction. */
  allowedDirection?: MaybeSignal<CursorDragScrollDirection>;

  /**
   * Whether the element overflows in the allowed direction - there is nothing to drag if it does not.
   *
   * Measured here when it isn't supplied, which means a MutationObserver and a ResizeObserver of its own.
   * Hand it over wherever the caller already knows: a scrollable that tracks its own scroll state was ending
   * up with two observers watching the same element for the same thing, and both of them re-measured
   * `scrollWidth` - a forced layout - on every inline style written anywhere inside it.
   */
  canScroll?: Signal<boolean>;
};

/** The deadzone in pixels after which the cursor drag scroll will take effect. */
const CURSOR_DRAG_SCROLL_DEADZONE = 5;

/** `MouseEvent.button` for the primary button. A secondary click opens a menu; it does not drag. */
const PRIMARY_MOUSE_BUTTON = 0;

/** The class that is added to the element when the cursor is being dragged. */
const CURSOR_DRAG_SCROLLING_CLASS = 'et-cursor-drag-scroll--scrolling';
const CURSOR_DRAG_INIT_CLASS = 'et-cursor-drag-scroll--init';

/** A function to apply cursor drag scroll behavior to an element. */
export const useCursorDragScroll = (el: SignalElementBindingType, options?: CursorDragScrollOptions) => {
  const elements = buildElementSignal(el);
  const element = firstElementSignal(elements);
  const destroyRef = inject(DestroyRef);
  const { enabled = signal(true), allowedDirection = 'both' } = options ?? {};
  const renderer = injectRenderer();
  const isDragging = signal(false);
  const isInitDragging = signal(false);
  const initialDragPosition = signal({ x: 0, y: 0 });
  const initialScrollPosition = signal({ x: 0, y: 0 });
  const dragAmount = signal({ x: 0, y: 0 });
  const document = inject(DOCUMENT);

  // Only measured when the caller hasn't already: this costs a MutationObserver and a ResizeObserver.
  const suppliedCanScroll = options?.canScroll;
  const measuredScrollState = suppliedCanScroll ? null : signalElementScrollState(elements);

  const measuredCanScroll = computed(() => {
    const currentScrollState = measuredScrollState?.();

    if (!currentScrollState) return false;

    const direction = maybeSignalValue(allowedDirection);

    switch (direction) {
      case 'both':
        return currentScrollState.canScrollHorizontally || currentScrollState.canScrollVertically;
      case 'horizontal':
        return currentScrollState.canScrollHorizontally;
      case 'vertical':
        return currentScrollState.canScrollVertically;
    }
  });

  const canScroll = suppliedCanScroll ?? measuredCanScroll;

  // A host destroyed mid-drag never re-runs the styling effect, so the grabbing cursor it wrote on
  // `<html>` would outlive the page it was dragged on.
  destroyRef.onDestroy(() => renderer.removeStyle(document.documentElement, 'cursor'));

  // Cleanup if the element the cursor drag scroll is bound to gets changed
  effect(() => {
    const { previousElement } = element();

    if (previousElement) {
      renderer.removeStyle(previousElement, 'cursor');
    }
  });

  // Conditionally apply styles/classes to the element and the document
  effect(() => {
    const currCanScroll = canScroll();
    const isEnabled = enabled();
    const currIsDragging = isDragging();
    const currIsInitDragging = isInitDragging();

    untracked(() => {
      const el = element().currentElement;

      if (!el) return;

      if (!currCanScroll || !isEnabled) {
        renderer.removeStyles(el, 'cursor', 'scrollSnapType', 'scrollBehavior');
        renderer.removeStyle(document.documentElement, 'cursor');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS, CURSOR_DRAG_INIT_CLASS);

        return;
      }

      if (currIsInitDragging) {
        renderer.addClass(el, CURSOR_DRAG_INIT_CLASS);
      }

      if (currIsDragging) {
        renderer.addClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.setStyle(el, {
          cursor: 'grabbing',
          scrollSnapType: 'none',
          scrollBehavior: 'unset',
        });

        renderer.setStyle(document.documentElement, {
          cursor: 'grabbing',
        });
      }

      if (!currIsInitDragging && !currIsDragging) {
        renderer.setStyle(el, {
          cursor: 'grab',
        });
        renderer.removeStyles(el, 'scrollSnapType', 'scrollBehavior');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS, CURSOR_DRAG_INIT_CLASS);
        renderer.removeStyle(document.documentElement, 'cursor');
      }
    });
  });

  // Update the element's scroll position when the user drags
  effect(() => {
    const currDragAmount = dragAmount();

    untracked(() => {
      const currIsDragging = isDragging();
      const el = element().currentElement;
      const { x: dragX, y: dragY } = currDragAmount;
      const { x: scrollX, y: scrollY } = initialScrollPosition();
      const currAllowedDirection = maybeSignalValue(allowedDirection);

      if (!el || !currIsDragging) return;

      switch (currAllowedDirection) {
        case 'both':
          el.scroll({
            top: dragY + scrollY,
            left: dragX + scrollX,
            behavior: 'instant',
          });
          break;
        case 'horizontal':
          el.scroll({
            left: dragX + scrollX,
            behavior: 'instant',
          });
          break;
        case 'vertical':
          el.scroll({
            top: dragY + scrollY,
            behavior: 'instant',
          });
          break;
      }
    });
  });

  const updateDragging = (e: MouseEvent) => {
    const el = element().currentElement;

    if (!el) return;

    const dx = (e.clientX - initialDragPosition().x) * -1;
    const dy = (e.clientY - initialDragPosition().y) * -1;

    dragAmount.set({ x: dx, y: dy });

    if (Math.abs(dx) > CURSOR_DRAG_SCROLL_DEADZONE || Math.abs(dy) > CURSOR_DRAG_SCROLL_DEADZONE) {
      isDragging.set(true);
    }
  };

  const updateDraggingEnd = () => {
    isDragging.set(false);
    isInitDragging.set(false);
    initialDragPosition.set({ x: 0, y: 0 });
    initialScrollPosition.set({ x: 0, y: 0 });
    dragAmount.set({ x: 0, y: 0 });
  };

  const setupDragging = (e: MouseEvent) => {
    // A context menu takes the pointer away without ever delivering a `mouseup` - so without it in here, a
    // right click (or a ctrl-click on a Mac, which is the primary button) leaves the drag latched on and
    // every later mouse move scrolls the container.
    const dragEnd = merge(fromEvent<MouseEvent>(document, 'mouseup'), fromEvent<MouseEvent>(document, 'contextmenu'));
    const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');
    const el = element().currentElement;

    if (!el) return;

    mouseMove
      .pipe(
        takeUntilDestroyed(destroyRef),
        takeUntil(dragEnd),
        tap((e) => updateDragging(e)),
      )
      .subscribe();

    dragEnd
      .pipe(
        take(1),
        takeUntilDestroyed(destroyRef),
        tap(() => updateDraggingEnd()),
      )
      .subscribe();

    initialDragPosition.set({ x: e.clientX, y: e.clientY });
    initialScrollPosition.set({ x: el.scrollLeft, y: el.scrollTop });
    isInitDragging.set(true);
  };

  toObservable(element)
    .pipe(
      map((e) => e?.currentElement),
      switchMap((el) => (el ? fromEvent<MouseEvent>(el, 'mousedown') : of(null))),
      filter((e): e is MouseEvent => !!e),
      filter((e) => e.button === PRIMARY_MOUSE_BUTTON),
      filter(() => enabled()),
      tap((e) => setupDragging(e)),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    isDragging: isDragging.asReadonly(),
    currentDragAmount: dragAmount.asReadonly(),
  };
};
