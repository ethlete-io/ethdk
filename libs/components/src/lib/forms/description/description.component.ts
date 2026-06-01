import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-description',
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-description',
  },
  styles: `
    et-description {
      display: block;
      font-size: var(--et-description-font-size, 12px);
      color: var(--et-surface-color-muted-solid, currentColor);
    }
  `,
})
export class DescriptionComponent {}
