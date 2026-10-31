import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-grid-item-toolbar, [et-grid-item-toolbar]',
  template: `<ng-content />`,
  styleUrl: './grid-item-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-grid-item-toolbar',
    '(pointerdown)': '$event.stopPropagation()',
  },
})
export class GridItemToolbarComponent {}
