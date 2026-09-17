import { Component, ViewEncapsulation } from '@angular/core';
import { DOWN, GROUND, INK, LINE, MUTED, TILES, UP } from './fixture';

@Component({
  selector: 'ethlete-design-tile-d',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="label">{{ tile.label }}</span>
          <span class="line">
            <span class="value">{{ tile.value }}</span>
            <span class="change">
              <span [class.rising]="tile.rising" class="mark">{{ tile.rising ? '▲' : '▼' }}</span>
              {{ tile.change }}
            </span>
          </span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-d {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-d .row {
      display: flex;
      gap: 1.6rem;
    }

    ethlete-design-tile-d .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      border: 1px solid ${LINE};
    }

    ethlete-design-tile-d .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-d .line {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
    }

    ethlete-design-tile-d .value {
      font-size: 3.2rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-d .change {
      font-size: 1.3rem;
      color: ${MUTED};
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-d .mark {
      font-size: 0.9rem;
      color: ${DOWN};
    }

    ethlete-design-tile-d .mark.rising {
      color: ${UP};
    }
  `,
})
export default class TileOptionDComponent {
  protected readonly TILES = TILES;
}
