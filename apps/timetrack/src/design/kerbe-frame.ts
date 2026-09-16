import { Component, input, ViewEncapsulation } from '@angular/core';
import { KERBE_VARS } from './kerbe';

/** The ground a single option is drawn on, at the lane width the call fixes. */
@Component({
  selector: 'ethlete-design-kerbe-frame',
  template: `
    <div [style.width.rem]="widthRem()" [style.gap.rem]="gapRem()" class="lane">
      <ng-content />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-kerbe-frame {
      ${KERBE_VARS}
      display: block;
      padding: 1.6rem;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    ethlete-design-kerbe-frame .lane {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class KerbeFrameComponent {
  public widthRem = input(24);
  public gapRem = input(0);
}
