import { Directive, InjectionToken, OnInit, inject } from '@angular/core';
import { ClickOutsideDirective, createDestroy, createReactiveBindings } from '@ethlete/core';
import { map, takeUntil, tap } from 'rxjs';
import { SELECT_TOKEN } from '../select';

export const SELECT_BODY_TOKEN = new InjectionToken<SelectBodyDirective>('ET_SELECT_BODY_TOKEN');

let uniqueId = 0;

@Directive({
  standalone: true,
  providers: [
    {
      provide: SELECT_BODY_TOKEN,
      useExisting: SelectBodyDirective,
    },
  ],
  host: {
    '[attr.id]': 'id',
    tabindex: '-1',
  },
  hostDirectives: [ClickOutsideDirective],
})
export class SelectBodyDirective implements OnInit {
  private readonly _destroy$ = createDestroy();

  private readonly _select = inject(SELECT_TOKEN);
  private readonly _clickOutside = inject(ClickOutsideDirective);

  readonly id = `et-select-body-${uniqueId++}`;

  readonly _bindings = createReactiveBindings(
    {
      attribute: 'aria-multiselectable',
      observable: this._select.multiple$.pipe(
        map((multiple) => ({
          render: true,
          value: multiple,
        })),
      ),
    },
    {
      attribute: 'aria-labelledby',
      observable: this._select.input.labelId$.pipe(
        map((labelId) => ({
          render: !!labelId,
          value: labelId as string,
        })),
      ),
    },
    {
      attribute: 'role',
      observable: this._select.selectType$.pipe(
        map((type) => ({
          render: true,
          value: type,
        })),
      ),
    },
  );

  ngOnInit(): void {
    this._clickOutside.etClickOutside
      .pipe(
        takeUntil(this._destroy$),
        tap(() => this._select.unmountSelectBody()),
      )
      .subscribe();
  }
}
