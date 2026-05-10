import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  value = input(0, { transform: numberAttribute });
  indeterminate = input(false, { transform: booleanAttribute });

  clampedValue = computed(() => Math.max(0, Math.min(100, this.value())));
}
