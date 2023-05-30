import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { Directive, InjectionToken, Input, inject } from '@angular/core';
import { createReactiveBindings } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { INPUT_TOKEN, InputDirective } from '../../../../directives';
import { SegmentedButtonValue } from '../../types';

export const SEGMENTED_BUTTON_TOKEN = new InjectionToken<SegmentedButtonDirective>(
  'ET_SEGMENTED_BUTTON_DIRECTIVE_TOKEN',
);

@Directive({
  standalone: true,
  providers: [{ provide: SEGMENTED_BUTTON_TOKEN, useExisting: SegmentedButtonDirective }],
  exportAs: 'etSegmentedButton',
})
export class SegmentedButtonDirective {
  private readonly _activeIndicatorElement$ = new BehaviorSubject<HTMLElement | null>(null);
  readonly input = inject<InputDirective<SegmentedButtonValue>>(INPUT_TOKEN);

  @Input()
  get value() {
    return this._value$.getValue();
  }
  set value(value: SegmentedButtonValue) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<SegmentedButtonValue>(null);

  @Input()
  get disabled(): boolean {
    return this._disabled$.getValue();
  }
  set disabled(value: BooleanInput) {
    this._disabled$.next(coerceBooleanProperty(value));
  }
  private _disabled$ = new BehaviorSubject(false);

  readonly checked$ = combineLatest([this.input.value$, this._value$]).pipe(
    map(([inputValue, value]) => inputValue === value),
  );

  readonly disabled$ = combineLatest([this.input.disabled$, this._disabled$]).pipe(
    map(([inputDisabled, disabled]) => inputDisabled || disabled),
  );

  readonly _bindings = createReactiveBindings(
    {
      attribute: ['class.et-segmented-button--checked'],
      observable: this.checked$,
    },
    {
      attribute: ['class.et-segmented-button--disabled'],
      observable: this.disabled$,
    },
  );

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
