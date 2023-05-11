import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
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
import { BehaviorSubject, combineLatest, debounceTime, map, of, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { INPUT_TOKEN } from '../../../../../../directives';
import { SelectBodyDirective } from '../select-body';
import { SELECT_OPTION_TOKEN, SelectOptionDirective } from '../select-option';
import { TREE_SELECT_OPTION_TOKEN, TreeSelectOptionDirective } from '../tree-select-option';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SELECT_TOKEN = new InjectionToken<SelectDirective<any>>('ET_SELECT_INPUT_TOKEN');

type SelectDirectiveBodyComponentBase = AnimatedOverlayComponentBase & {
  _bodyTemplate: TemplateRef<unknown> | null;
  selectBody: SelectBodyDirective;
};

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
  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<T>>(AnimatedOverlayDirective);
  private readonly _destroy$ = createDestroy();
  readonly input = inject(INPUT_TOKEN);

  private readonly _selectType$ = new BehaviorSubject<'listbox' | 'tree'>('listbox');
  private readonly _selectBodyId$ = new BehaviorSubject<string | null>(null);
  private readonly _isOpen$ = new BehaviorSubject(false);
  private readonly _selectedOption$ = new BehaviorSubject<TreeSelectOptionDirective | SelectOptionDirective | null>(
    null,
  );

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
  _selectOptions: TypedQueryList<SelectOptionDirective> | null = null;

  @ContentChildren(TREE_SELECT_OPTION_TOKEN, { descendants: true })
  _treeSelectOptions: TypedQueryList<TreeSelectOptionDirective> | null = null;

  readonly selectType$ = this._selectType$.asObservable();
  readonly selectBodyId$ = this._selectBodyId$.asObservable();
  readonly isOpen$ = this._isOpen$.asObservable();
  readonly selectedOption$ = this._selectedOption$.asObservable();

  readonly activeDescendant$ = combineLatest([this.isOpen$, this.selectedOption$]).pipe(
    map(([isOpen, selectedOption]) => {
      if (!isOpen || !selectedOption) return null;

      return selectedOption.id;
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
    this._determineSelectType();
    this._watchAndUpdateSelectedOption();
  }

  mountSelectBody(template: TemplateRef<unknown>, component: ComponentType<T>) {
    if (this._animatedOverlay.isMounted || this.input.disabled) return;

    const instance = this._animatedOverlay.mount({
      component: component,
      mirrorWidth: true,
      data: { _bodyTemplate: template } as Partial<T>,
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

  private _determineSelectType() {
    if (!this._selectOptions || !this._treeSelectOptions) return;

    combineLatest([
      this._selectOptions.changes.pipe(startWith(this._selectOptions)),
      this._treeSelectOptions.changes.pipe(startWith(this._treeSelectOptions)),
    ])
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(0),
        tap(([selectOptions, treeSelectOptions]) => {
          if (selectOptions.length && treeSelectOptions.length) {
            throw new Error('SelectDirective: Cannot have both select and tree select options');
          }

          if (selectOptions.length) {
            this._selectType$.next('listbox');
          }

          if (treeSelectOptions.length) {
            this._selectType$.next('tree');
          }
        }),
      )
      .subscribe();
  }

  private _watchAndUpdateSelectedOption() {
    if (!this._selectOptions || !this._treeSelectOptions) return;

    combineLatest([
      this._selectOptions.changes.pipe(startWith(this._selectOptions)),
      this._treeSelectOptions.changes.pipe(startWith(this._treeSelectOptions)),
      this.selectType$,
    ])
      .pipe(
        switchMap(([selectOptions, treeSelectOptions, type]) => {
          const options =
            type === 'listbox'
              ? selectOptions.filter((o): o is SelectOptionDirective => !!o)
              : treeSelectOptions.filter((o): o is TreeSelectOptionDirective => !!o);

          if (!options.length) return of(null);

          return combineLatest(options.map((opt) => opt.selected$.pipe(map((selected) => ({ opt, selected })))));
        }),
        takeUntil(this._destroy$),
        debounceTime(0),
        tap((options) => {
          if (!options) {
            this._selectedOption$.next(null);
            return;
          }

          const selectedOption = options.find(({ selected }) => selected)?.opt ?? null;

          this._selectedOption$.next(selectedOption);
        }),
      )
      .subscribe();
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
    // const keyCode = event.keyCode;
    // const isArrowKey =
    //   keyCode === DOWN_ARROW ||
    //   keyCode === UP_ARROW ||
    //   keyCode === LEFT_ARROW ||
    //   keyCode === RIGHT_ARROW;
    // const isOpenKey = keyCode === ENTER || keyCode === SPACE;
    // const manager = this._keyManager;
    // // Open the select on ALT + arrow key to match the native <select>
    // if (
    //   (!manager.isTyping() && isOpenKey && !hasModifierKey(event)) ||
    //   ((this.multiple || event.altKey) && isArrowKey)
    // ) {
    //   event.preventDefault(); // prevents the page from scrolling down when pressing space
    //   this.open();
    // } else if (!this.multiple) {
    //   const previouslySelectedOption = this.selected;
    //   manager.onKeydown(event);
    //   const selectedOption = this.selected;
    //   // Since the value has changed, we need to announce it ourselves.
    //   if (selectedOption && previouslySelectedOption !== selectedOption) {
    //     // We set a duration on the live announcement, because we want the live element to be
    //     // cleared after a while so that users can't navigate to it using the arrow keys.
    //     this._liveAnnouncer.announce((selectedOption as MatOption).viewValue, 10000);
    //   }
    // }
  }

  private _handleKeyDownInOpenState(event: KeyboardEvent) {
    // const manager = this._keyManager;
    // const keyCode = event.keyCode;
    // const isArrowKey = keyCode === DOWN_ARROW || keyCode === UP_ARROW;
    // const isTyping = manager.isTyping();
    // if (isArrowKey && event.altKey) {
    //   // Close the select on ALT + arrow key to match the native <select>
    //   event.preventDefault();
    //   this.close();
    //   // Don't do anything in this case if the user is typing,
    //   // because the typing sequence can include the space key.
    // } else if (
    //   !isTyping &&
    //   (keyCode === ENTER || keyCode === SPACE) &&
    //   manager.activeItem &&
    //   !hasModifierKey(event)
    // ) {
    //   event.preventDefault();
    //   manager.activeItem._selectViaInteraction();
    // } else if (!isTyping && this._multiple && keyCode === A && event.ctrlKey) {
    //   event.preventDefault();
    //   const hasDeselectedOptions = this.options.some(opt => !opt.disabled && !opt.selected);
    //   this.options.forEach(option => {
    //     if (!option.disabled) {
    //       hasDeselectedOptions ? option.select() : option.deselect();
    //     }
    //   });
    // } else {
    //   const previouslyFocusedIndex = manager.activeItemIndex;
    //   manager.onKeydown(event);
    //   if (
    //     this._multiple &&
    //     isArrowKey &&
    //     event.shiftKey &&
    //     manager.activeItem &&
    //     manager.activeItemIndex !== previouslyFocusedIndex
    //   ) {
    //     manager.activeItem._selectViaInteraction();
    //   }
    // }
  }
}
