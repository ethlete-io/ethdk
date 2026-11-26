import { Component, ViewEncapsulation, input, output } from '@angular/core';
import { ButtonComponent } from '../../button/button.component';
import { DateRangePreset, DateRangePresetOption } from './date-range-presets';
import { injectDateTimeLabels } from './date-time-labels';

@Component({
  selector: 'et-date-range-presets',
  template: `
    @for (option of options(); track option.preset) {
      <button
        [pressed]="option.active"
        (click)="presetSelect.emit(option.preset)"
        class="et-date-range-preset"
        et-button
        size="sm"
        variant="transparent"
        type="button"
      >
        {{ option.label }}
      </button>
    }
  `,
  styleUrl: './date-range-presets.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ButtonComponent],
  host: {
    class: 'et-date-range-presets',
    role: 'group',
    '[attr.aria-label]': 'labels().presets',
  },
})
export class DateRangePresetsComponent {
  protected labels = injectDateTimeLabels();

  public options = input.required<readonly DateRangePresetOption[]>();

  public presetSelect = output<DateRangePreset>();
}
