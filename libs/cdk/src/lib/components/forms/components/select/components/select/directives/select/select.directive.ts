import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
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
  InjectionToken,
  Input,
  OnInit,
  TemplateRef,
  inject,
} from '@angular/core';
import {
  AnimatedOverlayComponentBase,
  AnimatedOverlayDirective,
  TypedQueryList,
  createDestroy,
  createReactiveBindings,
} from '@ethlete/core';
import { BehaviorSubject, combineLatest, firstValueFrom, map, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN } from '../../../../../../directives';
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
  readonly input = inject(INPUT_TOKEN);

  private readonly _selectBodyId$ = new BehaviorSubject<string | null>(null);
  private readonly _isOpen$ = new BehaviorSubject(false);

  @Input()
  get multiple(): boolean {
    return this._multiple$.value;
  }
  set multiple(value: BooleanInput) {
    this._multiple$.next(coerceBooleanProperty(value));
  }
  private _multiple$ = new BehaviorSubject(false);

  @ContentChildren(SELECT_OPTION_TOKEN, { descendants: true })
  private set _selectOptionsQueryList(value: TypedQueryList<SelectOptionDirective>) {
    this._selectOptionsQueryList$.next(value);
  }
  private readonly _selectOptionsQueryList$ = new BehaviorSubject<TypedQueryList<SelectOptionDirective> | null>(null);

  readonly selectOptions$ = this._selectOptionsQueryList$.pipe(
    switchMap((queryList) => queryList?.changes.pipe(startWith(queryList)) ?? of(null)),
    switchMap((queryList) => {
      if (!queryList) return of(null);

      const items = queryList
        .filter((i): i is SelectOptionDirective => !!i)
        .map((opt) =>
          combineLatest([opt.isSelected$, opt.isActive$]).pipe(
            map(([selected, active]) => ({ opt, selected, active })),
          ),
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

  readonly selectedOption$ = this.selectOptions$.pipe(
    map((options) => {
      if (!options) return null;

      return options.find((option) => option.selected) ?? null;
    }),
  );

  readonly selectBodyId$ = this._selectBodyId$.asObservable();
  readonly isOpen$ = this._isOpen$.asObservable();
  readonly multiple$ = this._multiple$.asObservable();

  readonly selectCurrentValueId = `et-select-current-value-${uniqueId++}`;

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

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'class.et-select--is-open',
      observable: this.isOpen$,
    },
    {
      attribute: 'class.et-select--disabled',
      observable: this.input.disabled$,
    },
  );

  constructor() {
    this._animatedOverlay.placement = 'bottom';
  }

  ngOnInit(): void {
    this._unmountSelectBodyOnDisable();
  }

  ngAfterContentInit(): void {
    this._setSelectedOptionActive();
  }

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
      this.unmountSelectBody();
    } else if (keyCode === ENTER || keyCode === SPACE) {
      this._setActiveOptionSelected();

      event.preventDefault();
    } else if (this.multiple && keyCode === A && event.ctrlKey) {
      event.preventDefault();

      // const hasDeselectedOptions = this.options.some(opt => !opt.disabled && !opt.selected);
      // this.options.forEach(option => {
      //   if (!option.disabled) {
      //     hasDeselectedOptions ? option.select() : option.deselect();
      //   }
      // });
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
}
