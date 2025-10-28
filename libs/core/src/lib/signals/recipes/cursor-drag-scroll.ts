import { DOCUMENT, DestroyRef, Renderer2, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { filter, fromEvent, map, of, switchMap, take, takeUntil, tap } from 'rxjs';
import { SignalElementBindingType, buildElementSignal, firstElementSignal } from '../element';
import { signalElementScrollState } from '../element-scroll-state';
import { MaybeSignal, maybeSignalValue } from '../signal-data-utils';

export type CursorDragScrollDirection = 'horizontal' | 'vertical' | 'both';

export type CursorDragScrollOptions = {
  /** If true, cursor drag scrolling will be enabled. */
  enabled?: Signal<boolean>;

  /** The allowed scroll direction. */
  allowedDirection?: MaybeSignal<CursorDragScrollDirection>;
};

/** The deadzone in pixels after which the cursor drag scroll will take effect. */
const CURSOR_DRAG_SCROLL_DEADZONE = 5;

/** The class that is added to the element when the cursor is being dragged. */
const CURSOR_DRAG_SCROLLING_CLASS = 'et-cursor-drag-scroll--scrolling';
const CURSOR_DRAG_INIT_CLASS = 'et-cursor-drag-scroll--init';

/** A function to apply cursor drag scroll behavior to an element. */
export const useCursorDragScroll = (el: SignalElementBindingType, options?: CursorDragScrollOptions) => {
  const elements = buildElementSignal(el);
  const element = firstElementSignal(elements);
  const destroyRef = inject(DestroyRef);
  const { enabled = signal(true), allowedDirection = 'both' } = options ?? {};
  const scrollState = signalElementScrollState(elements);
  const renderer = inject(Renderer2);
  const isDragging = signal(false);
  const isInitDragging = signal(false);
  const initialDragPosition = signal({ x: 0, y: 0 });
  const initialScrollPosition = signal({ x: 0, y: 0 });
  const dragAmount = signal({ x: 0, y: 0 });
  const document = inject(DOCUMENT);

  const canScroll = computed(() => {
    const currentScrollState = scrollState();
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
        renderer.removeStyle(el, 'cursor');
        renderer.removeStyle(el, 'scrollSnapType');
        renderer.removeStyle(el, 'scrollBehavior');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.removeClass(el, CURSOR_DRAG_INIT_CLASS);
        renderer.removeStyle(document.documentElement, 'cursor');
        return;
      }

      if (currIsInitDragging) {
        renderer.addClass(el, CURSOR_DRAG_INIT_CLASS);
      }

      if (currIsDragging) {
        renderer.addClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.setStyle(el, 'scrollSnapType', 'none');
        renderer.setStyle(el, 'scrollBehavior', 'unset');
        renderer.setStyle(el, 'cursor', 'grabbing');
        renderer.setStyle(document.documentElement, 'cursor', 'grabbing');
      }

      if (!currIsInitDragging && !currIsDragging) {
        renderer.setStyle(el, 'cursor', 'grab');
        renderer.removeStyle(el, 'scrollSnapType');
        renderer.removeStyle(el, 'scrollBehavior');
        renderer.removeClass(el, CURSOR_DRAG_SCROLLING_CLASS);
        renderer.removeClass(el, CURSOR_DRAG_INIT_CLASS);
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
    const mouseUp = fromEvent<MouseEvent>(document, 'mouseup');
    const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');
    const el = element().currentElement;

    if (!el) return;

    mouseMove
      .pipe(
        takeUntilDestroyed(destroyRef),
        takeUntil(mouseUp),
        tap((e) => updateDragging(e)),
      )
      .subscribe();

    mouseUp
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
