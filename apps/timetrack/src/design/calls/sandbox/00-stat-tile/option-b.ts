import { Component, ViewEncapsulation } from '@angular/core';
import { DOWN, GROUND, INK, LINE, MUTED, TILES, UP } from './fixture';

@Component({
  selector: 'ethlete-design-tile-b',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="label">{{ tile.label }}</span>
          <span class="value">{{ tile.value }}</span>
          <span [class.rising]="tile.rising" class="change">{{ tile.change }}</span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-b {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-b .row {
      display: flex;
      gap: 1.6rem;
    }

    ethlete-design-tile-b .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.8rem;
      padding: 1.6rem;
      border: 1px solid ${LINE};
    }

    ethlete-design-tile-b .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-b .value {
      font-size: 3.2rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-b .change {
      font-size: 1.3rem;
      color: ${DOWN};
    }

    ethlete-design-tile-b .change.rising {
      color: ${UP};
    }
  `,
})
export default class TileOptionBComponent {
  protected readonly TILES = TILES;
}
