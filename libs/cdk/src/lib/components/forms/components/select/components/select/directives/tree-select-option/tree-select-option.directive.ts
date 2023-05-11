import { Directive, InjectionToken, Input, TemplateRef, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
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
})
export class TreeSelectOptionDirective {
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _optionTemplate$ = new BehaviorSubject<TemplateRef<unknown> | null>(null);

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

  readonly optionTemplate$ = this._optionTemplate$.asObservable();

  _setOptionTemplate(templateRef: TemplateRef<unknown> | null) {
    this._optionTemplate$.next(templateRef);
  }
}
