import { ENTER, SPACE } from '@angular/cdk/keycodes';
import { AsyncPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  booleanAttribute,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes } from '@ethlete/core';
import { filter, fromEvent, merge } from 'rxjs';
import { RADIO_TOKEN, RadioDirective } from '../../../../../forms/components/radio/directives/radio';
import { InputDirective } from '../../../../../forms/directives/input';
import { NativeInputRefDirective } from '../../../../../forms/directives/native-input-ref';
import { StaticFormFieldDirective } from '../../../../../forms/directives/static-form-field';
import { InputBase } from '../../../../../forms/utils';
import { MENU_ITEM_TOKEN, MenuItemDirective } from '../../directives/menu-item';
import { MENU_TRIGGER_TOKEN } from '../../directives/menu-trigger';

@Component({
  selector: 'et-menu-radio-item',
  templateUrl: './menu-radio-item.component.html',
  styleUrl: './menu-radio-item.component.scss',
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

  closeOnInteraction = input(false, { transform: booleanAttribute });

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

    effect(() => {
      const closeOnInteraction = this.closeOnInteraction();

      untracked(() => {
        if (closeOnInteraction) {
          this.menuItem._enableCloseOnInteraction();
        } else {
          this.menuItem._disableCloseOnInteraction();
        }
      });
    });
  }
}
