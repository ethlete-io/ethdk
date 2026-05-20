import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { RADIO_GROUP_TOKEN, RadioGroupLabelBase } from './radio-group.tokens';

let uniqueIdCounter = 0;

@Component({
  selector: 'et-radio-group-label',
  template: `
    <span class="et-radio-group-label-content">
      <ng-content />
    </span>

    @if (requiredMarkerVisible()) {
      <span class="et-radio-group-label-required-marker" aria-hidden="true">*</span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.id]': 'id()',
    '[attr.data-disabled]': 'effectiveDisabled() || null',
  },
  styles: `
    et-radio-group-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: var(--et-surface-color-muted-solid, currentColor);
      margin-block-end: 4px;
    }

    .et-radio-group-label-content {
      min-inline-size: 0;
    }

    .et-radio-group-label-required-marker {
      display: inline-block;
      color: var(--et-theme-color-primary-solid);
      margin-inline-start: 0.45ch;
    }

    et-radio-group-label[data-disabled] .et-radio-group-label-required-marker {
      color: var(--et-surface-interaction-disabled-solid, currentColor);
    }
  `,
})
export class RadioGroupLabelDirective implements RadioGroupLabelBase {
  private radioGroup = inject(RADIO_GROUP_TOKEN);
  private destroyRef = inject(DestroyRef);

  public id = signal(`et-radio-group-label-${uniqueIdCounter++}`);
  public requiredMarkerVisible = computed(() => this.radioGroup.required());
  public effectiveDisabled = computed(() => this.radioGroup.disabled());

  constructor() {
    this.radioGroup.registeredLabel.set(this);
    this.destroyRef.onDestroy(() => this.radioGroup.unregisterLabel(this));
  }
}
