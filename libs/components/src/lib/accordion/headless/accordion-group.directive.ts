import { Directive, booleanAttribute, computed, effect, input, signal, untracked } from '@angular/core';
import { ACCORDION_GROUP_TOKEN } from './accordion.tokens';
import { AccordionDirective } from './accordion.directive';

/**
 * A set of accordions that know about each other: optionally single-open (`autoCloseOthers`), and
 * navigable between headers with the arrow keys - the part of the ARIA accordion pattern a lone
 * disclosure can't provide.
 *
 * Purely behavioral; the default `et-accordion-group` adds the chrome. Accordions register
 * themselves, so nesting one inside another group's panel does the expected thing (it joins the
 * nearest group).
 *
 * @example
 * <div etAccordionGroup autoCloseOthers>
 *   <et-accordion label="Shipping">…</et-accordion>
 *   <et-accordion label="Returns">…</et-accordion>
 * </div>
 */
@Directive({
  selector: '[etAccordionGroup]',
  exportAs: 'etAccordionGroup',
  providers: [{ provide: ACCORDION_GROUP_TOKEN, useExisting: AccordionGroupDirective }],
  host: {
    '(keydown)': 'moveFocusOnArrowKeys($event)',
  },
})
export class AccordionGroupDirective {
  /**
   * Keep at most one panel open: expanding one collapses the rest. Off by default, which lets readers
   * compare two sections side by side - turn it on when the panels are long enough that several open
   * at once buries the headers below.
   */
  public autoCloseOthers = input(false, { transform: booleanAttribute });

  /**
   * Keep at least one panel open: collapsing the last open one does nothing. Pair it with
   * `autoCloseOthers` for a radio-like group where exactly one section is open at a time.
   *
   * It gates the user's own toggle - the trigger, and `toggle()`. `close()`, `closeAll()` and writing
   * `[(isOpen)]` still collapse the panel, the same way they ignore `disabled`: this is about what the
   * header does when clicked, not a lock on the state.
   *
   * A group that starts with nothing open stays that way until the user opens something; it does not
   * force a panel open to satisfy the rule.
   */
  public preventCloseLast = input(false, { transform: booleanAttribute });

  /**
   * Move focus between headers with `ArrowUp`/`ArrowDown` (and jump with `Home`/`End`), as the ARIA
   * accordion pattern suggests. Turn off if the surrounding UI needs those keys - a group inside a
   * scroll container that pages with the arrow keys, for instance. @default true
   */
  public arrowKeyNavigation = input(true, { transform: booleanAttribute });

  private registeredAccordions = signal<AccordionDirective[]>([]);

  /**
   * The group's accordions in DOM order. Registration order follows creation order, which is not the
   * same thing once a `@for` re-orders its items, so this sorts by document position instead - the
   * order the arrow keys have to follow.
   */
  public accordions = computed(() =>
    [...this.registeredAccordions()].sort((a, b) =>
      a.elementRef.nativeElement.compareDocumentPosition(b.elementRef.nativeElement) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    ),
  );

  /**
   * The accordions that were open the last time single-open ran. `autoCloseOthers` needs to know
   * which panel *just* opened - not merely which ones are open - and that is a diff against the
   * previous state, so it is kept outside the reactive graph rather than being derived from it.
   */
  private previouslyOpen = new Set<AccordionDirective>();

  constructor() {
    effect(() => {
      // read every child's open state so this re-runs whenever any of them toggles
      const openAccordions = this.accordions().filter((accordion) => accordion.isOpen());
      const autoCloseOthers = this.autoCloseOthers();

      untracked(() => this.enforceSingleOpen(openAccordions, autoCloseOthers));
    });
  }

  /** Collapse every accordion in the group. */
  public closeAll() {
    for (const accordion of this.accordions()) {
      accordion.close();
    }
  }

  /** Expand every accordion in the group. Does nothing while `autoCloseOthers` is on - it would immediately undo itself. */
  public openAll() {
    if (this.autoCloseOthers()) return;

    for (const accordion of this.accordions()) {
      accordion.open();
    }
  }

  /**
   * @internal Whether an accordion's own toggle may collapse it - see {@link preventCloseLast}. Asked
   * by the accordion rather than enforced from here, because "the user tried to close it" is only
   * visible at the toggle; from the group's side a closed panel is just a closed panel.
   */
  public canCollapse(accordion: AccordionDirective) {
    if (!this.preventCloseLast()) return true;

    const open = this.accordions().filter((candidate) => candidate.isOpen());

    return open.length > 1 || !open.includes(accordion);
  }

  /** @internal */
  public registerAccordion(accordion: AccordionDirective) {
    this.registeredAccordions.update((accordions) => [...accordions, accordion]);
  }

  /** @internal */
  public unregisterAccordion(accordion: AccordionDirective) {
    this.registeredAccordions.update((accordions) => accordions.filter((a) => a !== accordion));
    this.previouslyOpen.delete(accordion);
  }

  /**
   * Arrow-key navigation across the headers. Only acts when the key came from a registered trigger, so
   * the same keys keep working normally inside panel content (a text field, a nested scroller).
   */
  protected moveFocusOnArrowKeys(event: KeyboardEvent) {
    if (!this.arrowKeyNavigation()) return;

    const accordions = this.accordions();
    const target = event.target;
    const currentIndex = accordions.findIndex((accordion) => accordion.trigger()?.elementRef.nativeElement === target);

    if (currentIndex === -1) return;

    const nextIndex = this.resolveNextIndex(event.key, currentIndex);

    if (nextIndex === null) return;

    event.preventDefault();
    accordions[nextIndex]?.trigger()?.elementRef.nativeElement.focus();
  }

  private enforceSingleOpen(openAccordions: AccordionDirective[], autoCloseOthers: boolean) {
    if (!autoCloseOthers || openAccordions.length <= 1) {
      this.previouslyOpen = new Set(openAccordions);

      return;
    }

    // The panel that just opened wins. When several were already open - two `isOpenByDefault`, or
    // `autoCloseOthers` switched on later - the first in DOM order does.
    const keep = openAccordions.find((accordion) => !this.previouslyOpen.has(accordion)) ?? openAccordions[0];

    // Record the settled state before closing anything: `close()` re-triggers the effect, and it must
    // not read a stale set and treat the survivor as freshly opened all over again.
    this.previouslyOpen = keep ? new Set([keep]) : new Set();

    for (const accordion of openAccordions) {
      if (accordion !== keep) {
        accordion.close();
      }
    }
  }

  /** The header to focus for a navigation key, or `null` for any other key. Wraps around at both ends. */
  private resolveNextIndex(key: string, currentIndex: number) {
    const count = this.accordions().length;

    switch (key) {
      case 'ArrowDown':
        return (currentIndex + 1) % count;
      case 'ArrowUp':
        return (currentIndex - 1 + count) % count;
      case 'Home':
        return 0;
      case 'End':
        return count - 1;
      default:
        return null;
    }
  }
}
