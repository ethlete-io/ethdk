import { Component, computed, DestroyRef, ElementRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { FORM_FIELD_TOKEN, LabelDirectiveBase } from './form-field.tokens';
import { hitsInteractiveElement } from './interactive-element';

let uniqueIdCounter = 0;

@Component({
  selector: 'et-label',
  template: `
    <span class="et-label-content">
      <ng-content />
    </span>

    @if (requiredMarkerVisible()) {
      <span class="et-label-required-marker" aria-hidden="true">*</span>
    }
  `,
  styleUrl: './label.directive.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[attr.id]': 'id()',
    '[attr.data-disabled]': 'effectiveDisabled() || null',
    '(click)': 'handleClick($event)',
  },
})
export class LabelDirective implements LabelDirectiveBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  public id = signal(`et-label-${uniqueIdCounter++}`);
  public requiredMarkerVisible = computed(() => this.formField?.registeredControl()?.required?.() ?? false);
  public effectiveDisabled = computed(
    () =>
      this.formField?.registeredControl()?.effectiveDisabled?.() ??
      this.formField?.registeredControl()?.disabled?.() ??
      false,
  );

  constructor() {
    this.formField?.registeredLabel.set(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterLabel(this));
  }

  /** @internal */
  public handleClick(event: Event) {
    if (hitsInteractiveElement(event.target as HTMLElement, this.el.nativeElement)) return;

    this.activateControl();
  }

  public activateControl() {
    this.formField?.activate();
  }
}
