import { AsyncPipe, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, InjectionToken, Input, ViewEncapsulation, inject } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, map, switchMap } from 'rxjs';
import { COMBOBOX_TOKEN } from '../../components';
import { isOptionDisabled } from '../../utils';

export const COMBOBOX_OPTION_TOKEN = new InjectionToken<ComboboxOptionComponent>('ET_COMBOBOX_OPTION_TOKEN');

@Component({
  selector: 'et-combobox-option',
  templateUrl: './combobox-option.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-combobox-option',
    '(click)': 'selectOption()',
  },
  imports: [AsyncPipe, NgIf, NgTemplateOutlet],
  hostDirectives: [],
  providers: [
    {
      provide: COMBOBOX_OPTION_TOKEN,
      useExisting: ComboboxOptionComponent,
    },
  ],
})
export class ComboboxOptionComponent {
  protected readonly combobox = inject(COMBOBOX_TOKEN);

  @Input({ required: true })
  get option() {
    return this._option$.value;
  }
  set option(value: unknown) {
    this._option$.next(value);
  }
  private _option$ = new BehaviorSubject<unknown>(null);

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
  );

  protected selectOption() {
    if (isOptionDisabled(this.option)) {
      return;
    }

    this.combobox.writeValueFromOption(this.option);
  }
}
