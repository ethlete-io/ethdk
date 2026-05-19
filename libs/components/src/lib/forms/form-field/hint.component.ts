import { ChangeDetectionStrategy, Component, DestroyRef, inject, ViewEncapsulation } from '@angular/core';
import { FORM_FIELD_TOKEN, HintComponentBase } from './headless';

@Component({
  selector: 'et-hint',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HintComponent implements HintComponentBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  constructor() {
    this.formField?.registerHint(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterHint(this));
  }
}
