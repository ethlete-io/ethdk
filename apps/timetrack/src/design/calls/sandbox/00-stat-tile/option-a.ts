import { Component, ViewEncapsulation } from '@angular/core';
import { GROUND, INK, MUTED, TILES } from './fixture';

@Component({
  selector: 'ethlete-design-tile-a',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="value">{{ tile.value }}</span>
          <span class="label">{{ tile.label }}</span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-a {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-a .row {
      display: flex;
      gap: 6.4rem;
    }

    ethlete-design-tile-a .tile {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    ethlete-design-tile-a .value {
      font-size: 3.6rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-a .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }
  `,
})
export default class TileOptionAComponent {
  protected readonly TILES = TILES;
}
