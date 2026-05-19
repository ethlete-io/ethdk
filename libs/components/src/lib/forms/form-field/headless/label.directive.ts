import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { FORM_FIELD_TOKEN, LabelDirectiveBase } from './form-field.tokens';

let uniqueIdCounter = 0;

@Component({
  selector: 'et-label',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.id]': 'id()',
    '(click)': 'activateControl()',
  },
})
export class LabelDirective implements LabelDirectiveBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public id = signal(`et-label-${uniqueIdCounter++}`);

  constructor() {
    this.formField?.registeredLabel.set(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterLabel(this));
  }

  public activateControl() {
    this.formField?.activate();
  }
}
