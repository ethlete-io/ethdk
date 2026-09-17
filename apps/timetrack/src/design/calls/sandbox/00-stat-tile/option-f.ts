import { Component, ViewEncapsulation } from '@angular/core';
import { DOWN, GROUND, INK, LINE, MUTED, TILES, UP } from './fixture';

@Component({
  selector: 'ethlete-design-tile-f',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="head">
            <span class="label">{{ tile.label }}</span>
            <span [class.rising]="tile.rising" class="change">{{ tile.change }}</span>
          </span>
          <span class="value">{{ tile.value }}</span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-f {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-f .row {
      display: flex;
      gap: 1.6rem;
    }

    ethlete-design-tile-f .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      border: 1px solid ${LINE};
    }

    ethlete-design-tile-f .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
    }

    ethlete-design-tile-f .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-f .change {
      font-size: 1.1rem;
      color: ${DOWN};
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-f .change.rising {
      color: ${UP};
    }

    ethlete-design-tile-f .value {
      font-size: 3.2rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export default class TileOptionFComponent {
  protected readonly TILES = TILES;
}
