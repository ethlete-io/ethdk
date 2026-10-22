import { JsonPipe } from '@angular/common';
import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { CHIP_IMPORTS, SelectionListDirective, SelectionOptionDirective } from '@ethlete/components';

@Component({
  selector: 'app-chip-filter-chips-example',
  template: `
    <span>Categories (multiple)</span>
    <div [formField]="filterForm.CATEGORIES" multiple etSelectionList>
      @for (category of CATEGORIES; track category) {
        <et-chip [value]="category" etSelectionOption>{{ category }}</et-chip>
      }
    </div>

    <span>Sort by (single)</span>
    <div [formField]="filterForm.sortBy" etSelectionList>
      @for (sort of SORTS; track sort) {
        <et-chip [value]="sort" etSelectionOption>{{ sort }}</et-chip>
      }
    </div>

    <p>Form value: {{ filterForm().value() | json }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CHIP_IMPORTS, SelectionListDirective, SelectionOptionDirective, FormField, JsonPipe],
})
export class ChipFilterChipsExampleComponent {
  protected readonly CATEGORIES = ['Shoes', 'Shirts', 'Pants', 'Accessories', 'Sale'];
  protected readonly SORTS = ['Relevance', 'Price', 'Newest'];

  private model = signal({ CATEGORIES: ['Shoes'] as string[], sortBy: 'Relevance' as string | null });

  protected filterForm = form(this.model);
}
