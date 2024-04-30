import { Directive, ElementRef, Input, booleanAttribute, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, Observable, map } from 'rxjs';

type ButtonType = 'button' | 'submit' | 'reset' | 'menu';

@Directive({
  standalone: true,
  exportAs: 'etButton',
})
export class ButtonDirective {
  readonly isButton = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'BUTTON';
  readonly isAnchor = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName === 'A';

  @Input()
  get disabled(): boolean {
    return this._disabled$.value;
  }
  set disabled(value: unknown) {
    this._disabled$.next(booleanAttribute(value));
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

  @Input()
  get pressed(): boolean {
    return this._pressed$.value;
  }
  set pressed(value: unknown) {
    this._pressed$.next(booleanAttribute(value));
  }
  private _pressed$ = new BehaviorSubject(false);

  readonly hostAttributeBindings = signalHostAttributes({
    'disabled aria-disabled': toSignal(this.disabled$),
    'aria-pressed': toSignal(this._pressed$),

    ...(this.isAnchor ? { tabindex: toSignal(this.disabled$.pipe(map((disabled) => (disabled ? -1 : 0)))) } : {}),
    ...(this.isButton ? { type: toSignal(this.type$) } : {}),
  });

  readonly hostClassBindings = signalHostClasses({
    'et-pressed': toSignal(this._pressed$),
  });

  _removeDisabledBindings() {
    this.hostAttributeBindings.remove('disabled aria-disabled');
  }

  _removeTabIndexBindings() {
    this.hostAttributeBindings.remove('tabindex');
  }
}
