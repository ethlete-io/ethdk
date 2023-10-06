import { Directive, ElementRef, InjectionToken, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClickOutsideDirective, createDestroy, signalHostAttributes } from '@ethlete/core';
import { takeUntil, tap } from 'rxjs';
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
    role: 'listbox',
  },
  hostDirectives: [ClickOutsideDirective],
})
export class SelectBodyDirective implements OnInit {
  private readonly _destroy$ = createDestroy();
  readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _select = inject(SELECT_TOKEN);
  private readonly _clickOutside = inject(ClickOutsideDirective);

  readonly id = `et-select-body-${uniqueId++}`;

  readonly hostAttributeBindings = signalHostAttributes({
    'aria-multiselectable': toSignal(this._select.multiple$),
    'aria-labelledby': toSignal(this._select.input.labelId$),
  });

  ngOnInit(): void {
    this._clickOutside.etClickOutside
      .pipe(
        takeUntil(this._destroy$),
        tap(() => this._select.close()),
      )
      .subscribe();
  }
}
