import { Directive, ElementRef, InjectionToken, Input, inject } from '@angular/core';
import { ObserveContentDirective } from '@ethlete/core';
import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';
import { SELECT_TOKEN } from '../select';

export const TREE_SELECT_OPTION_TOKEN = new InjectionToken<TreeSelectOptionDirective>('ET_TREE_SELECT_OPTION_TOKEN');

let uniqueId = 0;

@Directive({
  standalone: true,
  providers: [
    {
      provide: TREE_SELECT_OPTION_TOKEN,
      useExisting: TreeSelectOptionDirective,
    },
  ],
  host: {
    '[attr.id]': 'id',
    role: 'treeitem',
  },
  hostDirectives: [ObserveContentDirective],
})
export class TreeSelectOptionDirective {
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _content$ = inject(ObserveContentDirective).valueChange;

  readonly id = `et-tree-select-option-${uniqueId++}`;

  @Input({ required: true })
  get value() {
    return this._value$.value;
  }
  set value(value: unknown) {
    this._value$.next(value);
  }
  private _value$ = new BehaviorSubject<unknown>(null);

  readonly selected$ = combineLatest([this._select.input.value$, this._value$]).pipe(
    map(([selectValue, optionValue]) => selectValue === optionValue),
  );

  readonly viewValue$ = this._content$.pipe(
    map((mutations) => mutations[0].target.textContent),
    startWith(this._elementRef.nativeElement.textContent),
    map((value) => value?.trim() ?? ''),
  );
}
