import { A, BACKSPACE, DOWN_ARROW, ENTER, ESCAPE, SPACE, TAB, UP_ARROW, hasModifierKey } from '@angular/cdk/keycodes';
import { ComponentType } from '@angular/cdk/portal';
import {
  ContentChildren,
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  OnInit,
  Signal,
  TemplateRef,
  TrackByFunction,
  booleanAttribute,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActiveSelectionModel,
  AnimatedOverlayComponentBase,
  AnimatedOverlayDirective,
  SelectionModel,
  THEME_PROVIDER,
  TypedQueryList,
  createDestroy,
  scrollToElement,
  setInputSignal,
  signalClasses,
  signalHostClasses,
} from '@ethlete/core';
import { Placement } from '@floating-ui/dom';
import { BehaviorSubject, combineLatest, debounceTime, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { OverlayCloseBlockerDirective } from '../../../../../../../overlay/directives/overlay-close-auto-blocker';
import { INPUT_TOKEN } from '../../../../../../directives/input';
import { SELECT_FIELD_TOKEN } from '../../../../directives/select-field';
import { SelectKeyHandlerResult } from '../../private';
import { SelectBodyDirective } from '../select-body';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../select-option';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SELECT_TOKEN = new InjectionToken<SelectDirective<any>>('ET_SELECT_INPUT_TOKEN');

type SelectDirectiveBodyComponentBase = AnimatedOverlayComponentBase & {
  _bodyTemplate: TemplateRef<unknown> | null;
  _containerElementRef: Signal<ElementRef<HTMLElement> | undefined>;
  selectBody: SelectBodyDirective;
};

let uniqueId = 0;

interface SelectBodyConfig<T extends SelectDirectiveBodyComponentBase> {
  component: ComponentType<T>;
  template: TemplateRef<unknown>;
}

@Directive({
  hostDirectives: [AnimatedOverlayDirective, OverlayCloseBlockerDirective],
  providers: [
    {
      provide: SELECT_TOKEN,
      useExisting: SelectDirective,
    },
  ],
})
export class SelectDirective<T extends SelectDirectiveBodyComponentBase> implements OnInit {
  private _selectBodyConfig: SelectBodyConfig<T> | null = null;

  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<T>>(AnimatedOverlayDirective);
  private readonly _destroy$ = createDestroy();
  private readonly _selectField = inject(SELECT_FIELD_TOKEN);
  private readonly _themeProvider = inject(THEME_PROVIDER, { optional: true });

  readonly input = inject(INPUT_TOKEN);

  private readonly _selectBodyId$ = new BehaviorSubject<string | null>(null);
  private readonly _isOpen$ = new BehaviorSubject(false);

  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly _selectionModel = new SelectionModel<SelectOptionDirective>();
  readonly _activeSelectionModel = new ActiveSelectionModel<SelectOptionDirective>();

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  set multiple(value: unknown) {
    this._selectionModel.setAllowMultiple(booleanAttribute(value));
  }

  readonly emptyText = input<string>();

  readonly optionClick = output<unknown>();

  readonly userInteraction = output();

  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  // TODO: Skipped for migration because:
  //  Accessor queries cannot be migrated as they are too complex.
  @ContentChildren(SELECT_OPTION_TOKEN, { descendants: true })
  private set _selectOptionsQueryList(value: TypedQueryList<SelectOptionDirective>) {
    this._selectOptionsQueryList$.next(value);
  }
  private readonly _selectOptionsQueryList$ = new BehaviorSubject<TypedQueryList<SelectOptionDirective> | null>(null);

  readonly selectBodyId$ = this._selectBodyId$.asObservable();
  readonly isOpen$ = this._isOpen$.asObservable();
  readonly isOpen = toSignal(this.isOpen$);
  readonly multiple$ = this._selectionModel.allowMultiple$;

  readonly selectCurrentValueId = `et-select-current-value-${uniqueId++}`;

  readonly ariaViewValue$ = this._selectionModel.selection$.pipe(
    switchMap((options) => {
      if (!options?.length) return of(null);

      const viewValues = options.map((option) => option.viewValue$);

      return combineLatest(viewValues);
    }),
    map((viewValues) => {
      if (!viewValues) return null;

      return viewValues.join(', ');
    }),
  );

  readonly ariaViewValue = toSignal(this.ariaViewValue$);

  readonly activeDescendant$ = combineLatest([this.isOpen$, this._activeSelectionModel.activeOption$]).pipe(
    map(([isOpen, activeOption]) => {
      if (!isOpen || !activeOption) return null;

      return activeOption.id;
    }),
  );

  readonly owns$ = combineLatest([this.isOpen$, this.selectBodyId$]).pipe(
    map(([isOpen, selectBodyId]) => {
      if (!isOpen || !selectBodyId) {
        return null;
      }

      return selectBodyId;
    }),
  );

  readonly labelledBy$ = this.input.labelId$.pipe(
    map((labelId) => {
      const ids = [labelId, this.selectCurrentValueId];

      return ids.filter((id) => !!id).join(' ');
    }),
  );

  readonly hostClassBindings = signalHostClasses({
    'et-select--is-open': this.isOpen,
    'et-select--disabled': toSignal(this.input.disabled$),
  });

  readonly fieldHostClassBindings = signalClasses(this._selectField.elementRef, {
    'et-select-field--open': this.isOpen,
    'et-select-field--multiple': toSignal(this.multiple$),
  });

  readonly inputElement = viewChild<ElementRef<HTMLElement> | null>('inputElement');

  constructor() {
    setInputSignal(this._animatedOverlay.mirrorWidth, true);
    setInputSignal(this._animatedOverlay.placement, 'bottom');
    setInputSignal(this._animatedOverlay.fallbackPlacements, ['bottom', 'top'] satisfies Placement[]);
    setInputSignal(this._animatedOverlay.autoResize, true);

    this.input._setEmptyHelper(this.ariaViewValue$);

    this._selectionModel
      .setOptionsFromQueryList$(this._selectOptionsQueryList$)
      .setLabelBinding((v) => v.viewValue)
      .setValueBinding((v) => v.value)
      .setDisabledBinding((v) => v.disabled);

    this._activeSelectionModel.setSelectionModel(this._selectionModel);
  }

  ngOnInit(): void {
    this._closeBodyOnDisable();

    this._selectionModel.setSelectionFromValue$(this.input.value);

    this._selectionModel.value$
      .pipe(
        takeUntil(this._destroy$),
        tap((value) => this.input._updateValue(value)),
      )
      .subscribe();

    this.input.onExternalUpdate$
      .pipe(
        takeUntil(this._destroy$),
        tap(() => this._selectionModel.setSelectionFromValue$(this.input.value)),
      )
      .subscribe();
  }

  trackByFn: TrackByFunction<SelectOptionDirective> = (_, item) => item.id;

  open() {
    if (!this._selectBodyConfig) return;

    if (this._animatedOverlay.isMounted() || this.input.disabled) return;

    const instance = this._animatedOverlay.mount({
      component: this._selectBodyConfig.component,

      themeProvider: this._themeProvider,
      data: { _bodyTemplate: this._selectBodyConfig.template } as Partial<T>,
    });

    if (!instance) return;

    this._selectBodyId$.next(instance.selectBody.id);
    this._isOpen$.next(true);

    this._activeSelectionModel.activeOption$
      .pipe(
        debounceTime(0),
        tap((activeOption) => {
          if (!activeOption) return;

          scrollToElement({
            container: instance._containerElementRef()?.nativeElement,
            element: activeOption._elementRef.nativeElement,
            behavior: 'instant',
          });
        }),
        takeUntil(this._destroy$),
        takeUntil(this._animatedOverlay.afterClosed$),
      )
      .subscribe();

    this._animatedOverlay.afterClosed$
      .pipe(
        takeUntil(this._destroy$),
        tap(() => {
          this._selectBodyId$.next(null);
          this._isOpen$.next(false);
        }),
      )
      .subscribe();
  }

  close() {
    if (!this._animatedOverlay.isMounted()) return;

    this._animatedOverlay.unmount();
  }

  clearValue() {
    this._selectionModel.clearSelectedOptions();
    this.input._markAsTouched();
  }

  writeValueFromOption(option: SelectOptionDirective) {
    this.input._markAsTouched();

    if (this._selectionModel.allowMultiple) {
      this._selectionModel.toggleSelectedOption(option);
    } else {
      this._selectionModel.addSelectedOption(option);
    }

    if (!this._selectionModel.allowMultiple) {
      this.close();
    }
  }

  focus() {
    this.inputElement()?.nativeElement.focus();
  }

  setSelectBody(config: SelectBodyConfig<T>) {
    this._selectBodyConfig = config;
  }

  removeOptionFromSelection(option: SelectOptionDirective) {
    this._selectionModel.removeSelectedOption(option);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  _processKeydownEvent(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isOpen = this.isOpen();
    const isMultiple = this._selectionModel.allowMultiple;
    const selection = this._selectionModel.selection;
    const isArrowKey = keyCode === UP_ARROW || keyCode === DOWN_ARROW;
    const isAltPressed = hasModifierKey(event, 'altKey');

    const result: SelectKeyHandlerResult<SelectOptionDirective> = {};

    if (isArrowKey && isAltPressed && !isOpen) {
      result.overlayOperation = 'open';
      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === ENTER) {
      event.preventDefault();
      event.stopPropagation();

      const activeOption = this._activeSelectionModel.activeOption;

      if (activeOption && this._selectionModel.isDisabled(activeOption)) return;

      if (activeOption) {
        if (isMultiple) {
          result.optionAction = { type: 'toggle', option: activeOption };
        } else {
          result.optionAction = { type: 'add', option: activeOption };
        }
      }

      if (!isMultiple) {
        result.overlayOperation = 'close';
      }

      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === ESCAPE) {
      if (isOpen) {
        result.overlayOperation = 'close';
        event.preventDefault();
        event.stopPropagation();
      }

      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === TAB) {
      result.overlayOperation = 'close';
      return this._interpretKeyHandlerResult(result);
    }

    if (keyCode === BACKSPACE) {
      const lastSelectedOption = selection[selection.length - 1];

      if (isMultiple && lastSelectedOption) {
        result.optionAction = { type: 'remove', option: lastSelectedOption };
        return this._interpretKeyHandlerResult(result);
      }
    }

    if (keyCode === SPACE) {
      result.overlayOperation = 'open';

      return this._interpretKeyHandlerResult(result);
    }

    const newActiveOption = this._activeSelectionModel.evaluateKeyboardEvent(event, { skipDisabled: !isOpen });

    if (newActiveOption && !isOpen && !isMultiple) {
      result.optionAction = { type: 'add', option: newActiveOption };
    }

    if (keyCode === A && event.ctrlKey && isMultiple) {
      result.optionAction = 'toggleAll';
      event.preventDefault();
    }

    return this._interpretKeyHandlerResult(result);
  }

  private _interpretKeyHandlerResult(result: SelectKeyHandlerResult<SelectOptionDirective>) {
    if (result.overlayOperation === 'close') {
      this.close();
    } else if (result.overlayOperation === 'open') {
      this.open();
    }

    if (result.optionAction) {
      if (typeof result.optionAction === 'string') {
        if (result.optionAction === 'clear') {
          this._selectionModel.clearSelectedOptions();
        } else if (result.optionAction === 'toggleAll') {
          this._selectionModel.toggleAllSelectedOptions();
        }
      } else {
        const { type, option } = result.optionAction;

        if (this._selectionModel.isDisabled(option)) return;

        if (type === 'add') {
          this._selectionModel.addSelectedOption(option);
        }

        if (type === 'remove') {
          this._selectionModel.removeSelectedOption(option);
        }

        if (type === 'toggle') {
          this._selectionModel.toggleSelectedOption(option);
        }

        this.optionClick.emit(option.value);
      }

      this.userInteraction.emit();
    }
  }

  private _closeBodyOnDisable() {
    this.input.disabled$
      .pipe(
        tap((disabled) => {
          if (!disabled) return;

          this.close();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}
