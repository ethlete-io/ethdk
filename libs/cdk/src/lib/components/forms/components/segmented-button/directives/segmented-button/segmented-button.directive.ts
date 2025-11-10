import { Directive, InjectionToken, Input, booleanAttribute, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Primitive, signalHostClasses } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const SEGMENTED_BUTTON_TOKEN = new InjectionToken<SegmentedButtonDirective>(
  'ET_SEGMENTED_BUTTON_DIRECTIVE_TOKEN',
);

@Directive({
  providers: [{ provide: SEGMENTED_BUTTON_TOKEN, useExisting: SegmentedButtonDirective }],
  exportAs: 'etSegmentedButton',
})
export class SegmentedButtonDirective {
  private readonly _activeIndicatorElement$ = new BehaviorSubject<HTMLElement | null>(null);
  readonly input = inject<InputDirective<Primitive>>(INPUT_TOKEN);

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: Primitive) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<Primitive>(null);

  @Input()
  get disabled(): boolean {
    return this._disabled$.getValue();
  }
  set disabled(value: unknown) {
    this._disabled$.next(booleanAttribute(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly checked$ = combineLatest([this.input.value$, this._value$]).pipe(
    map(([inputValue, value]) => inputValue === value),
  );

  readonly disabled$ = combineLatest([this.input.disabled$, this._disabled$]).pipe(
    map(([inputDisabled, disabled]) => inputDisabled || disabled),
  );

  readonly hostClassBindings = signalHostClasses({
    'et-segmented-button--checked': toSignal(this.checked$),
    'et-segmented-button--disabled': toSignal(this.disabled$),
  });

  get activeIndicatorElement$() {
    return this._activeIndicatorElement$.asObservable();
  }

  get activeIndicatorElement() {
    return this._activeIndicatorElement$.getValue();
  }

  _setActiveIndicatorElement(element: HTMLElement) {
    this._activeIndicatorElement$.next(element);
  }

  _onInputInteraction(event: Event) {
    event.stopPropagation();

    if (this.disabled) {
      return;
    }

    this.input._updateValue(this.value);

    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }
}
