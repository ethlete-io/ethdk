import { Directive, inject, InjectionToken, OnInit } from '@angular/core';
import { NgControl, Validators } from '@angular/forms';
import { DestroyService } from '@ethlete/core';
import { map, startWith, takeUntil, tap } from 'rxjs';
import { InputControlType, InputStateService } from '../../services';

export const INPUT_TOKEN = new InjectionToken<InputDirective>('ET_INPUT_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  selector: '[etInput]',
  standalone: true,
  exportAs: 'etInput',
  host: {
    class: 'et-input',
  },
  providers: [{ provide: INPUT_TOKEN, useExisting: InputDirective }, DestroyService],
})
export class InputDirective<T = unknown> implements OnInit {
  private readonly _inputStateService = inject<InputStateService<T>>(InputStateService);
  private readonly _control = inject(NgControl);
  private readonly _destroy$ = inject(DestroyService).destroy$;

  private readonly _id = `et-input-${++nextUniqueId}`;

  get id() {
    return this._id;
  }

  get value$() {
    return this._inputStateService.value$.asObservable();
  }

  get value() {
    return this._inputStateService.value$.getValue();
  }

  get disabled$() {
    return this._inputStateService.disabled$.asObservable();
  }

  get disabled() {
    return this._inputStateService.disabled$.getValue();
  }

  get required$() {
    return this._inputStateService.required$.asObservable();
  }

  get required() {
    return this._inputStateService.required$.getValue();
  }

  get labelId$() {
    return this._inputStateService.labelId$.asObservable();
  }

  get labelId() {
    return this._inputStateService.labelId$.getValue();
  }

  get invalid$() {
    return this._control.statusChanges?.pipe(
      startWith(this._control.status),
      map((s) => s === 'INVALID'),
    );
  }

  get invalid() {
    return this._control.invalid;
  }

  ngOnInit(): void {
    this._control.statusChanges
      ?.pipe(
        startWith(this._control.status),
        tap(() => this._detectControlRequiredValidationChanges()),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  _updateValue(value: T) {
    if (value === this.value || this.disabled) {
      return;
    }

    this._inputStateService.value$.next(value);
    this._inputStateService._valueChange(value);
  }

  _updateDisabled(value: boolean) {
    this._inputStateService.disabled$.next(value);
  }

  _markAsTouched() {
    this._inputStateService._touched();
  }

  _detectControlRequiredValidationChanges() {
    const hasRequired = this._control.control?.hasValidator?.(Validators.required) ?? false;
    const hasRequiredTrue = this._control.control?.hasValidator?.(Validators.requiredTrue) ?? false;

    const isRequired = hasRequired || hasRequiredTrue;

    if (isRequired !== this.required) {
      this._inputStateService.required$.next(isRequired);
    }
  }

  _setControlType(type: InputControlType) {
    this._inputStateService.controlType$.next(type);
  }
}
