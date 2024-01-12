import { ENTER, SPACE } from '@angular/cdk/keycodes';
import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes } from '@ethlete/core';
import { filter, fromEvent, merge } from 'rxjs';
import {
  InputBase,
  InputDirective,
  NativeInputRefDirective,
  RADIO_TOKEN,
  RadioDirective,
  StaticFormFieldDirective,
} from '../../../../../forms';
import { MENU_ITEM_TOKEN, MENU_TRIGGER_TOKEN, MenuItemDirective } from '../../directives';

@Component({
  selector: 'et-menu-radio-item',
  templateUrl: './menu-radio-item.component.html',
  styleUrl: './menu-radio-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-radio-item',
    role: 'menuitemradio',
    '[id]': 'input.id',
  },
  imports: [NgClass, AsyncPipe],
  hostDirectives: [
    NativeInputRefDirective,
    StaticFormFieldDirective,
    MenuItemDirective,
    { directive: RadioDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective, inputs: ['autocomplete'] },
  ],
})
export class MenuRadioItemComponent extends InputBase {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _trigger = inject(MENU_TRIGGER_TOKEN);

  protected readonly radio = inject(RADIO_TOKEN);
  protected readonly menuItem = inject(MENU_ITEM_TOKEN);

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-checked': toSignal(this.radio.checked$),
    'aria-required': toSignal(this.input.required$),
    'aria-disabled': toSignal(this.input.disabled$),
    'aria-describedby': toSignal(this.input.describedBy$),
  });

  constructor() {
    super();

    merge(
      fromEvent(this._elementRef.nativeElement, 'click'),
      fromEvent<KeyboardEvent>(this._elementRef.nativeElement, 'keydown').pipe(
        filter((e) => e.keyCode === SPACE || e.keyCode === ENTER),
      ),
    )
      .pipe(takeUntilDestroyed())
      .subscribe((e) => {
        if ('keyCode' in e) {
          e.preventDefault();

          if (e.keyCode === ENTER) {
            this._trigger.unmount();
          }
        }

        this.radio._onInputInteraction(e);
      });

    fromEvent(this._elementRef.nativeElement, 'blur')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.radio._controlTouched());

    this.menuItem._disableCloseOnInteraction();
  }
}
