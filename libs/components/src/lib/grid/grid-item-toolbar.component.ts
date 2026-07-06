import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-grid-item-toolbar, [et-grid-item-toolbar]',
  template: `<ng-content />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-grid-item-toolbar',
    '(pointerdown)': '$event.stopPropagation()',
  },
  styles: `
    .et-grid-item-toolbar {
      display: inline-flex;
      align-items: center;
      gap: var(--et-grid-item-toolbar-gap, 4px);
      padding: var(--et-grid-item-toolbar-padding, 4px);
      border-radius: var(--et-grid-item-toolbar-radius, 8px);
      background: var(--et-grid-item-toolbar-background, transparent);
    }
  `,
})
export class GridItemToolbarComponent {}
