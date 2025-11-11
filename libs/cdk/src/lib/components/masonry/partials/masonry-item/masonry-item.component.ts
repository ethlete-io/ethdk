import { AfterViewInit, Component, ElementRef, inject, InjectionToken, Input, ViewChild } from '@angular/core';
import { nextFrame } from '@ethlete/core';
import { BehaviorSubject } from 'rxjs';

export const MASONRY_ITEM_TOKEN = new InjectionToken<MasonryItemComponent>('ET_MASONRY_ITEM');

@Component({
  selector: '[et-masonry-item], et-masonry-item',
  template: `<div #innerElement class="et-masonry-item-inner"><ng-content /></div>`,
  exportAs: 'etMasonryItem',
  host: {
    class: 'et-masonry-item',
    role: 'listitem',
    style: 'opacity: 0;',
  },
  providers: [{ provide: MASONRY_ITEM_TOKEN, useExisting: MasonryItemComponent }],
})
export class MasonryItemComponent implements AfterViewInit {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('innerElement', { static: true })
  private readonly _innerElementRef?: ElementRef<HTMLElement>;

  @Input()
  get key(): string | number {
    return this._key;
  }
  set key(v: string | number) {
    this._key = v;

    if (this.isPositioned) {
      this._isPositioned$.next(false);
    }
  }
  private _key!: string | number;

  get dimensions() {
    if (!this._innerElementRef?.nativeElement) {
      return null;
    }

    return this._innerElementRef.nativeElement.getBoundingClientRect();
  }

  private _initialDimensions: DOMRect | null = null;

  get initialDimensions() {
    return this._initialDimensions;
  }

  private readonly _isPositioned$ = new BehaviorSubject(false);

  get isPositioned$() {
    return this._isPositioned$.asObservable();
  }

  get isPositioned() {
    return this._isPositioned$.getValue();
  }

  ngAfterViewInit(): void {
    if (!this.key) {
      throw new Error('MasonryItemComponent: @Input() key is required');
    }

    this._initialDimensions = this.dimensions;
    this._elementRef.nativeElement.style.setProperty('width', `var(--et-masonry-column-width)`);
  }

  setPosition(x: number, y: number, height: number) {
    this._elementRef.nativeElement.style.setProperty('transform', `translate3d(${x}px, ${y}px, 0)`);
    this._elementRef.nativeElement.style.setProperty('height', `${height}px`);

    if (!this._isPositioned$.value) {
      this._elementRef.nativeElement.style.setProperty('opacity', '1');
      nextFrame(() => this._isPositioned$.next(true));
    }
  }
}
