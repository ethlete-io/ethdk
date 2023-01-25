import { AutofillMonitor } from '@angular/cdk/text-field';
import { Directive, inject, InjectionToken, Input, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormControl, NgControl, Validators } from '@angular/forms';
import { DestroyService } from '@ethlete/core';
import { map, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { FormFieldStateService, InputControlType, InputStateService } from '../../services';
import { NativeInputRefDirective } from '../native-input-ref';

export const INPUT_TOKEN = new InjectionToken<InputDirective>('ET_INPUT_DIRECTIVE_TOKEN');

let nextUniqueId = 0;

@Directive({
  selector: '[etInput]',
  standalone: true,
  exportAs: 'etInput',
  host: {
    class: 'et-input',
    '[attr.autocomplete]': 'null',
  },
  providers: [{ provide: INPUT_TOKEN, useExisting: InputDirective }, DestroyService],
})
export class InputDirective<T = unknown> implements OnInit, OnDestroy {
  private readonly _inputStateService = inject<InputStateService<T>>(InputStateService);
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _ngControl = inject(NgControl, { optional: true });
  private readonly _destroy$ = inject(DestroyService).destroy$;
  private readonly _autofillMonitor = inject(AutofillMonitor);

  private _control!: AbstractControl;

  private readonly _id = `et-input-${++nextUniqueId}`;

  @Input()
  autocomplete: string | null = null;

  get id() {
    return this._id;
  }

  get value$() {
    return this._inputStateService.value$.asObservable();
  }

  get value() {
    return this._inputStateService.value$.getValue();
  }

  get valueChange$() {
    return this._inputStateService.valueChange$.asObservable();
  }

  get disabled$() {
    return this._inputStateService.disabled$.asObservable();
  }

  get disabled() {
    return this._inputStateService.disabled$.getValue();
  }

  get disabledChange$() {
    return this._inputStateService.disabledChange$.asObservable();
  }

  get required$() {
    return this._inputStateService.required$.asObservable();
  }

  get required() {
    return this._inputStateService.required$.getValue();
  }

  get requiredChange$() {
    return this._inputStateService.requiredChange$.asObservable();
  }

  get labelId$() {
    return this._formFieldStateService.labelId$.asObservable();
  }

  get labelId() {
    return this._formFieldStateService.labelId$.getValue();
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

  get usesImplicitControl$() {
    return this._inputStateService.usesImplicitControl$.asObservable();
  }

  get usesImplicitControl() {
    return this._inputStateService.usesImplicitControl$.getValue();
  }

  get nativeInputRef$() {
    return this._inputStateService.nativeInputRef$.asObservable();
  }

  get nativeInputRef() {
    return this._inputStateService.nativeInputRef$.getValue();
  }

  get autofilled$() {
    return this._inputStateService.autofilled$.asObservable();
  }

  get autofilled() {
    return this._inputStateService.autofilled$.getValue();
  }

  ngOnInit(): void {
    this._control = this._ngControl?.control ?? new FormControl();
    this._inputStateService.usesImplicitControl$.next(!this._ngControl?.control);

    this._control.statusChanges
      ?.pipe(
        startWith(this._control.status),
        tap(() => this._detectControlRequiredValidationChanges()),
        tap(() => this._detectControlDisabledChanges()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._control.valueChanges?.pipe(takeUntil(this._destroy$)).subscribe((value) => this._updateValue(value));

    this.nativeInputRef$
      .pipe(
        pairwise(),
        tap(([previousNativeInputRef, currentNativeInputRef]) => {
          if (previousNativeInputRef) {
            this._autofillMonitor.stopMonitoring(previousNativeInputRef.element.nativeElement);
          }

          if (currentNativeInputRef) {
            this._autofillMonitor
              .monitor(currentNativeInputRef.element.nativeElement)
              .pipe(takeUntil(this._destroy$))
              .subscribe((event) => this._setAutofilled(event.isAutofilled));
          } else {
            this._setAutofilled(false);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    if (this.nativeInputRef) {
      this._autofillMonitor.stopMonitoring(this.nativeInputRef.element.nativeElement);
    }
  }

  _updateValue(value: T, options: { emitEvent?: boolean } = {}) {
    if (value === this.value || this.disabled) {
      return;
    }

    const { emitEvent = true } = options;

    this._inputStateService.value$.next(value);

    if (this._control.value !== value) {
      this._inputStateService._valueChange(value);
    }

    if (emitEvent) {
      this._inputStateService.valueChange$.next(value);
    }
  }

  _updateDisabled(value: boolean) {
    if (value === this.disabled) {
      return;
    }

    this._inputStateService.disabled$.next(value);
    this._inputStateService.disabledChange$.next(value);
  }

  _markAsTouched() {
    if (this.disabled || this._control.touched) {
      return;
    }

    this._inputStateService._touched();
  }

  _setControlType(type: InputControlType) {
    this._formFieldStateService.controlType$.next(type);
  }

  _setNativeInputRef(ref: NativeInputRefDirective | null) {
    this._inputStateService.nativeInputRef$.next(ref);
  }

  _setAutofilled(value: boolean) {
    this._inputStateService.autofilled$.next(value);
  }

  private _detectControlRequiredValidationChanges() {
    const hasRequired = this._control.hasValidator(Validators.required) ?? false;
    const hasRequiredTrue = this._control.hasValidator(Validators.requiredTrue) ?? false;

    const isRequired = hasRequired || hasRequiredTrue;

    if (isRequired !== this.required) {
      this._inputStateService.required$.next(isRequired);
      this._inputStateService.requiredChange$.next(isRequired);
    }
  }

  private _detectControlDisabledChanges() {
    const isDisabled = this._control.disabled;

    if (isDisabled !== this.disabled) {
      this._inputStateService.disabled$.next(isDisabled);
      this._inputStateService.disabledChange$.next(isDisabled);
    }
  }
}
