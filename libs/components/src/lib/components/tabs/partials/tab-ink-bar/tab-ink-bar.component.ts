import { ChangeDetectionStrategy, Component, ElementRef, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-tab-ink-bar',
  styleUrls: ['tab-ink-bar.component.scss'],
  template: ``,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-tab-ink-bar',
  },
})
export class TabInkBarComponent {
  // @HostBinding('class')
  // get hostClasses(): string {
  //   return 'h-[4px] bg-gg-blue absolute transition-all bottom-0';
  // }

  constructor(private _elementRef: ElementRef<HTMLElement>) {}

  alignToElement(element: HTMLElement) {
    this.show();

    setTimeout(() => {
      const positions = this._positionInkBar(element);
      const inkBar: HTMLElement = this._elementRef.nativeElement;
      inkBar.style.left = positions.left;
      inkBar.style.width = positions.width;
    });
  }

  show(): void {
    this._elementRef.nativeElement.style.visibility = 'visible';
  }

  hide(): void {
    this._elementRef.nativeElement.style.visibility = 'hidden';
  }

  private _positionInkBar(element: HTMLElement) {
    return {
      left: element ? (element.offsetLeft || 0) + 'px' : '0',
      width: element ? (element.offsetWidth || 0) + 'px' : '0',
    };
  }
}
