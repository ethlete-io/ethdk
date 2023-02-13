import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  forwardRef,
  HostBinding,
  inject,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { DestroyService, ObserveResizeDirective, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, debounceTime, startWith, takeUntil, tap } from 'rxjs';
import { MasonryItemDirective, MASONRY_ITEM_TOKEN } from '../../directives';

@Component({
  selector: 'et-masonry',
  template: `<ng-content select="[etMasonryItem]" />`,
  styleUrls: ['./masonry.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-masonry',
  },
  imports: [],
  hostDirectives: [ObserveResizeDirective],
  providers: [DestroyService],
})
export class MasonryComponent implements AfterContentInit {
  private readonly _resizeObserver = inject(ObserveResizeDirective);
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  @ContentChildren(forwardRef(() => MASONRY_ITEM_TOKEN), { descendants: true })
  private readonly _items?: TypedQueryList<MasonryItemDirective>;

  @Input()
  @HostBinding('style.--_et-masonry-colum-width.px')
  get columWidth(): number {
    return this._columWidth$.getValue();
  }
  set columWidth(value: NumberInput) {
    this._columWidth$.next(coerceNumberProperty(value));
  }
  private _columWidth$ = new BehaviorSubject<number>(250);

  @Input()
  @HostBinding('style.--_et-masonry-gap.px')
  get gap(): number {
    return this._gap$.getValue();
  }
  set gap(value: NumberInput) {
    this._gap$.next(coerceNumberProperty(value));
  }
  private _gap$ = new BehaviorSubject<number>(16);

  ngAfterContentInit(): void {
    if (!this._items) {
      return;
    }

    combineLatest([
      this._items.changes.pipe(startWith(this._items)),
      this._resizeObserver.event.pipe(debounceTime(25)),
      this._columWidth$,
      this._gap$,
    ])
      .pipe(
        tap(([itemList, , , gap]) => {
          const dimensions = { rowGap: gap, rowHeight: 0 };

          for (const item of itemList.toArray()) {
            item.resize(dimensions);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }
}
