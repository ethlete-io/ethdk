import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, ElementRef, inject, Input } from '@angular/core';
import { createReactiveBindings, DestroyService } from '@ethlete/core';
import { BehaviorSubject, map, Observable } from 'rxjs';

type ButtonType = 'button' | 'submit' | 'reset' | 'menu';

@Directive({
  standalone: true,
  providers: [DestroyService],
})
export class ButtonDirective {
  readonly isButton = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'BUTTON';
  readonly isAnchor = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'A';

  @Input()
  get disabled(): boolean {
    return this._disabled$.value;
  }
  set disabled(value: BooleanInput) {
    this._disabled$.next(coerceBooleanProperty(value));
  }
  get disabled$(): Observable<boolean> {
    return this._disabled$.asObservable();
  }
  private _disabled$ = new BehaviorSubject(false);

  @Input()
  get type(): ButtonType {
    return this._type$.value;
  }
  set type(value: ButtonType) {
    this._type$.next(value);
  }
  get type$(): Observable<ButtonType> {
    return this._type$.asObservable();
  }
  private _type$ = new BehaviorSubject<ButtonType>('button');

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['disabled', 'aria-disabled'],
      observable: this.disabled$.pipe(
        map((disabled) => ({
          render: disabled,
          value: true,
        })),
      ),
    },
    {
      attribute: ['tabindex'],
      observable: this.disabled$.pipe(
        map((disabled) => ({
          render: disabled && this.isAnchor,
          value: -1,
        })),
      ),
    },
    {
      attribute: ['type'],
      observable: this.type$.pipe(
        map((type) => ({
          render: this.isButton,
          value: type,
        })),
      ),
    },
  );

  _removeDisabledBindings() {
    this._bindings.remove('disabled', 'aria-disabled');
  }

  _removeTabIndexBindings() {
    this._bindings.remove('tabindex');
  }
}
