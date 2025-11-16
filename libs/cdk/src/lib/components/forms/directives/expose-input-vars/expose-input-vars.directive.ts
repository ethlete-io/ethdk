import { FocusOrigin } from '@angular/cdk/a11y';
import {
  ChangeDetectorRef,
  Directive,
  inject,
  InjectionToken,
  Input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { createDestroy } from '@ethlete/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { InputValueUpdateType } from '../../types';
import { InputDirective } from '../input/input.directive';

export interface ExposeInputVarsContext {
  shouldDisplayError: boolean;
  autofilled: boolean;
  disabled: boolean;
  isFocusedVia: FocusOrigin;
  lastUpdateType: InputValueUpdateType | null;
  value: unknown;
}

type ObservableValueType<T extends Observable<unknown>> = T extends Observable<infer J> ? J : never;

export const EXPOSE_INPUT_VARS_TOKEN = new InjectionToken<ExposeInputVarsDirective>('ET_EXPOSE_INPUT_VARS_TOKEN');

@Directive({
  selector: '[etExposeInputVars]',

  providers: [
    {
      provide: EXPOSE_INPUT_VARS_TOKEN,
      useExisting: ExposeInputVarsDirective,
    },
  ],
})
export class ExposeInputVarsDirective {
  private readonly _cdr = inject(ChangeDetectorRef);
  private readonly _destroy$ = createDestroy();
  private readonly _monitorStop$ = new Subject<void>();
  private readonly _templateRef = inject(TemplateRef);
  private readonly _viewContainerRef = inject(ViewContainerRef);

  private _viewContext: ExposeInputVarsContext = {
    shouldDisplayError: false,
    autofilled: false,
    disabled: false,
    isFocusedVia: null,
    lastUpdateType: null,
    value: null,
  };

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input('etExposeInputVars')
  set explicitInput(input: InputDirective | null | undefined) {
    if (!input) return;

    this._monitorInput(input);
  }

  constructor() {
    this._viewContainerRef.createEmbeddedView(this._templateRef, this._viewContext);
  }

  static ngTemplateContextGuard(dir: ExposeInputVarsDirective, ctx: unknown): ctx is ExposeInputVarsContext {
    return true;
  }

  _monitorInput(input: InputDirective) {
    this._monitorStop$.next();

    this._monitorObservable(input.shouldDisplayError$, (shouldDisplayError) =>
      this._updateView({
        shouldDisplayError,
      }),
    );

    this._monitorObservable(input.autofilled$, (autofilled) =>
      this._updateView({
        autofilled,
      }),
    );

    this._monitorObservable(input.disabled$, (disabled) =>
      this._updateView({
        disabled,
      }),
    );

    this._monitorObservable(input.isFocusedVia$, (isFocusedVia) =>
      this._updateView({
        isFocusedVia,
      }),
    );

    this._monitorObservable(input.lastUpdateType$, (lastUpdateType) =>
      this._updateView({
        lastUpdateType,
      }),
    );

    this._monitorObservable(input.value$, (value) =>
      this._updateView({
        value,
      }),
    );
  }

  private _monitorObservable<T extends Observable<unknown>, J extends ObservableValueType<T>>(
    observable: T,
    callback: (value: J) => void,
  ) {
    observable.pipe(takeUntil(this._monitorStop$), takeUntil(this._destroy$)).subscribe((v) => callback(v as J));
  }

  private _updateView(context: Partial<ExposeInputVarsContext>) {
    Object.assign(this._viewContext, context);

    this._cdr.markForCheck();
  }
}
