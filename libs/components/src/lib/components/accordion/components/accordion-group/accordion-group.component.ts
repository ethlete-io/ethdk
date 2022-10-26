import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  Input,
  OnDestroy,
  QueryList,
  ViewEncapsulation,
} from '@angular/core';
import { combineLatest, map, pairwise, startWith, Subject, switchMap, takeUntil, tap } from 'rxjs';
import { ACCORDION, AccordionComponent } from '../accordion/accordion.component';

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
export class AccordionGroupComponent implements AfterContentInit, OnDestroy {
  @Input()
  get autoCloseOthers(): boolean {
    return this._autoCloseOthers;
  }
  set autoCloseOthers(value: BooleanInput) {
    this._autoCloseOthers = coerceBooleanProperty(value);
  }
  private _autoCloseOthers = false;

  @ContentChildren(ACCORDION)
  accordions?: QueryList<AccordionComponent>;

  private _destroy$ = new Subject<boolean>();

  ngAfterContentInit(): void {
    if (!this.accordions) {
      return;
    }

    this.accordions.changes
      .pipe(
        startWith(this.accordions),
        map(() => this.accordions?.toArray().map((a) => a.isOpen$) ?? []),
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

          for (const [i, item] of this.accordions?.toArray().entries() ?? [].entries()) {
            if (i !== isOpenedNow && item.isOpen$.value) {
              item.close();
            }
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this._destroy$.next(true);
    this._destroy$.unsubscribe();
  }
}
