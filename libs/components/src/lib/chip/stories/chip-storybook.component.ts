import { JsonPipe } from '@angular/common';
import { Component, ViewEncapsulation, booleanAttribute, input, linkedSignal, signal } from '@angular/core';
import { FormField, form, readonly } from '@angular/forms/signals';
import { SelectionListDirective, SelectionOptionDirective } from '../../forms/selection-list/headless';
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

/**
 * The filter-chip composition: the selection-list headless directives on plain chips.
 * `etSelectionList` is the form control (single or multiple), `etSelectionOption` turns
 * each chip into a roving-focus option — no dedicated component needed.
 */
@Component({
  selector: 'et-sb-filter-chips',
  template: `
    <div class="flex max-w-md flex-col gap-6 p-8 font-sans">
      <div class="flex flex-col gap-2">
        <span class="text-sm opacity-60">Categories (multiple)</span>
        <div [formField]="demoForm.categories" [multiple]="true" class="flex flex-wrap gap-2" etSelectionList>
          @for (category of CATEGORIES; track category) {
            <et-chip [value]="category" etSelectionOption>{{ category }}</et-chip>
          }
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <span class="text-sm opacity-60">Sort by (single)</span>
        <div [formField]="demoForm.sortBy" class="flex flex-wrap gap-2" etSelectionList>
          @for (sort of SORTS; track sort) {
            <et-chip [value]="sort" etSelectionOption>{{ sort }}</et-chip>
          }
        </div>
      </div>

      <p class="text-sm opacity-60">Form value: {{ demoForm().value() | json }}</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHIP_IMPORTS, SelectionListDirective, SelectionOptionDirective, FormField, JsonPipe],
})
export class FilterChipsStorybookComponent {
  public readonly = input(false, { transform: booleanAttribute });

  protected readonly CATEGORIES = ['Shoes', 'Shirts', 'Pants', 'Accessories', 'Sale'];
  protected readonly SORTS = ['Relevance', 'Price', 'Newest'];

  private formModel = linkedSignal(() => ({
    categories: ['Shoes'] as string[],
    sortBy: 'Relevance' as string | null,
  }));

  public demoForm = form(this.formModel, (s) => {
    readonly(s, () => this.readonly());
  });
}
