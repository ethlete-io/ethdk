import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';
import { injectHostElement, RuntimeError, signalHostElementIntersection } from '@ethlete/core';
import { FLOATING_ACTION_ERROR_CODES } from '../floating-action-errors';
import { FLOATING_ACTION_TOKEN } from './floating-action.tokens';

/** Dev-mode guard: a part outside a floating action registers with nothing and silently does nothing. */
const assertInsideFloatingAction = (floatingAction: unknown, directiveName: string) => {
  if (!ngDevMode) return;

  const element = injectHostElement();

  afterNextRender(() => {
    if (!floatingAction) {
      throw new RuntimeError(
        FLOATING_ACTION_ERROR_CODES.PART_OUTSIDE_FLOATING_ACTION,
        `[${directiveName}] This directive must be placed inside an [etFloatingAction] element, which is what ` +
          'coordinates it.',
        { element },
      );
    }
  });
};

/**
 * The trigger's home in the document flow - the element that stays put and keeps its space when the trigger
 * detaches.
 *
 * It has to be a separate element from the trigger, and that is the whole trick: once the trigger is
 * `position: fixed` it is *always* on screen, so observing it would immediately say "come back", then "go
 * away", forever. The anchor never moves, so its visibility is a stable question. It is also what stops the
 * layout jumping when the trigger leaves the flow.
 *
 * @example
 * <div etFloatingActionAnchor>
 *   <button etFloatingActionTrigger (click)="openFilters()">Filter</button>
 * </div>
 */
@Directive({
  selector: '[etFloatingActionAnchor]',
  exportAs: 'etFloatingActionAnchor',
  host: { class: 'et-floating-action-anchor' },
})
export class FloatingActionAnchorDirective {
  /** @internal Where the anchor sits relative to the viewport - the input to the whole state machine. */
  public intersection = signalHostElementIntersection();

  constructor() {
    const floatingAction = inject(FLOATING_ACTION_TOKEN, { optional: true });

    floatingAction?.anchor.set(this);
    assertInsideFloatingAction(floatingAction, 'FloatingActionAnchorDirective');
  }
}

/**
 * The button (or link) itself. Carries the class the stylesheet moves, and nothing else - it stays the same
 * element in the same place in the DOM whether it is inline or floating, so the tab order never changes and a
 * screen reader never sees it appear or disappear.
 *
 * @example
 * <button etFloatingActionTrigger (click)="openFilters()">Filter</button>
 */
@Directive({
  selector: '[etFloatingActionTrigger]',
  exportAs: 'etFloatingActionTrigger',
  host: { class: 'et-floating-action-trigger' },
})
export class FloatingActionTriggerDirective {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const floatingAction = inject(FLOATING_ACTION_TOKEN, { optional: true });

    floatingAction?.trigger.set(this);
    assertInsideFloatingAction(floatingAction, 'FloatingActionTriggerDirective');
  }
}

/**
 * The region the trigger acts on - the results list a filter button filters, the form a save bar saves.
 *
 * Optional, and what it buys is knowing when to *stop* offering the action: once this has scrolled past, the
 * reader is somewhere else on the page and a pinned "Filter" button is just clutter. Without it the trigger
 * floats for the rest of the page.
 *
 * @example
 * <ul etFloatingActionScope>…</ul>
 */
@Directive({
  selector: '[etFloatingActionScope]',
  exportAs: 'etFloatingActionScope',
  host: { class: 'et-floating-action-scope' },
})
export class FloatingActionScopeDirective {
  /** @internal Whether the region is still in play. */
  public intersection = signalHostElementIntersection();

  constructor() {
    const floatingAction = inject(FLOATING_ACTION_TOKEN, { optional: true });

    floatingAction?.scope.set(this);
    assertInsideFloatingAction(floatingAction, 'FloatingActionScopeDirective');
  }
}

/**
 * Where `scrollToTop()` scrolls to. Optional - without it the floating action's own element is the target,
 * which is usually what you want.
 *
 * Put it somewhere else when the thing to return to isn't the top of the container: a filter panel that should
 * scroll back to the first result rather than to the page heading above it.
 *
 * @example
 * <h2 etFloatingActionTop>Results</h2>
 */
@Directive({
  selector: '[etFloatingActionTop]',
  exportAs: 'etFloatingActionTop',
})
export class FloatingActionTopDirective {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const floatingAction = inject(FLOATING_ACTION_TOKEN, { optional: true });

    floatingAction?.top.set(this);
    assertInsideFloatingAction(floatingAction, 'FloatingActionTopDirective');
  }
}
