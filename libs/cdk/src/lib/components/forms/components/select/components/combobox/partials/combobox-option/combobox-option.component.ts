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
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';
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
    '(mouseenter)': 'setActiveByHover()',
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

  protected readonly customOptionComponentInputs$ = combineLatest([
    this._option$,
    this.combobox.customOptionComponentInputs$,
  ]).pipe(map(([option, inputs]) => ({ option, ...inputs })));

  readonly hostClassBindings = signalHostClasses({
    'et-combobox-option--selected': toSignal(this.selected$),
    'et-combobox-option--disabled': toSignal(this.disabled$),
    'et-combobox-option--active': toSignal(this.active$),
  });

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-selected': toSignal(this.selected$),
    'aria-disabled': toSignal(this.disabled$),
  });

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

  protected setActiveByHover() {
    this.combobox._activeSelectionModel.setActiveOption(this.option);
  }
}
