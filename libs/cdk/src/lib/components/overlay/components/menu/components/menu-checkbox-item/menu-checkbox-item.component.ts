import { ENTER, SPACE } from '@angular/cdk/keycodes';
import { AsyncPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Type,
  ViewEncapsulation,
  forwardRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes } from '@ethlete/core';
import { combineLatest, filter, fromEvent, map, merge } from 'rxjs';
import {
  CHECKBOX_TOKEN,
  CheckboxDirective,
  DynamicFormFieldDirective,
  InputBase,
  InputDirective,
  NativeInputRefDirective,
  StaticFormFieldDirective,
  WriteableInputDirective,
} from '../../../../../forms';
import { MENU_ITEM_TOKEN, MENU_TRIGGER_TOKEN, MenuItemDirective } from '../../directives';

@Component({
  selector: 'et-menu-checkbox-item',
  templateUrl: './menu-checkbox-item.component.html',
  styleUrl: './menu-checkbox-item.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-menu-checkbox-item',
    role: 'menuitemcheckbox',
    '[id]': 'input.id',
  },
  imports: [NgClass, AsyncPipe],
  hostDirectives: [
    NativeInputRefDirective,
    StaticFormFieldDirective,
    WriteableInputDirective,
    MenuItemDirective,
    {
      directive: forwardRef(() => DynamicFormFieldDirective) as Type<DynamicFormFieldDirective>,
      inputs: ['hideErrorMessage'],
    },
    CheckboxDirective,
    { directive: InputDirective, inputs: ['autocomplete'] },
  ],
})
export class MenuCheckboxItemComponent extends InputBase {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _trigger = inject(MENU_TRIGGER_TOKEN);

  protected readonly checkbox = inject(CHECKBOX_TOKEN);
  protected readonly menuItem = inject(MENU_ITEM_TOKEN);

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-checked': toSignal(
      combineLatest([this.checkbox.checked$, this.checkbox.indeterminate$]).pipe(
        map(([checked, indeterminate]) => (checked ? true : indeterminate ? 'mixed' : false)),
      ),
    ),
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

        this.checkbox._onInputInteraction(e);
      });

    fromEvent(this._elementRef.nativeElement, 'blur')
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.checkbox._controlTouched());

    this.menuItem._disableCloseOnInteraction();
  }
}
