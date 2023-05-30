import { FocusMonitor, FocusOrigin } from '@angular/cdk/a11y';
import { AutofillMonitor } from '@angular/cdk/text-field';
import { Directive, ElementRef, InjectionToken, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, NgControl, Validators } from '@angular/forms';
import { createDestroy, equal } from '@ethlete/core';
import { combineLatest, debounceTime, filter, map, pairwise, startWith, takeUntil, tap } from 'rxjs';
import { FormFieldStateService, InputStateService } from '../../services';
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
  providers: [{ provide: INPUT_TOKEN, useExisting: InputDirective }],
})
export class InputDirective<
  T = unknown,
  J extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement = HTMLInputElement,
> implements OnInit, OnDestroy
{
  private readonly _inputStateService = inject<InputStateService<T, J>>(InputStateService);
  private readonly _formFieldStateService = inject(FormFieldStateService);
  private readonly _ngControl = inject(NgControl, { optional: true });
  private readonly _destroy$ = createDestroy();
  private readonly _autofillMonitor = inject(AutofillMonitor);
  private readonly _focusMonitor = inject(FocusMonitor);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private _implicitControl?: FormControl<unknown>;

  private get control() {
    if (!this._ngControl) {
      if (!this._implicitControl) {
        this._implicitControl = new FormControl();
      }

      return this._implicitControl;
    }

    if (!this._ngControl.control) {
      throw new Error('NgControl.control can only be accessed after construction phase');
    }

    return this._ngControl.control;
  }

  private readonly _id = `et-input-${++nextUniqueId}`;

  @Input()
  autocomplete: string | null = null;

  @Input()
  placeholder: string | null = null;

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
    return this.control.statusChanges.pipe(
      startWith(this.control.status),
      map((s) => s === 'INVALID'),
    );
  }

  get invalid() {
    return this.control.invalid;
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

  get errors$() {
    return this._inputStateService.errors$.asObservable();
  }

  get errors() {
    return this._inputStateService.errors$.getValue();
  }

  get shouldDisplayError$() {
    return this._inputStateService.shouldDisplayError$.asObservable();
  }

  get shouldDisplayError() {
    return this._inputStateService.shouldDisplayError$.getValue();
  }

  get isFocusedVia$() {
    return this._inputStateService.isFocusedVia$.asObservable();
  }

  get isFocusedVia() {
    return this._inputStateService.isFocusedVia$.getValue();
  }

  get errorId$() {
    return this._formFieldStateService.errorId$.asObservable();
  }

  get errorId() {
    return this._formFieldStateService.errorId$.getValue();
  }

  readonly describedBy$ = this._formFieldStateService.describedBy$;

  constructor() {
    this._inputStateService.usesImplicitControl$.next(!this._ngControl);
  }

  ngOnInit(): void {
    const controlStateChanges$ = combineLatest([
      this.control.statusChanges.pipe(startWith(this.control.status)),
      this.control.valueChanges.pipe(startWith(this.control.value)),
    ]).pipe(
      debounceTime(0),
      map(([status, value]) => ({ status, value })),
    );

    controlStateChanges$
      .pipe(
        map(() => this.control.errors),
        filter((errors) => !equal(errors, this.errors)),
        tap((errors) => this._inputStateService.errors$.next(errors)),
        takeUntil(this._destroy$),
      )
      .subscribe();

    controlStateChanges$
      .pipe(
        tap(() => this._detectControlRequiredValidationChanges()),
        tap(() => this._detectControlDisabledChanges()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this.control.valueChanges?.pipe(takeUntil(this._destroy$)).subscribe((value) => this._updateValue(value));

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

    this._focusMonitor
      .monitor(this._elementRef, true)
      .pipe(
        tap((origin) => {
          this._inputStateService.isFocusedVia$.next(origin);
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

  focusInputVia(origin: FocusOrigin = 'program') {
    const inputEl = this.nativeInputRef?.element?.nativeElement;

    if (inputEl) {
      this._focusMonitor.focusVia(inputEl, origin);
    }
  }

  _updateValue(value: T, options: { emitEvent?: boolean } = {}) {
    if (value === this.value || this.disabled) {
      return;
    }

    const { emitEvent = true } = options;

    this._inputStateService.value$.next(value);

    if (this.control.value !== value) {
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
    if (this.disabled || this.control.touched) {
      return;
    }

    this._inputStateService._touched();
  }

  _setNativeInputRef(ref: NativeInputRefDirective<J> | null) {
    if (this.nativeInputRef === ref) {
      return;
    }

    this._inputStateService.nativeInputRef$.next(ref);
  }

  _setAutofilled(value: boolean) {
    if (this.autofilled === value) {
      return;
    }

    this._inputStateService.autofilled$.next(value);
  }

  _setShouldDisplayError(value: boolean) {
    if (this.shouldDisplayError === value) {
      return;
    }

    this._inputStateService.shouldDisplayError$.next(value);
  }

  private _detectControlRequiredValidationChanges() {
    const hasRequired = this.control.hasValidator(Validators.required) ?? false;
    const hasRequiredTrue = this.control.hasValidator(Validators.requiredTrue) ?? false;

    const isRequired = hasRequired || hasRequiredTrue;

    if (isRequired !== this.required) {
      this._inputStateService.required$.next(isRequired);
      this._inputStateService.requiredChange$.next(isRequired);
    }
  }

  private _detectControlDisabledChanges() {
    const isDisabled = this.control.disabled;

    if (isDisabled !== this.disabled) {
      this._inputStateService.disabled$.next(isDisabled);
      this._inputStateService.disabledChange$.next(isDisabled);
    }
  }
}
