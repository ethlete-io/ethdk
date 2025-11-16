import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  contentChildren,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Input,
  numberAttribute,
  output,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { createDestroy, signalElementDimensions, signalHostClasses } from '@ethlete/core';
import { injectInfinityQueryResponseDelay } from '@ethlete/query';
import { BehaviorSubject, combineLatest, debounceTime, of, switchMap, takeUntil, tap, timer } from 'rxjs';
import { MASONRY_ITEM_TOKEN, MasonryItemComponent } from '../../partials/masonry-item';

type MasonryState = {
  preferredColumnWidth: number;
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
    <div #resizeListenerElem></div>
    <ng-content select="[etMasonryItem], et-masonry-item, ng-container" />
  `,
  styleUrls: ['./masonry.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-masonry',
  },
})
export class MasonryComponent implements AfterContentInit {
  private readonly _destroy$ = createDestroy();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _infinityQueryResponseDelay = injectInfinityQueryResponseDelay({ optional: true });

  resizeListenerElement = viewChild<ElementRef<HTMLElement>>('resizeListenerElem');

  resizeListenerElementDimensions = signalElementDimensions(this.resizeListenerElement);

  private readonly _items = contentChildren(
    forwardRef(() => MASONRY_ITEM_TOKEN),
    { descendants: true },
  );
  private readonly _items$ = toObservable(this._items);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get columWidth(): number {
    return this._columWidth$.getValue() || 250;
  }
  set columWidth(value: unknown) {
    this._columWidth$.next(numberAttribute(value, 250));
  }
  private _columWidth$ = new BehaviorSubject<number>(250);

  // TODO: Skipped for migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input()
  get gap(): number {
    return this._gap$.getValue() || 0;
  }
  set gap(value: unknown) {
    this._gap$.next(numberAttribute(value, 16));
  }
  private _gap$ = new BehaviorSubject<number>(16);

  readonly initializing = output();

  readonly initialized = output();

  private readonly _didResize$ = new BehaviorSubject(false);
  private readonly _didInitialize$ = new BehaviorSubject(false);
  private readonly _hideOverflow$ = new BehaviorSubject(false);

  readonly hostClassBindings = signalHostClasses({
    'et-masonry--initialized': toSignal(this._didInitialize$),
    'et-masonry--hide-overflow': toSignal(this._hideOverflow$),
  });

  private readonly _state: MasonryState = {
    preferredColumnWidth: 0,
    columnWidth: 0,
    columns: 0,
    gridRowElHeights: [],
    hostHeight: 0,
    hostDimensions: null,
    gap: 0,
    itemCount: 0,
    isInitialized: false,
  };

  constructor() {
    effect(() => {
      this.resizeListenerElementDimensions();

      untracked(() => this.setResizeEvent());
    });
  }

  ngAfterContentInit(): void {
    this._infinityQueryResponseDelay?.enabled.set(true);

    combineLatest([this._items$, this._didResize$, this._columWidth$, this._gap$])
      .pipe(
        debounceTime(1),
        tap(([, didResize, colWidth, gap]) => {
          if (didResize) {
            this._didResize$.next(false);
          }

          const isCompleteInvalid =
            didResize || colWidth !== this._state.preferredColumnWidth || gap !== this._state.gap;

          this.invalidate({ partial: !isCompleteInvalid });
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._didResize$
      .pipe(
        tap(() => this._hideOverflow$.next(true)),
        switchMap(() => timer(150)),
        tap(() => this._hideOverflow$.next(false)),
        takeUntil(this._destroy$),
      )
      .subscribe();

    this._items$
      .pipe(
        switchMap((items) =>
          items.length
            ? combineLatest(items.filter((i): i is MasonryItemComponent => !!i).map((i) => i.isPositioned$))
            : of([]),
        ),
        switchMap((positioned) => {
          const allPositioned = positioned.every((i) => i);

          if (!allPositioned) {
            this._didInitialize$.next(allPositioned);
            this.initializing.emit();
            this._infinityQueryResponseDelay?.enabled.set(true);
            return of(null);
          }

          return timer(100).pipe(
            tap(() => {
              this._didInitialize$.next(true);
              this._infinityQueryResponseDelay?.enabled.set(false);
              this.initialized.emit();
            }),
          );
        }),
        takeUntil(this._destroy$),
      )
      .subscribe();
  }

  invalidate(config?: { partial?: boolean }) {
    const itemList = this._items();
    const state = this._state;

    if (!itemList) {
      return;
    }

    const items = itemList.filter((i): i is MasonryItemComponent => !!i);

    if (!config?.partial || !state.isInitialized) {
      state.preferredColumnWidth = this.columWidth;
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

      // item count 20 fromIndex 20 + 1 -> 21 => partial invalidation
      if (fromIndex + 1 > state.itemCount) {
        state.itemCount = items.length;
        this._paintMasonry(fromIndex, items);

        return;
      }

      // do a full invalidation the fromIndex is not the first new item
      this.invalidate();
    }
  }

  private _paintMasonry(fromIndex = 0, items: MasonryItemComponent[]) {
    const state = this._state;

    for (let itemIndex = fromIndex; itemIndex < items.length; itemIndex++) {
      const item = items[itemIndex];

      if (!item) {
        continue;
      }

      const initialItemDimensions = item.initialDimensions;
      const updatedDimensions = item.dimensions;

      if (!initialItemDimensions || !updatedDimensions) {
        continue;
      }

      const { lowestColumnHeight, lowestColumnIndex } = this._getLowestColumn(state.gridRowElHeights);

      const x = state.columnWidth * lowestColumnIndex + lowestColumnIndex * state.gap;

      item.setPosition(x, lowestColumnHeight, updatedDimensions.height);

      const row = state.gridRowElHeights[lowestColumnIndex];

      if (!row) continue;

      row.push(updatedDimensions.height);

      const total = updatedDimensions.height + state.gap;

      if (row[0]) {
        row[0] += total;
      } else {
        row[0] = total;
      }
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
    let lowestColumnHeight = columnHeights[0]?.[0] ?? 0;
    let lowestColumnIndex = 0;

    for (let i = 0; i < columnHeights.length; i++) {
      const columnHeight = columnHeights[i]?.[0];

      if (columnHeight !== undefined && columnHeight < lowestColumnHeight) {
        lowestColumnHeight = columnHeight;
        lowestColumnIndex = i;
      }
    }

    return { lowestColumnHeight, lowestColumnIndex };
  };

  private _getHighestColumn = (columnHeights: number[][]) => {
    let highestColumnHeight = columnHeights[0]?.[0] ?? 0;
    let highestColumnIndex = 0;

    for (let i = 0; i < columnHeights.length; i++) {
      const columnHeight = columnHeights[i]?.[0];

      if (columnHeight !== undefined && columnHeight >= highestColumnHeight) {
        highestColumnHeight = columnHeight;
        highestColumnIndex = i;
      }
    }

    return { highestColumnHeight, highestColumnIndex };
  };
}
