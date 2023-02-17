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

type MasonryState = {
  columnWidth: number;
  columns: number;
  gridRowElHeights: number[][];
  hostHeight: number;
  hostDimensions: DOMRect | null;
  gap: number;
  isInitialized: boolean;
  itemCount: number;
};

@Component({
  selector: 'et-masonry',
  template: `
    <div (etObserveResize)="setResizeEvent()"></div>
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

  private readonly _didResize$ = new BehaviorSubject<boolean>(false);
  private readonly _didInitialize$ = new BehaviorSubject(false);

  readonly _bindings = createReactiveBindings({
    attribute: 'class.et-masonry--initialized',
    observable: this._didInitialize$,
  });

  private readonly _state: MasonryState = {
    columnWidth: 0,
    columns: 0,
    gridRowElHeights: [],
    hostHeight: 0,
    hostDimensions: null,
    gap: 0,
    itemCount: 0,
    isInitialized: false,
  };

  ngAfterContentInit(): void {
    if (!this._items) {
      return;
    }

    combineLatest([this._items.changes.pipe(startWith(this._items)), this._didResize$, this._columWidth$, this._gap$])
      .pipe(
        debounceTime(1),
        tap(([, didResize]) => {
          if (didResize) {
            this._didResize$.next(false);
          }

          this.invalidate(didResize);
        }),
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
  }

  invalidate(didWindowResize = false) {
    const itemList = this._items;
    const state = this._state;

    if (!itemList) {
      return;
    }

    const items = itemList.toArray();

    if (didWindowResize || !state.isInitialized) {
      state.hostDimensions = this._getHostDimensions();
      state.columns = Math.floor(state.hostDimensions.width / this.columWidth);
      state.gap = this.gap;
      state.itemCount = items.length;
      state.columnWidth = (state.hostDimensions.width - (state.columns - 1) * state.gap) / state.columns;
      this._setColumnWidth(state.columnWidth);

      /**
       * Data structure:
       * [
       *  [currentTotalHeightOfCol, itemHeight, itemHeight, itemHeight],
       *  [currentTotalHeightOfCol, itemHeight, itemHeight, itemHeight],
       * ]
       */
      state.gridRowElHeights = Array.from({ length: state.columns }).map(() => [0]);

      this._paintMasonry(0, items);

      state.isInitialized = true;
    } else {
      const fromIndex = items.findIndex((item) => !item.isPositioned);

      if (fromIndex === -1) {
        return;
      } else if (fromIndex < state.itemCount - 1) {
        this.invalidate(true);
        return;
      }

      this._paintMasonry(fromIndex, items);
    }
  }

  private _paintMasonry(fromIndex = 0, items: MasonryItemComponent[]) {
    const state = this._state;

    for (let itemIndex = fromIndex; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];

      const initialItemDimensions = item.initialDimensions;
      const updatedDimensions = item.dimensions;

      if (!initialItemDimensions || !updatedDimensions) {
        continue;
      }

      const { lowestColumnHeight, lowestColumnIndex } = this._getLowestColumn(state.gridRowElHeights);

      const x = state.columnWidth * lowestColumnIndex + lowestColumnIndex * state.gap;

      item.setPosition(x, lowestColumnHeight, updatedDimensions.height);

      state.gridRowElHeights[lowestColumnIndex].push(updatedDimensions.height);
      state.gridRowElHeights[lowestColumnIndex][0] += updatedDimensions.height + state.gap;
    }

    state.hostHeight = this._getHighestColumn(state.gridRowElHeights).highestColumnHeight - state.gap;

    this._elementRef.nativeElement.style.setProperty('height', `${state.hostHeight}px`);
  }

  protected setResizeEvent() {
    this._didResize$.next(true);
  }

  private _getHostDimensions() {
    return this._elementRef.nativeElement.getBoundingClientRect();
  }

  private _setColumnWidth(width: number) {
    this._elementRef.nativeElement.style.setProperty('--et-masonry-column-width', `${width}px`);
  }

  private _getLowestColumn = (columnHeights: number[][]) => {
    let lowestColumnHeight = columnHeights[0][0];
    let lowestColumnIndex = 0;

    for (let i = 0; i < columnHeights.length; i++) {
      const columnHeight = columnHeights[i][0];

      if (columnHeight <= lowestColumnHeight) {
        lowestColumnHeight = columnHeight;
        lowestColumnIndex = i;
      }
    }

    return { lowestColumnHeight, lowestColumnIndex };
  };

  private _getHighestColumn = (columnHeights: number[][]) => {
    let highestColumnHeight = columnHeights[0][0];
    let highestColumnIndex = 0;

    for (let i = 0; i < columnHeights.length; i++) {
      const columnHeight = columnHeights[i][0];

      if (columnHeight >= highestColumnHeight) {
        highestColumnHeight = columnHeight;
        highestColumnIndex = i;
      }
    }

    return { highestColumnHeight, highestColumnIndex };
  };
}
