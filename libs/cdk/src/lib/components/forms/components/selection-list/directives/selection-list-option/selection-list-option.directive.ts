import { Directive, InjectionToken, Input, booleanAttribute, computed, inject, signal } from '@angular/core';
import { INPUT_TOKEN, InputDirective } from '../../../../directives';

export const SELECTION_LIST_OPTION = new InjectionToken<SelectionListOptionDirective>(
  'ET_SELECTION_LIST_OPTION_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  providers: [{ provide: SELECTION_LIST_OPTION, useExisting: SelectionListOptionDirective }],
  exportAs: 'etSelectionListOption',
  host: {
    class: 'et-selection-list-option',
    role: 'option',
    '[attr.aria-selected]': 'selected',
    '[attr.aria-disabled]': 'disabled',
    tabindex: '0',
  },
})
export class SelectionListOptionDirective {
  readonly input = inject<InputDirective<unknown[] | null>>(INPUT_TOKEN);

  @Input({ required: true })
  get value() {
    return this._value();
  }
  set value(value: unknown) {
    this._value.set(value);
  }
  private _value = signal<unknown>(undefined);

  @Input({ transform: booleanAttribute })
  get disabled(): boolean {
    return this._disabled();
  }
  set disabled(value: boolean) {
    this._disabled.set(value);
  }
  private _disabled = signal<boolean>(false);

  readonly selected = computed(() => {
    // TODO:
    return false;
  });
}
