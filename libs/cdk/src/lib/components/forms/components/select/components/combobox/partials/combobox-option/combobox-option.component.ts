import { AsyncPipe, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, InjectionToken, ViewEncapsulation, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { createComponentId, signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { switchMap } from 'rxjs';
import { AbstractComboboxOption, COMBOBOX_TOKEN } from '../../directives/combobox';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const COMBOBOX_OPTION_TOKEN = new InjectionToken<ComboboxOptionComponent>('ET_COMBOBOX_OPTION_TOKEN');

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-combobox-option',
  templateUrl: './combobox-option.component.html',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-option et-legacy',
    '(mousedown)': '_ignoreBlur()',
    '(click)': '_selectOption()',
    '(mouseenter)': '_setActiveByHover()',
    '[attr.id]': 'id',
    role: 'option',
  },
  imports: [AsyncPipe, NgTemplateOutlet, NgComponentOutlet],
  providers: [
    {
      provide: COMBOBOX_OPTION_TOKEN,
      useExisting: ComboboxOptionComponent,
    },
  ],
})
export class ComboboxOptionComponent implements AbstractComboboxOption {
  combobox = inject(COMBOBOX_TOKEN);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly id = createComponentId('et-combobox-option');

  option = input.required<unknown>();

  option$ = toObservable(this.option);

  disabled = toSignal(this.option$.pipe(switchMap((o) => this.combobox.isOptionDisabled(o))));
  selected = toSignal(this.option$.pipe(switchMap((o) => this.combobox.isOptionSelected(o))));
  active = toSignal(this.option$.pipe(switchMap((o) => this.combobox.isOptionActive(o))));

  _customOptionComponentInputs = computed(() => {
    const inputs = this.combobox.optionComponentInputs();
    const option = this.option();

    return { ...(inputs ?? {}), option };
  });

  _hostClassBindings = signalHostClasses({
    'et-combobox-option--selected': this.selected,
    'et-combobox-option--disabled': this.disabled,
    'et-combobox-option--active': this.active,
  });

  _hostAttributeBindings = signalHostAttributes({
    'aria-selected': this.selected,
    'aria-disabled': this.disabled,
  });

  _selectOption() {
    if (this.combobox._selectionModel.isDisabled(this.option())) {
      return;
    }

    this.combobox.writeValueFromOption(this.option());
    this.combobox.focus();
    this.combobox.optionClick.emit(this.option());
    this.combobox.userInteraction.emit();
  }

  _ignoreBlur() {
    this.combobox._ignoreNextBlurEvent();
  }

  _setActiveByHover() {
    this.combobox._activeSelectionModel.setActiveOption(this.option());
  }
}
