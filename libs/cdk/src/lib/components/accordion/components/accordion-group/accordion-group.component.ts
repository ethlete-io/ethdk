import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  Input,
  ViewEncapsulation,
  booleanAttribute,
} from '@angular/core';
import { TypedQueryList, createDestroy } from '@ethlete/core';
import { combineLatest, map, pairwise, startWith, switchMap, takeUntil, tap } from 'rxjs';
import { ACCORDION_COMPONENT, AccordionComponent } from '../accordion';

@Component({
  selector: 'et-accordion-group',
  templateUrl: './accordion-group.component.html',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'et-accordion-group',
  },
})
export class AccordionGroupComponent implements AfterContentInit {
  private readonly _destroy$ = createDestroy();

  @Input({ transform: booleanAttribute })
  autoCloseOthers = false;

  @ContentChildren(ACCORDION_COMPONENT)
  private readonly _accordions?: TypedQueryList<AccordionComponent>;

  ngAfterContentInit(): void {
    if (!this._accordions) {
      return;
    }

    this._accordions.changes
      .pipe(
        startWith(this._accordions),
        map(
          (accordions) =>
            accordions
              ?.toArray()
              .filter((a): a is AccordionComponent => !!a)
              .map((a) => a.isOpen$) ?? [],
        ),
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

          for (const [i, item] of this._accordions
            ?.toArray()
            .filter((a): a is AccordionComponent => !!a)
            .entries() ?? [].entries()) {
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
