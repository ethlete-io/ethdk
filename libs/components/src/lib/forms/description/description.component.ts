import { Component, ElementRef, inject, ViewEncapsulation } from '@angular/core';
import { createComponentId } from '@ethlete/core';

@Component({
  selector: 'et-description',
  template: '<ng-content />',
  styleUrl: './description.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-description',
    '[attr.id]': 'id',
  },
})
export class DescriptionComponent {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The id whatever this describes points its `aria-describedby` at. */
  public readonly id = this.elementRef.nativeElement.id || createComponentId('et-description');
}
