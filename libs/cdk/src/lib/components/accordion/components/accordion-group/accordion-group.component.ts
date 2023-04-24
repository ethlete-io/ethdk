import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  inject,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { DestroyService, TypedQueryList } from '@ethlete/core';
import { combineLatest, map, pairwise, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { AccordionComponent, ACCORDION_COMPONENT } from '../accordion';

@Component({
  selector: 'et-accordion-group',
  templateUrl: './accordion-group.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'et-accordion-group',
  },
  providers: [DestroyService],
})
export class AccordionGroupComponent implements AfterContentInit {
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  @Input()
  get autoCloseOthers(): boolean {
    return this._autoCloseOthers;
  }
  set autoCloseOthers(value: BooleanInput) {
    this._autoCloseOthers = coerceBooleanProperty(value);
  }
  private _autoCloseOthers = false;

  @ContentChildren(ACCORDION_COMPONENT)
  private readonly _accordions?: TypedQueryList<AccordionComponent>;

  ngAfterContentInit(): void {
    if (!this._accordions) {
      return;
    }

    this._accordions.changes
      .pipe(
        startWith(this._accordions),
        map((accordions) => accordions?.toArray().map((a) => a.isOpen$) ?? []),
        switchMap((d) => combineLatest(d)),
        pairwise(),
        tap(([prev, curr]) => {
          if (!this.autoCloseOthers) {
            return;
          }

          const isOpenedNow = curr.findIndex((a, i) => a && !prev[i]);

          if (isOpenedNow === -1) {
            return;
          }

          for (const [i, item] of this._accordions?.toArray().entries() ?? [].entries()) {
            if (i !== isOpenedNow && item.isOpen) {
              item.close();
            }
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}
