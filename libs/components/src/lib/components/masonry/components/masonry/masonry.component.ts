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
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import { DestroyService, ObserveResizeDirective, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, startWith, takeUntil, tap } from 'rxjs';
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
export class MasonryComponent implements OnInit, AfterContentInit {
  private readonly _resizeObserver = inject(ObserveResizeDirective);
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;

  @ContentChildren(forwardRef(() => MASONRY_ITEM_TOKEN), { descendants: true })
  private readonly _items?: TypedQueryList<MasonryItemDirective>;

  private _lastColumnCount$ = new BehaviorSubject<number>(0);

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

  ngOnInit(): void {
    combineLatest([this._resizeObserver.event, this._columWidth$, this._gap$])
      .pipe(
        tap(([observerEvent, columWidth, gap]) => {
          const entry = observerEvent[0];

          const currentWidth = entry.target.clientWidth;
          const totalGap = gap * (Math.floor(currentWidth / columWidth) - 1);
          const columnCount = Math.floor((currentWidth - totalGap) / columWidth);

          if (columnCount !== this._lastColumnCount$.value) {
            this._lastColumnCount$.next(columnCount);
          }
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  ngAfterContentInit(): void {
    if (!this._items) {
      return;
    }

    combineLatest([
      this._items.changes.pipe(startWith(this._items)),
      this._lastColumnCount$,
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
