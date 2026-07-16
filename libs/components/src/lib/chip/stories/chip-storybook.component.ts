import { Component, ViewEncapsulation, booleanAttribute, input, signal } from '@angular/core';
import { CHIP_IMPORTS } from '../chip.imports';

@Component({
  selector: 'et-sb-chip',
  template: `
    <div class="flex flex-wrap items-center gap-2">
      @for (label of labels(); track label) {
        <et-chip [disabled]="disabled()" [removable]="removable()" (remove)="removeLabel(label)">
          {{ label }}
        </et-chip>
      }

      @if (!labels().length) {
        <button (click)="reset()" class="text-sm underline" type="button">All chips removed — reset</button>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHIP_IMPORTS],
})
export class ChipStorybookComponent {
  public disabled = input(false, { transform: booleanAttribute });
  public removable = input(true, { transform: booleanAttribute });

  protected labels = signal(DEFAULT_LABELS);

  protected removeLabel(label: string) {
    this.labels.update((labels) => labels.filter((l) => l !== label));
  }

  protected reset() {
    this.labels.set(DEFAULT_LABELS);
  }
}

const DEFAULT_LABELS = ['Design', 'Engineering', 'Marketing', 'Very long department name that gets truncated'];
