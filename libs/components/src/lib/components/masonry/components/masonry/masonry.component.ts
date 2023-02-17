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
  }

  repaint() {
    const itemList = this._items;

    if (!itemList) {
      return;
    }

    const hostDimensions = this._getHostDimensions();

    const columns = Math.floor(hostDimensions.width / this.columWidth);
    const gap = this.gap;

    const columnWidth = (hostDimensions.width - (columns - 1) * gap) / columns;

    const gridRowElHeights: number[][] = Array.from({ length: columns }).map(() => []);

    for (const [index, item] of itemList.toArray().entries()) {
      const columnIndex = index % columns;

      const initialItemDimensions = item.initialDimensions;

      if (!initialItemDimensions) {
        continue;
      }

      let colWithLeastHeight = columnIndex;
      let colLastHeight =
        gridRowElHeights[colWithLeastHeight].reduce((acc, item) => acc + item, 0) +
        gap * gridRowElHeights[colWithLeastHeight].length;

      for (const [colIndex, col] of gridRowElHeights.entries()) {
        const colHeight = col.reduce((acc, item) => acc + item, 0) + gap * col.length;

        if (colHeight < colLastHeight) {
          colWithLeastHeight = colIndex;
          colLastHeight = colHeight;
        }
      }

      const x = columnWidth * colWithLeastHeight + colWithLeastHeight * gap;
      const y =
        gridRowElHeights[colWithLeastHeight].reduce((acc, item) => acc + item, 0) +
        gap * gridRowElHeights[colWithLeastHeight].length;

      item.setWidth(columnWidth);

      const updatedDimensions = item.dimensions;

      if (!updatedDimensions) {
        continue;
      }

      item.setPosition(x, y, columnWidth, updatedDimensions.height);

      gridRowElHeights[colWithLeastHeight].push(updatedDimensions.height);
    }

    const hostHeight = gridRowElHeights.reduce(
      (acc, column) => Math.max(acc, column.reduce((acc, item) => acc + item, 0) + gap * column.length),
      0,
    );

    this._elementRef.nativeElement.style.height = `${hostHeight}px`;
  }

  protected setResizeEvent(e: ResizeObserverEntry[]) {
    this._didResize$.next(e);
  }

  private _getHostDimensions() {
    return this._elementRef.nativeElement.getBoundingClientRect();
  }
}
