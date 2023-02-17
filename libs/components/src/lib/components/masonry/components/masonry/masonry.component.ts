import { coerceNumberProperty, NumberInput } from '@angular/cdk/coercion';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  forwardRef,
  inject,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { createReactiveBindings, DestroyService, ObserveResizeDirective, TypedQueryList } from '@ethlete/core';
import { BehaviorSubject, combineLatest, debounceTime, of, startWith, switchMap, takeUntil, tap, timer } from 'rxjs';
import { MasonryItemComponent, MASONRY_ITEM_TOKEN } from '../../partials';

@Component({
  selector: 'et-masonry',
  template: `
    <div (etObserveResize)="setResizeEvent($event)"></div>
    <ng-content select="[etMasonryItem], et-masonry-item" />
  `,
  styleUrls: ['./masonry.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-masonry',
  },
  imports: [ObserveResizeDirective],
  providers: [DestroyService],
})
export class MasonryComponent implements AfterContentInit {
  private readonly _destroy$ = inject(DestroyService, { host: true }).destroy$;
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @ContentChildren(forwardRef(() => MASONRY_ITEM_TOKEN), { descendants: true })
  private readonly _items?: TypedQueryList<MasonryItemComponent>;

  @Input()
  get columWidth(): number {
    return this._columWidth$.getValue() || 1;
  }
  set columWidth(value: NumberInput) {
    this._columWidth$.next(coerceNumberProperty(value));
  }
  private _columWidth$ = new BehaviorSubject<number>(250);

  @Input()
  get gap(): number {
    return this._gap$.getValue() || 0;
  }
  set gap(value: NumberInput) {
    this._gap$.next(coerceNumberProperty(value));
  }
  private _gap$ = new BehaviorSubject<number>(16);

  private readonly _didResize$ = new BehaviorSubject<unknown>(null);
  private readonly _didInitialize$ = new BehaviorSubject(false);

  readonly _bindings = createReactiveBindings({
    attribute: 'class.et-masonry--initialized',
    observable: this._didInitialize$,
  });

  ngAfterContentInit(): void {
    if (!this._items) {
      return;
    }

    combineLatest([this._items.changes.pipe(startWith(this._items)), this._didResize$, this._columWidth$, this._gap$])
      .pipe(
        debounceTime(1),
        tap(() => this.repaint()),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._items.changes
      .pipe(
        startWith(this._items),
        switchMap((items) => combineLatest(items.toArray().map((i) => i.isPositioned$))),
        switchMap((positioned) => {
          const allPositioned = positioned.every((i) => i);

          if (!allPositioned) {
            this._didInitialize$.next(allPositioned);
            return of(null);
          }

          return timer(100).pipe(
            tap(() => {
              this._didInitialize$.next(true);
            }),
          );
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    // let took = 0;

    // for (let i = 0; i < 100_000; i++) {
    //   const start = new Date().getTime();
    //   this.repaint();
    //   took += new Date().getTime() - start;
    // }

    // console.log('took', took / 1000);
  }

  /**
   * This function is EXPENSIVE.
   * TODO: reduce should be replaced with for loops.
   *
   * Stats:
   * v1      | v2
   *
   * 25_000 runs
   *
   * 7.831s | 5.101
   * 7.039s | 5.195
   * 7.142s | 5.316
   *
   * 50_000 runs
   *
   * 16.401s | 10.507
   * 13.995s | 10.592
   * 14.232s | 10.387
   *
   * 100_000 runs
   *
   * 32.424s | 20.889
   * 28.405s | 20.521
   * 29.438s | 21.226
   *
   */
  repaint() {
    const itemList = this._items;

    if (!itemList) {
      return;
    }

    const hostDimensions = this._getHostDimensions();

    const columns = Math.floor(hostDimensions.width / this.columWidth);
    const gap = this.gap;

    const columnWidth = (hostDimensions.width - (columns - 1) * gap) / columns;

    this._setColumnWidth(columnWidth);

    const gridRowElHeights: number[][] = Array.from({ length: columns }).map(() => []);

    const items = itemList.toArray();

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];
      const columnIndex = itemIndex % columns;

      const initialItemDimensions = item.initialDimensions;
      const updatedDimensions = item.dimensions;

      if (!initialItemDimensions || !updatedDimensions) {
        continue;
      }

      let colWithLeastHeightIndex = columnIndex;
      let y: number | null = null;

      for (let colIndex = 0; colIndex < gridRowElHeights.length; colIndex++) {
        const col = gridRowElHeights[colIndex];
        const colHeight = this._sumHeights(col, gap);

        if (y === null || colHeight < y) {
          colWithLeastHeightIndex = colIndex;
          y = colHeight;
        }
      }

      if (y === null) {
        y = 0;
      }

      const x = columnWidth * colWithLeastHeightIndex + colWithLeastHeightIndex * gap;

      item.setPosition(x, y, updatedDimensions.height);
      gridRowElHeights[colWithLeastHeightIndex].push(updatedDimensions.height);
    }

    const hostHeight = this._getHighestColumnHeight(gridRowElHeights, gap);

    this._elementRef.nativeElement.style.setProperty('height', `${hostHeight}px`);
  }

  protected setResizeEvent(e: ResizeObserverEntry[]) {
    this._didResize$.next(e);
  }

  private _getHostDimensions() {
    return this._elementRef.nativeElement.getBoundingClientRect();
  }

  private _setColumnWidth(width: number) {
    this._elementRef.nativeElement.style.setProperty('--et-masonry-column-width', `${width}px`);
  }

  private _sumHeights(heights: number[], gap: number) {
    let sum = 0;
    for (let i = 0; i < heights.length; i++) {
      sum += heights[i];
    }

    return sum + gap * heights.length;
  }

  private _getHighestColumnHeight(columnHeights: number[][], gap: number) {
    let highestColumnHeight = 0;
    for (let i = 0; i < columnHeights.length; i++) {
      const columnHeight = this._sumHeights(columnHeights[i], gap);

      if (columnHeight > highestColumnHeight) {
        highestColumnHeight = columnHeight;
      }
    }

    return highestColumnHeight;
  }
}
