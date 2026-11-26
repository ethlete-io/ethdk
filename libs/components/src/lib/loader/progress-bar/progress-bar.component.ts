import { Component, ViewEncapsulation, booleanAttribute, computed, inject, input } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { clampProgress, progressOrNull } from '../clamp-progress';
import { injectLoaderName } from '../inject-loader-name';

/**
 * A linear loading indicator: determinate while `value` is bound, else indeterminate. Inherits `currentColor` unless
 * `color` is set. Its accessible name is the loader `loading` label; set an `aria-label` to name it more specifically.
 *
 * @example
 * <et-progress-bar [value]="42" aria-label="Upload progress" />
 */
@Component({
  selector: 'et-progress-bar',
  template: `
    <div class="et-progress-bar__track" aria-hidden="true">
      <div
        [style.transform]="indeterminate() || roundedEnd() ? '' : 'scaleX(' + clampedValue() / 100 + ')'"
        [style.width.%]="roundedEnd() && !indeterminate() ? clampedValue() : null"
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
  hostDirectives: [
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-progress-bar',
    '[class.et-progress-bar--indeterminate]': 'indeterminate()',
    '[class.et-progress-bar--themed]': 'hasExplicitColor()',
    '[class.et-progress-bar--rounded-end]': 'roundedEnd()',
    role: 'progressbar',
    '[attr.aria-label]': 'name()',
    '[attr.aria-valuenow]': 'indeterminate() ? null : clampedValue()',
    '[attr.aria-valuemin]': 'indeterminate() ? null : 0',
    '[attr.aria-valuemax]': 'indeterminate() ? null : 100',
  },
})
export class ProgressBarComponent {
  private provideColor = inject(ProvideColorDirective);

  protected name = injectLoaderName();

  /**
   * The progress, 0-100 and clamped. `null` or `undefined` shows the sweeping animation instead and drops the aria
   * value attributes. @default null
   */
  public value = input<number | null, number | string | null | undefined>(null, { transform: progressOrNull });

  /**
   * Round the end of the determinate fill with `--et-progress-bar-border-radius`. Off, the fill ends square.
   * @default false
   */
  public roundedEnd = input(false, { transform: booleanAttribute });

  protected indeterminate = computed(() => this.value() === null);

  protected hasExplicitColor = computed(() => (this.provideColor.color() ?? null) !== null);

  protected clampedValue = computed(() => clampProgress(this.value() ?? 0));
}
