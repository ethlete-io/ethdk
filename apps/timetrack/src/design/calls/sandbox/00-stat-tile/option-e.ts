import { Component, ViewEncapsulation } from '@angular/core';
import { GROUND, INK, LINE, MUTED, TILES } from './fixture';

@Component({
  selector: 'ethlete-design-tile-e',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="label">{{ tile.label }}</span>
          <span class="value">{{ tile.value }}</span>
          <span class="change">{{ tile.change }} since yesterday</span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-e {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-e .row {
      display: flex;
      border: 1px solid ${LINE};
    }

    ethlete-design-tile-e .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.8rem;
      padding: 1.6rem;
    }

    ethlete-design-tile-e .tile + .tile {
      border-left: 1px solid ${LINE};
    }

    ethlete-design-tile-e .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-e .value {
      font-size: 3.2rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-e .change {
      font-size: 1.3rem;
      color: ${MUTED};
      font-variant-numeric: tabular-nums;
    }
  `,
})
export default class TileOptionEComponent {
  protected readonly TILES = TILES;
}
