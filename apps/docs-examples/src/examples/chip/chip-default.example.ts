import { Component, signal, ViewEncapsulation } from '@angular/core';
import { CHIP_IMPORTS } from '@ethlete/components';

const DEFAULT_LABELS = ['Design', 'Engineering', 'Marketing', 'Very long department name that gets truncated'];

@Component({
  selector: 'app-chip-default-example',
  template: `
    <div class="app-example-row">
      @for (label of labels(); track label) {
        <et-chip (remove)="removeLabel(label)" removable>{{ label }}</et-chip>
      }
    </div>

    @if (!labels().length) {
      <button (click)="labels.set(DEFAULT_LABELS)" type="button">All chips removed - reset</button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHIP_IMPORTS],
})
export class ChipDefaultExampleComponent {
  protected readonly DEFAULT_LABELS = DEFAULT_LABELS;

  protected labels = signal(DEFAULT_LABELS);

  protected removeLabel(label: string) {
    this.labels.update((labels) => labels.filter((l) => l !== label));
  }
}
