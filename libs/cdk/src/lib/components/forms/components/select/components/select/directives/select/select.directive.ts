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
  private readonly _selectedOption$ = new BehaviorSubject<SelectOptionDirective | null>(null);

  private readonly _currentSearchTerm$ = new BehaviorSubject<string>('');

  @Input()
  get searchable(): boolean {
    return this._searchable$.value;
  }
  set searchable(value: BooleanInput) {
    this._searchable$.next(coerceBooleanProperty(value));
  }
  private _searchable$ = new BehaviorSubject(false);

  @Input()
  get multiple(): boolean {
    return this._multiple$.value;
  }
  set multiple(value: BooleanInput) {
    this._multiple$.next(coerceBooleanProperty(value));
  }
  get multiple$() {
    return this._multiple$.asObservable();
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
        .map((opt) => opt.selected$.pipe(map((selected) => ({ opt, selected }))));

      return combineLatest(items ?? of(null));
    }),
  );

  readonly filteredSelectOptions$ = combineLatest([this.selectOptions$, this._currentSearchTerm$]).pipe(
    switchMap(([options]) => {
      if (!options?.length) return of(null);

      return combineLatest(
        options.map((o) =>
          combineLatest([o.opt.shouldRender$, o.opt.disabled$]).pipe(
            map(([shouldRender, disabled]) => {
              if (!shouldRender || disabled) return null;

              return o;
            }),
          ),
        ),
      );
    }),
    map((options) => options?.filter((o): o is { opt: SelectOptionDirective; selected: boolean } => !!o) ?? null),
  );

  readonly selectBodyId$ = this._selectBodyId$.asObservable();
  readonly isOpen$ = this._isOpen$.asObservable();
  readonly selectedOption$ = this._selectedOption$.asObservable();
  readonly searchable$ = this._searchable$.asObservable();
  readonly currentSearchTerm$ = this._currentSearchTerm$.asObservable();

  readonly selectCurrentValueId = `et-select-current-value-${uniqueId++}`;

  readonly activeDescendant$ = combineLatest([this.isOpen$, this.selectedOption$]).pipe(
    map(([isOpen, selectedOption]) => {
      if (!isOpen || !selectedOption) return null;

      return selectedOption.id;
    }),
  );

  readonly owns$ = combineLatest([this.isOpen$, this.selectBodyId$, this._searchable$]).pipe(
    map(([isOpen, selectBodyId, searchable]) => {
      if (!isOpen || !selectBodyId) {
        if (searchable) return null;

        return this.selectCurrentValueId;
      }

      if (searchable) {
        return `${selectBodyId}`;
      }

      return `${this.selectCurrentValueId} ${selectBodyId}`;
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
    this._watchAndUpdateSelectedOption();
  }

  mountSelectBody() {
    if (!this._selectBodyConfig) return;

    if (this._animatedOverlay.isMounted || this.input.disabled) return;

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

  searchItems(event: Event) {
    const target = event.target as HTMLInputElement;
    this._currentSearchTerm$.next(target.value?.toLowerCase().trim() || '');

    if (!this._isOpen$.value) {
      this.mountSelectBody();
    }
  }

  private _watchAndUpdateSelectedOption() {
    this.selectOptions$.pipe(
      takeUntil(this._destroy$),
      tap((options) => {
        if (!options) {
          this._selectedOption$.next(null);
          return;
        }

        const selectedOption = options.find(({ selected }) => selected);

        this._setSelectedOption(selectedOption?.opt ?? null);
      }),
    );
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
      if (this.searchable && keyCode === SPACE) {
        return;
      }

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
    } else if ((keyCode === ENTER || keyCode === SPACE || keyCode === ESCAPE) && !hasModifierKey(event)) {
      if (this.searchable) {
        if (keyCode === SPACE) return;

        if (keyCode === ESCAPE) {
          this._updateSearchInputValue();
        }
      }

      event.preventDefault();
      this.unmountSelectBody();
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
          this._selectOptionByOffset(1, false);
          break;
        case UP_ARROW:
          this._selectOptionByOffset(-1, false);
          break;
        case HOME:
          this._selectFirstOption(false);
          break;
        case END:
          this._selectLastOption(false);
          break;
        case PAGE_UP:
          this._selectOptionByOffset(-10, false);
          break;
        case PAGE_DOWN:
          this._selectOptionByOffset(10, false);
          break;
      }
    }
  }

  private _setSelectedOption(option: SelectOptionDirective | null) {
    if (this._selectedOption$.value === option) return false;

    this._selectedOption$.next(option);

    this._updateSearchInputValue();

    return true;
  }

  private async _selectFirstOption(announce: boolean) {
    const options = await firstValueFrom(this.filteredSelectOptions$);

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
    const options = await firstValueFrom(this.filteredSelectOptions$);

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
    const options = await firstValueFrom(this.filteredSelectOptions$);

    if (!options) return;

    const selectedOption = this._selectedOption$.value;
    const selectedOptionIndex = options.findIndex((o) => o.opt === selectedOption);
    const nextOptionIndex = selectedOptionIndex + offset;
    const nextOption = options[nextOptionIndex];

    if (!nextOption) return;

    if (!this._setSelectedOption(nextOption.opt)) return;

    if (announce) {
      const text = await firstValueFrom(nextOption.opt.viewValue$);
      this._liveAnnouncer.announce(text, 10000);
    }
  }

  private async _updateSearchInputValue() {
    const value = await firstValueFrom(this.selectedOption$.pipe(switchMap((o) => o?.viewValue$ ?? of(''))));

    this._currentSearchTerm$.next(value);

    if (this.input.nativeInputRef) {
      this.input.nativeInputRef.element.nativeElement.value = value;
    }
  }
}
