import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { FORM_FIELD_TOKEN, LabelDirectiveBase } from './form-field.tokens';

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
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.id]': 'id()',
    '(click)': 'activateControl()',
  },
  styles: `
    et-label {
      display: inline;
      min-inline-size: 0;
    }

    .et-label-content {
      min-inline-size: 0;
    }

    .et-label-required-marker {
      display: inline-block;
      color: var(--et-theme-color-primary-solid);
      margin-inline-start: 0.45ch;
    }
  `,
})
export class LabelDirective implements LabelDirectiveBase {
  private formField = inject(FORM_FIELD_TOKEN, { optional: true });
  private destroyRef = inject(DestroyRef);

  public id = signal(`et-label-${uniqueIdCounter++}`);
  public requiredMarkerVisible = computed(() => this.formField?.registeredControl()?.required?.() ?? false);

  constructor() {
    this.formField?.registeredLabel.set(this);
    this.destroyRef.onDestroy(() => this.formField?.unregisterLabel(this));
  }

  public activateControl() {
    this.formField?.activate();
  }
}
