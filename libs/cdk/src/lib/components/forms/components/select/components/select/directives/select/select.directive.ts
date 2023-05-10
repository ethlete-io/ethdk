import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ComponentType } from '@angular/cdk/portal';
import {
  AfterContentInit,
  ContentChildren,
  Directive,
  InjectionToken,
  Input,
  TemplateRef,
  inject,
} from '@angular/core';
import { AnimatedOverlayComponentBase, AnimatedOverlayDirective, TypedQueryList, createDestroy } from '@ethlete/core';
import { BehaviorSubject, combineLatest, debounceTime, startWith, takeUntil, tap } from 'rxjs';
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
export class SelectDirective<T extends SelectDirectiveBodyComponentBase> implements AfterContentInit {
  private readonly _animatedOverlay = inject<AnimatedOverlayDirective<T>>(AnimatedOverlayDirective);
  private readonly _destroy$ = createDestroy();
  readonly input = inject(INPUT_TOKEN);

  private readonly _selectType$ = new BehaviorSubject<'listbox' | 'tree'>('listbox');
  private readonly _selectBodyId$ = new BehaviorSubject<string | null>(null);
  private readonly _isOpen$ = new BehaviorSubject(false);

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

  constructor() {
    this._animatedOverlay.placement = 'bottom';
  }

  ngAfterContentInit(): void {
    this._determineSelectType();
  }

  mountOrUnmountSelectBody(template: TemplateRef<unknown>, component: ComponentType<T>) {
    if (!this._animatedOverlay.isMounted) {
      const instance = this._animatedOverlay.mount({
        component: component,
        mirrorWidth: true,
        data: { _bodyTemplate: template } as Partial<T>,
      });

      if (!instance) return;

      this._selectBodyId$.next(instance.selectBody.id);
      this._isOpen$.next(true);
    } else {
      this._animatedOverlay.unmount();

      this._selectBodyId$.next(null);
      this._isOpen$.next(false);
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
}
