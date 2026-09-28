import { Component, ViewEncapsulation, booleanAttribute, computed, input, numberAttribute } from '@angular/core';
import { clampProgress } from '../clamp-progress';

/**
 * A linear loading indicator, determinate by default. Inherits `currentColor`. It has no accessible name of its
 * own, so give a standalone bar an `aria-label`.
 *
 * @example
 * <et-progress-bar [value]="42" aria-label="Upload progress" />
 */
@Component({
  selector: 'et-progress-bar',
  template: `
    <div class="et-progress-bar__track" aria-hidden="true">
      <div
        [style.transform]="indeterminate() ? '' : 'scaleX(' + clampedValue() / 100 + ')'"
        class="et-progress-bar__bar et-progress-bar__bar--primary"
      >
        <span class="et-progress-bar__bar-inner"></span>
      </div>
      <div class="et-progress-bar__bar et-progress-bar__bar--secondary">
        <span class="et-progress-bar__bar-inner"></span>
      </div>
    </div>
  `,
  styleUrl: './progress-bar.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-progress-bar',
    '[class.et-progress-bar--indeterminate]': 'indeterminate()',
    role: 'progressbar',
    '[attr.aria-valuenow]': 'indeterminate() ? null : clampedValue()',
    '[attr.aria-valuemin]': 'indeterminate() ? null : 0',
    '[attr.aria-valuemax]': 'indeterminate() ? null : 100',
  },
})
export class ProgressBarComponent {
  /** The progress, 0-100 and clamped. @default 0 */
  public value = input(0, { transform: numberAttribute });

  /** Show the sweeping animation instead of `value`, and drop the aria value attributes. @default false */
  public indeterminate = input(false, { transform: booleanAttribute });

  protected clampedValue = computed(() => clampProgress(this.value()));
}
