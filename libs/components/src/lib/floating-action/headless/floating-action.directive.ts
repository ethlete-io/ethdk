import {
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RuntimeError, injectStyleManager } from '@ethlete/core';
import { FLOATING_ACTION_ERROR_CODES } from '../floating-action-errors';
import { FloatingActionStylesComponent } from '../floating-action-styles.component';
import { FLOATING_ACTION_STATES, FloatingActionState } from '../floating-action.types';
import {
  FloatingActionAnchorDirective,
  FloatingActionScopeDirective,
  FloatingActionTopDirective,
  FloatingActionTriggerDirective,
} from './floating-action-parts.directive';
import { FLOATING_ACTION_TOKEN } from './floating-action.tokens';

/**
 * Keeps an action reachable after the reader has scrolled past it: the trigger sits in the flow where it was
 * written, and pins itself to a corner of the viewport once its place in the page has scrolled away. A filter
 * button above a long list, a "save changes" bar, a back-to-top.
 *
 * Ported from cdk's `rich-filter`, which was never about filtering - it renders no filter UI and imports nothing
 * from `@ethlete/query`. This is that scroll-coordination pattern under a name that says what it does.
 *
 * **Why not CSS?** `position: sticky` can keep an element at an edge, but it cannot move it to a corner of the
 * viewport, and it has no way to express "and the region this acts on is still on screen" - which is the part
 * that stops a pinned button following the reader onto unrelated content. So the state comes from two
 * intersection observers and CSS reacts to it.
 *
 * @example
 * <div etFloatingAction>
 *   <div etFloatingActionAnchor>
 *     <button etFloatingActionTrigger (click)="openFilters()">Filter</button>
 *   </div>
 *
 *   <ul etFloatingActionScope>
 *     @for (result of results(); track result.id) { <li>…</li> }
 *   </ul>
 * </div>
 */
@Directive({
  selector: '[etFloatingAction]',
  exportAs: 'etFloatingAction',
  providers: [{ provide: FLOATING_ACTION_TOKEN, useExisting: FloatingActionDirective }],
  host: {
    class: 'et-floating-action',
    '[attr.data-state]': 'state()',
  },
})
export class FloatingActionDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private styleManager = injectStyleManager();

  /**
   * Keep the trigger in the flow, whatever the scroll position. The escape hatch for turning the behaviour off
   * per breakpoint or per route without unwinding the markup - a desktop layout with the filters already in a
   * sidebar has nothing to float. @default false
   */
  public disabled = input(false, { transform: booleanAttribute });

  /** @internal Set by `etFloatingActionAnchor`. Its visibility is what drives the state. */
  public anchor = signal<FloatingActionAnchorDirective | null>(null);

  /** @internal Set by `etFloatingActionTrigger`. */
  public trigger = signal<FloatingActionTriggerDirective | null>(null);

  /** @internal Set by `etFloatingActionScope`; optional, and what bounds the action to a region. */
  public scope = signal<FloatingActionScopeDirective | null>(null);

  /** @internal Set by `etFloatingActionTop`; optional override for `scrollToTop()`. */
  public top = signal<FloatingActionTopDirective | null>(null);

  /**
   * Where the trigger is: in the flow, pinned to the corner, or gone.
   *
   * Read off *above*, not merely "not visible": scrolling **down** past the anchor is what should pin the
   * trigger, while an anchor still below the fold has simply not been reached and must stay put. The same goes
   * for the scope - once it is above, the reader has left the region behind.
   */
  public state = computed<FloatingActionState>(() => {
    if (this.disabled()) return FLOATING_ACTION_STATES.INLINE;

    const anchorEntry = this.anchor()?.intersection()[0];

    if (!anchorEntry?.isAbove) return FLOATING_ACTION_STATES.INLINE;

    // No scope means nothing bounds the action, so it stays available for the rest of the page.
    const scopeEntry = this.scope()?.intersection()[0];

    if (scopeEntry?.isAbove) return FLOATING_ACTION_STATES.HIDDEN;

    return FLOATING_ACTION_STATES.FLOATING;
  });

  /** Whether the trigger is currently pinned to the viewport. */
  public isFloating = computed(() => this.state() === FLOATING_ACTION_STATES.FLOATING);

  constructor() {
    // The floating itself is CSS, and it is mechanism rather than decoration, so a hand-built composition has to
    // get it too. De-duplicated by the style manager.
    this.styleManager.mount(FloatingActionStylesComponent);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.anchor()) {
          throw new RuntimeError(
            FLOATING_ACTION_ERROR_CODES.MISSING_ANCHOR,
            '[FloatingActionDirective] No [etFloatingActionAnchor] was found, so there is nothing to tell when ' +
              'the trigger has scrolled away. Wrap the trigger in an anchor element.',
          );
        }
      });
    }
  }

  /**
   * Scroll back to the top of the region - what a filter button does after applying filters, so the reader sees
   * the new first result rather than wherever they happened to be. Targets `[etFloatingActionTop]` if there is
   * one, otherwise this element.
   */
  public scrollToTop(options?: ScrollIntoViewOptions) {
    const target = this.top()?.elementRef.nativeElement ?? this.elementRef.nativeElement;

    target.scrollIntoView(options ?? { behavior: 'smooth', block: 'start' });
  }
}
