import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  A,
  DOWN_ARROW,
  END,
  ENTER,
  ESCAPE,
  HOME,
  LEFT_ARROW,
  PAGE_DOWN,
  PAGE_UP,
  RIGHT_ARROW,
  SPACE,
  UP_ARROW,
  hasModifierKey,
} from '@angular/cdk/keycodes';
import { ComponentType } from '@angular/cdk/portal';
import {
  AfterContentInit,
  ContentChildren,
  Directive,
  ElementRef,
  InjectionToken,
  Input,
  OnInit,
  TemplateRef,
  TrackByFunction,
  booleanAttribute,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActiveSelectionModel,
  AnimatedOverlayComponentBase,
  AnimatedOverlayDirective,
  SelectionModel,
  TypedQueryList,
  createDestroy,
  signalClasses,
  signalHostClasses,
  switchQueryListChanges,
} from '@ethlete/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, switchMap, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN } from '../../../../../../directives';
import { SELECT_FIELD_TOKEN } from '../../../../directives';
import { SelectBodyDirective } from '../select-body';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../select-option';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SELECT_TOKEN = new InjectionToken<SelectDirective<any>>('ET_SELECT_INPUT_TOKEN');

type SelectDirectiveBodyComponentBase = AnimatedOverlayComponentBase & {
  _bodyTemplate: TemplateRef<unknown> | null;
  selectBody: SelectBodyDirective;
};

let uniqueId = 0;

interface SelectBodyConfig<T extends SelectDirectiveBodyComponentBase> {
  component: ComponentType<T>;
  template: TemplateRef<unknown>;
}

@Directive({
  standalone: true,
  hostDirectives: [AnimatedOverlayDirective],
  providers: [
    {
      provide: SELECT_TOKEN,
      useExisting: SelectDirective,
    },
  ],
})
export class SelectDirective<T extends SelectDirectiveBodyComponentBase> implements OnInit, AfterContentInit {
  private _selectBodyConfig: SelectBodyConfig<T> | null = null;

  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<T>>(AnimatedOverlayDirective);
  private readonly _destroy$ = createDestroy();
  private readonly _liveAnnouncer = inject(LiveAnnouncer);
  private readonly _selectField = inject(SELECT_FIELD_TOKEN);

  readonly input = inject(INPUT_TOKEN);

  private readonly _selectBodyId$ = new BehaviorSubject<string | null>(null);
  private readonly _isOpen$ = new BehaviorSubject(false);

  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly _selectionModel = new SelectionModel<SelectOptionDirective>();
  private readonly _activeSelectionModel = new ActiveSelectionModel<SelectOptionDirective>();

  @Input()
  get multiple(): boolean {
    return this._multiple$.value;
  }
  set multiple(value: unknown) {
    this._multiple$.next(booleanAttribute(value));

    this._migrateSelectValue();
  }
  private _multiple$ = new BehaviorSubject(false);

  @Input()
  emptyText?: string;

  @ContentChildren(SELECT_OPTION_TOKEN, { descendants: true })
  private set _selectOptionsQueryList(value: TypedQueryList<SelectOptionDirective>) {
    this._selectOptionsQueryList$.next(value);
  }
  private readonly _selectOptionsQueryList$ = new BehaviorSubject<TypedQueryList<SelectOptionDirective> | null>(null);

  readonly selectOptions$ = this._selectOptionsQueryList$.pipe(
    switchQueryListChanges(),
    switchMap((queryList) => {
      if (!queryList) return of(null);

      const items = queryList.map((opt) =>
        combineLatest([opt.isSelected$, opt.isActive$]).pipe(map(([selected, active]) => ({ opt, selected, active }))),
      );

      return combineLatest(items ?? of(null));
    }),
  );

  readonly activeOption$ = this.selectOptions$.pipe(
    map((options) => {
      if (!options) return null;

      return options.find((option) => option.active) ?? null;
    }),
  );

  readonly selectedOptions$ = this.selectOptions$.pipe(
    map((options) => {
      if (!options) return null;

      const selectedOptions = options.filter((option) => option.selected);

      if (!selectedOptions.length) return null;

      const inputValue = this.input.value;

      if (this.multiple && Array.isArray(inputValue)) {
        // sort selected options by the order of the input value
        const selectedOptionsMap = new Map(selectedOptions.map((option) => [option.opt.value, option]));
        return inputValue
          .map((value) => selectedOptionsMap.get(value))
          .filter(
            (
              option,
            ): option is {
              opt: SelectOptionDirective;
              selected: boolean;
              active: boolean;
            } => !!option,
          );
      }

      return selectedOptions;
    }),
  );

  readonly selectedOption$ = this.selectedOptions$.pipe(map((options) => options?.[0] ?? null));

  readonly selectBodyId$ = this._selectBodyId$.asObservable();
  readonly isOpen$ = this._isOpen$.asObservable();
  readonly isOpen = toSignal(this.isOpen$);
  readonly multiple$ = this._multiple$.asObservable();

  readonly selectCurrentValueId = `et-select-current-value-${uniqueId++}`;

  readonly ariaViewValue$ = this.selectedOptions$.pipe(
    switchMap((options) => {
      if (!options?.length) return of(null);

      const viewValues = options.map((option) => option.opt.viewValue$);

      return combineLatest(viewValues);
    }),
    map((viewValues) => {
      if (!viewValues) return null;

      return viewValues.join(', ');
    }),
  );

  readonly activeDescendant$ = combineLatest([this.isOpen$, this.activeOption$]).pipe(
    map(([isOpen, activeOption]) => {
      if (!isOpen || !activeOption) return null;

      return activeOption.opt.id;
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

  constructor() {
    this._animatedOverlay.placement = 'bottom';
    this._animatedOverlay.fallbackPlacements = ['bottom', 'top'];
    this._animatedOverlay.autoResize = true;

    this.input._setEmptyHelper(this.ariaViewValue$);

    this._selectionModel
      .setOptionsFromQueryList$(this._selectOptionsQueryList$)
      .setLabelBinding((v) => v.viewValue)
      .setValueBinding((v) => v.value)
      .setDisabledBinding((v) => v.disabled);

    this._activeSelectionModel.setSelectionModel(this._selectionModel);

    //TODO: TO BE CONTINUED...
  }

  ngOnInit(): void {
    this._unmountSelectBodyOnDisable();
    this._migrateSelectValue();
  }

  ngAfterContentInit(): void {
    this._setSelectedOptionActive();
  }

  trackByFn: TrackByFunction<SelectOptionDirective> = (_, item) => item.id;

  mountSelectBody() {
    if (!this._selectBodyConfig) return;

    if (this._animatedOverlay.isMounted || this.input.disabled) return;

    this._setSelectedOptionActive();

    const instance = this._animatedOverlay.mount({
      component: this._selectBodyConfig.component,
      mirrorWidth: true,
      data: { _bodyTemplate: this._selectBodyConfig.template } as Partial<T>,
    });

    if (!instance) return;

    this._selectBodyId$.next(instance.selectBody.id);
    this._isOpen$.next(true);
  }

  unmountSelectBody() {
    if (!this._animatedOverlay.isMounted) return;

    this._animatedOverlay.unmount();

    this._selectBodyId$.next(null);
    this._isOpen$.next(false);
  }

  setValue(value: unknown) {
    this.input._updateValue(value);

    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (this._isOpen$.value) {
      this._handleKeyDownInOpenState(event);
    } else {
      this._handleKeyDownInClosedState(event);
    }
  }

  setSelectBody(config: SelectBodyConfig<T>) {
    this._selectBodyConfig = config;
  }

  removeOptionFromSelection(option: SelectOptionDirective) {
    if (!this.multiple || !Array.isArray(this.input.value)) return;

    const value = this.input.value.filter((v) => v !== option.value);

    this.setValue(value);
  }

  _controlTouched() {
    this.input._markAsTouched();
    this.input._setShouldDisplayError(true);
  }

  private _unmountSelectBodyOnDisable() {
    this.input.disabled$
      .pipe(
        tap((disabled) => {
          if (!disabled) return;

          this.unmountSelectBody();
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  private _handleKeyDownInClosedState(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isArrowKey =
      keyCode === DOWN_ARROW || keyCode === UP_ARROW || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW;

    const isOpenKey = keyCode === ENTER || keyCode === SPACE;

    if ((isOpenKey && !hasModifierKey(event)) || ((this.multiple || event.altKey) && isArrowKey)) {
      event.preventDefault();
      this.mountSelectBody();
    } else if (!this.multiple) {
      switch (keyCode) {
        case DOWN_ARROW:
          this._selectOptionByOffset(1, true);
          break;
        case UP_ARROW:
          this._selectOptionByOffset(-1, true);
          break;
        case HOME:
          this._selectFirstOption(true);
          break;
        case END:
          this._selectLastOption(true);
          break;
        case PAGE_UP:
          this._selectOptionByOffset(-10, true);
          break;
        case PAGE_DOWN:
          this._selectOptionByOffset(10, true);
          break;
      }
    } else if (this.multiple && isArrowKey) {
      event.preventDefault();
      this.mountSelectBody();
    }
  }

  private async _handleKeyDownInOpenState(event: KeyboardEvent) {
    const keyCode = event.keyCode;
    const isArrowKey = keyCode === DOWN_ARROW || keyCode === UP_ARROW;

    if (isArrowKey && event.altKey) {
      event.preventDefault();
      this.unmountSelectBody();
    } else if (keyCode === ESCAPE && !hasModifierKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      this.unmountSelectBody();
    } else if (keyCode === ENTER || keyCode === SPACE) {
      if (this.multiple) {
        this._toggleActiveOptionSelection();
      } else {
        this._setActiveOptionSelected();
      }

      event.preventDefault();
    } else if (this.multiple && keyCode === A && event.ctrlKey) {
      event.preventDefault();
      this._toggleSelectionOfAllOptions();
    } else {
      switch (keyCode) {
        case DOWN_ARROW:
          this._activateOptionByOffset(1);
          break;
        case UP_ARROW:
          this._activateOptionByOffset(-1);
          break;
        case HOME:
          this._activateFirstOption();
          break;
        case END:
          this._activateLastOption();
          break;
        case PAGE_UP:
          this._activateOptionByOffset(-10);
          break;
        case PAGE_DOWN:
          this._activateOptionByOffset(10);
          break;
      }
    }
  }

  private async _setActiveOption(option: SelectOptionDirective | null) {
    const currentActiveOption = await firstValueFrom(this.activeOption$);

    if (currentActiveOption?.opt === option) return false;

    currentActiveOption?.opt._setActive(false);

    if (option) {
      option._setActive(true);
    }

    return true;
  }

  private async _addActiveOptionToSelection() {
    const activeOption = await firstValueFrom(this.activeOption$);

    if (!activeOption || activeOption.opt.disabled || activeOption.selected) return;

    if (!Array.isArray(this.input.value)) {
      this.setValue([activeOption.opt.value]);
      return;
    }

    this.setValue([...this.input.value, activeOption.opt.value]);
  }

  private async _removeActiveOptionFromSelection() {
    const activeOption = await firstValueFrom(this.activeOption$);

    if (!activeOption || activeOption.opt.disabled || !activeOption.selected) return;

    if (!Array.isArray(this.input.value)) {
      this.setValue([]);
      return;
    }

    this.setValue(this.input.value.filter((value) => value !== activeOption.opt.value));
  }

  private async _toggleSelectionOfAllOptions() {
    const allOptions = await firstValueFrom(this.selectOptions$);

    const hasDeselectedOption = allOptions?.some((opt) => !opt.opt.disabled && !opt.selected);

    if (hasDeselectedOption) {
      this._selectAllOptions();
    } else {
      this._deselectAllOptions();
    }
  }

  private async _selectAllOptions() {
    const allOptions = await firstValueFrom(this.selectOptions$);

    if (!allOptions) return;

    const selectedOptions = allOptions.filter((opt) => !opt.opt.disabled).map((opt) => opt.opt.value);

    this.setValue(selectedOptions);
  }

  private async _deselectAllOptions() {
    this.setValue([]);
  }

  private async _toggleActiveOptionSelection() {
    const activeOption = await firstValueFrom(this.activeOption$);

    if (!activeOption) return;

    if (activeOption.selected) {
      this._removeActiveOptionFromSelection();
    } else {
      this._addActiveOptionToSelection();
    }
  }

  private async _setActiveOptionSelected() {
    const activeOption = await firstValueFrom(this.activeOption$);

    if (!activeOption || activeOption.opt.disabled) return;

    this._setSelectedOption(activeOption.opt);

    this.unmountSelectBody();
  }

  private async _setSelectedOptionActive() {
    const selectedOption = await firstValueFrom(this.selectedOption$);

    if (!selectedOption) return;

    this._setActiveOption(selectedOption.opt);
  }

  private async _setSelectedOption(option: SelectOptionDirective | null) {
    const selectedOption = await firstValueFrom(this.selectedOption$);

    if (selectedOption === option) return false;

    this._setActiveOption(option);

    this.setValue(option?.value ?? null);

    return true;
  }

  private async _selectFirstOption(announce: boolean) {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const firstOption = options[0]?.opt;

    if (!firstOption) return;

    if (!this._setSelectedOption(firstOption)) return;

    if (announce) {
      const text = await firstValueFrom(firstOption.viewValue$);
      this._liveAnnouncer.announce(text, 10000);
    }
  }

  private async _selectLastOption(announce: boolean) {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const lastOption = options[options.length - 1]?.opt;

    if (!lastOption) return;

    if (!this._setSelectedOption(lastOption)) return;

    if (announce) {
      const text = await firstValueFrom(lastOption.viewValue$);
      this._liveAnnouncer.announce(text, 10000);
    }
  }

  private async _selectOptionByOffset(offset: number, announce: boolean): Promise<void> {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const selectedOption = await firstValueFrom(this.selectedOption$);
    const selectedOptionIndex = options.findIndex((o) => o.opt === selectedOption?.opt);
    const nextOptionIndex = selectedOptionIndex + offset;
    const nextOption = options[nextOptionIndex];

    if (!nextOption) return;

    if (nextOption.opt.disabled) {
      return this._selectOptionByOffset(offset + (offset < 0 ? -1 : 1), announce);
    }

    if (!this._setSelectedOption(nextOption.opt)) return;

    if (announce) {
      const text = await firstValueFrom(nextOption.opt.viewValue$);
      this._liveAnnouncer.announce(text, 10000);
    }
  }

  private async _activateFirstOption() {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const firstOption = options[0]?.opt;

    if (!firstOption) return;

    await this._setActiveOption(firstOption);
  }

  private async _activateLastOption() {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const lastOption = options[options.length - 1]?.opt;

    if (!lastOption) return;

    await this._setActiveOption(lastOption);
  }

  private async _activateOptionByOffset(offset: number) {
    const options = await firstValueFrom(this.selectOptions$);

    if (!options) return;

    const activatedOption = await firstValueFrom(this.activeOption$);
    const activatedOptionIndex = options.findIndex((o) => o.opt === activatedOption?.opt);
    const nextOptionIndex = activatedOptionIndex + offset;
    const nextOption = options[nextOptionIndex];

    if (!nextOption) return;

    await this._setActiveOption(nextOption.opt);
  }

  private async _migrateSelectValue() {
    if (this.multiple && !Array.isArray(this.input.value)) {
      this.setValue([]);
    } else if (!this.multiple && Array.isArray(this.input.value)) {
      this.setValue(null);
    }

    this._setActiveOption(null);
  }
}
