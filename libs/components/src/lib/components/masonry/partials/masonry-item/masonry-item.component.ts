import { AfterViewInit, Component, ElementRef, inject, InjectionToken, ViewChild } from '@angular/core';

export const MASONRY_ITEM_TOKEN = new InjectionToken<MasonryItemComponent>('ET_MASONRY_ITEM');

@Component({
  selector: '[et-masonry-item], et-masonry-item',
  template: `<div #innerElement><ng-content /></div>`,
  standalone: true,
  exportAs: 'etMasonryItem',
  host: {
    class: 'et-masonry-item',
    role: 'listitem',
  },
  providers: [{ provide: MASONRY_ITEM_TOKEN, useExisting: MasonryItemComponent }],
})
export class MasonryItemComponent implements AfterViewInit {
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('innerElement', { static: true })
  private readonly _innerElementRef?: ElementRef<HTMLElement>;

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

  ngAfterViewInit(): void {
    this._initialDimensions = this.dimensions;
  }

  setPosition(x: number, y: number, width: number, height: number) {
    this._elementRef.nativeElement.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    this._elementRef.nativeElement.style.width = `${width}px`;
    this._elementRef.nativeElement.style.height = `${height}px`;
  }

  setWidth(width: number) {
    this._elementRef.nativeElement.style.setProperty('width', `${width}px`, 'important');
  }
}
