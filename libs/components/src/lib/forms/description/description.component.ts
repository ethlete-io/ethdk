import { Component, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { createComponentId } from '@ethlete/core';

@Component({
  selector: 'et-description',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-description',
    '[attr.id]': 'id',
  },
  styles: `
    et-description {
      display: block;
      font-size: var(--et-description-font-size, 12px);
      color: var(--et-surface-color-muted-solid, currentColor);
    }
  `,
})
export class DescriptionComponent {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The id whatever this describes points its `aria-describedby` at. */
  public readonly id = this.elementRef.nativeElement.id || createComponentId('et-description');
}
