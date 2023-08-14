import { Directive, InjectionToken, Input, booleanAttribute, signal } from '@angular/core';

export const SELECTION_LIST_FIELD = new InjectionToken<SelectionListFieldDirective>(
  'ET_SELECTION_LIST_FIELD_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  providers: [{ provide: SELECTION_LIST_FIELD, useExisting: SelectionListFieldDirective }],
  exportAs: 'etSelectionListField',
  host: {
    class: 'et-selection-list-field',
    role: 'listbox',
    '[attr.aria-multiselectable]': 'multiple',
    '[attr.aria-disabled]': 'disabled',
  },
})
export class SelectionListFieldDirective {
  @Input({ transform: booleanAttribute })
  get multiple(): boolean {
    return this._multiple();
  }
  set multiple(value: boolean) {
    this._multiple.set(value);
  }
  private _multiple = signal<boolean>(false);
}
