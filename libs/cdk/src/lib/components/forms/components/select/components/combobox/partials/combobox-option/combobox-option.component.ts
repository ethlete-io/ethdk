import { AsyncPipe, NgComponentOutlet, NgIf, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Input,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { AbstractComboboxOption, COMBOBOX_TOKEN } from '../../directives';
import { isOptionDisabled } from '../../utils';

export const COMBOBOX_OPTION_TOKEN = new InjectionToken<ComboboxOptionComponent>('ET_COMBOBOX_OPTION_TOKEN');

let _uniqueId = 0;

@Component({
  selector: 'et-combobox-option',
  templateUrl: './combobox-option.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-option',
    '(mousedown)': 'ignoreBlur()',
    '(click)': 'selectOption()',
    '[attr.id]': 'id',
    role: 'option',
  },
  imports: [AsyncPipe, NgIf, NgTemplateOutlet, NgComponentOutlet],
  hostDirectives: [],
  providers: [
    {
      provide: COMBOBOX_OPTION_TOKEN,
      useExisting: ComboboxOptionComponent,
    },
  ],
})
export class ComboboxOptionComponent implements AbstractComboboxOption {
  readonly id = `et-combobox-option-${_uniqueId++}`;

  protected readonly combobox = inject(COMBOBOX_TOKEN);

  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true })
  get option() {
    return this._option$.value;
  }
  set option(value: unknown) {
    this._option$.next(value);
  }
  readonly _option$ = new BehaviorSubject<unknown>(null);

  protected readonly disabled$ = this._option$.pipe(map((opt) => isOptionDisabled(opt)));

  protected readonly selected$ = this._option$.pipe(switchMap((opt) => this.combobox.isOptionSelected(opt)));

  protected readonly active$ = this._option$.pipe(switchMap((opt) => this.combobox.isOptionActive(opt)));

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-combobox-option--selected',
      observable: this.selected$,
    },
    {
      attribute: 'class.et-combobox-option--disabled',
      observable: this.disabled$,
    },
    {
      attribute: 'class.et-combobox-option--active',
      observable: this.active$,
    },
    {
      attribute: 'aria-selected',
      observable: this.selected$.pipe(
        map((selected) => ({
          render: true,
          value: selected,
        })),
      ),
    },
    {
      attribute: 'aria-diabled',
      observable: this.disabled$.pipe(
        map((selected) => ({
          render: true,
          value: selected,
        })),
      ),
    },
  );

  protected selectOption() {
    if (isOptionDisabled(this.option)) {
      return;
    }

    this.combobox.writeValueFromOption(this.option);
    this.combobox.focus();
  }

  protected ignoreBlur() {
    this.combobox._ignoreNextBlurEvent();
  }
}
