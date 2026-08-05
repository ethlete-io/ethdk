import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  booleanAttribute,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  signal,
  untracked,
} from '@angular/core';
import { RuntimeError, createComponentId } from '@ethlete/core';
import { ACCORDION_ERROR_CODES } from '../accordion-errors';
import { ACCORDION_GROUP_TOKEN, ACCORDION_TOKEN } from './accordion.tokens';
import { AccordionPanelDirective } from './accordion-panel.directive';
import {
  AccordionContentDirective,
  AccordionHintDirective,
  AccordionLabelDirective,
} from './accordion-templates.directive';
import { AccordionTriggerDirective } from './accordion-trigger.directive';
import { registerPart } from './internals/register-part';

/**
 * One disclosure: a trigger that expands a panel. Owns the open state, the ids that wire the two
 * together for assistive tech, and the "has ever been open" flag lazy content hangs off. No visual
 * opinion - bring your own template, or use the default `et-accordion`.
 *
 * A single accordion is a complete disclosure on its own; put several inside an `[etAccordionGroup]`
 * to get single-open behavior and arrow-key navigation between their triggers.
 *
 * @example
 * <div etAccordion #shipping="etAccordion">
 *   <h3><button etAccordionTrigger type="button">Shipping</button></h3>
 *   <div etAccordionPanel>Ships in 2–4 days.</div>
 * </div>
 */
@Directive({
  selector: '[etAccordion]',
  exportAs: 'etAccordion',
  providers: [{ provide: ACCORDION_TOKEN, useExisting: AccordionDirective }],
  host: {
    '[attr.data-open]': 'isOpen() ? "" : null',
    '[attr.data-disabled]': 'disabled() ? "" : null',
  },
})
export class AccordionDirective {
  private group = inject(ACCORDION_GROUP_TOKEN, { optional: true });

  /** @internal The host element, used by the group to order its accordions the way the DOM does. */
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether the panel is expanded. Two-way bindable. */
  public isOpen = model(false);

  /**
   * Expand on first render. Only the initial value is honored - a later change never reopens a panel
   * the user has since closed. Use `[(isOpen)]` to drive the state over time.
   */
  public isOpenByDefault = input(false, { transform: booleanAttribute });

  /**
   * Refuse to toggle. The trigger stays focusable and is marked `aria-disabled` rather than natively
   * disabled, so screen-reader users can still reach the header and hear that it can't be expanded.
   */
  public disabled = input(false, { transform: booleanAttribute });

  public readonly ID = createComponentId('et-accordion');
  public readonly TRIGGER_ID = `${this.ID}-trigger`;
  public readonly PANEL_ID = `${this.ID}-panel`;

  /** @internal */
  public trigger = signal<AccordionTriggerDirective | null>(null);

  /** @internal */
  public panel = signal<AccordionPanelDirective | null>(null);

  /** @internal The `etAccordionLabel` slot, when one is projected. */
  public labelTemplate = signal<AccordionLabelDirective | null>(null);

  /** @internal The `etAccordionHint` slot, when one is projected. */
  public hintTemplate = signal<AccordionHintDirective | null>(null);

  /** @internal The `etAccordionContent` slot - panel content deferred until the first expand. */
  public contentTemplate = signal<AccordionContentDirective | null>(null);

  /**
   * Whether content that is only created on demand should exist by now: `false` until the first
   * expand, `true` forever after. Deferred content stays mounted once created - unmounting it on
   * collapse would throw away its state and leave nothing to animate the collapse with.
   */
  public hasBeenOpened = linkedSignal<boolean, boolean>({
    source: () => this.isOpen(),
    computation: (isOpen, previous) => isOpen || (previous?.value ?? false),
  });

  constructor() {
    // Seeding, not syncing: read `isOpenByDefault` once (after the first binding has been applied)
    // and then stop listening, so a re-render can't yank a closed panel back open.
    const seed = effect(() => {
      const isOpenByDefault = this.isOpenByDefault();

      untracked(() => {
        if (isOpenByDefault) {
          this.isOpen.set(true);
        }

        seed.destroy();
      });
    });

    // Registered from the constructor rather than an effect, so the group sees its accordions in
    // creation order and, crucially, is told when one is destroyed - a `@for` that drops an item must
    // not leave a dead accordion in the group's list.
    this.group?.registerAccordion(this);

    inject(DestroyRef).onDestroy(() => this.group?.unregisterAccordion(this));

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.trigger()) {
          throw new RuntimeError(
            ACCORDION_ERROR_CODES.MISSING_TRIGGER,
            '[AccordionDirective] No [etAccordionTrigger] was found inside this accordion, so nothing can expand it. ' +
              'Add an element (ideally a <button> inside a heading) with the etAccordionTrigger directive.',
            { element: this.elementRef.nativeElement },
          );
        }

        // Only an accordion that is *open* is definitely broken without a panel. A closed one may
        // simply be rendering its panel conditionally (`@if (accordion.isOpen())`), which is a valid
        // way to build one - the trigger drops its `aria-controls` while the panel doesn't exist.
        if (this.isOpen() && !this.panel()) {
          throw new RuntimeError(
            ACCORDION_ERROR_CODES.MISSING_PANEL,
            '[AccordionDirective] This accordion is open but no [etAccordionPanel] was found inside it, so there is ' +
              'nothing to expand. Add an element with the etAccordionPanel directive.',
            { element: this.elementRef.nativeElement },
          );
        }
      });
    }
  }

  /** Expand the panel. No-op while `disabled`. */
  public open() {
    if (this.disabled()) return;

    this.isOpen.set(true);
  }

  /** Collapse the panel. Works even while `disabled` - a disabled accordion can still be closed programmatically. */
  public close() {
    this.isOpen.set(false);
  }

  /**
   * Expand or collapse the panel - what the trigger calls. No-op while `disabled`, and no-op when this
   * is the last open panel of a group with `preventCloseLast`.
   */
  public toggle() {
    if (this.disabled()) return;

    if (this.isOpen()) {
      if (this.group && !this.group.canCollapse(this)) return;

      this.isOpen.set(false);

      return;
    }

    this.isOpen.set(true);
  }

  /** @internal Call from the trigger's constructor - it takes over the teardown from the caller's `DestroyRef`. */
  public registerTrigger(trigger: AccordionTriggerDirective) {
    registerPart(this.trigger, trigger);
  }

  /**
   * @internal Call from the panel's constructor. Registration is undone on destroy: a panel may be
   * rendered conditionally, and a destroyed one has to stop being *the* panel (the trigger drops its
   * `aria-controls` while there is none).
   */
  public registerPanel(panel: AccordionPanelDirective) {
    registerPart(this.panel, panel);
  }
}
