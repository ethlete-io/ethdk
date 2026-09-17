import { Component, ViewEncapsulation } from '@angular/core';
import { DOWN, GROUND, INK, MUTED, PLATE, TILES, UP } from './fixture';

@Component({
  selector: 'ethlete-design-tile-c',
  template: `
    <div class="row">
      @for (tile of TILES; track tile.label) {
        <div class="tile">
          <span class="label">{{ tile.label }}</span>
          <span class="line">
            <span class="value">{{ tile.value }}</span>
            <span [class.rising]="tile.rising" class="change">{{ tile.change }}</span>
          </span>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-c {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-c .row {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-tile-c .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1.4rem 1.6rem;
      background: ${PLATE};
      border-radius: 0.6rem;
    }

    ethlete-design-tile-c .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-c .line {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
    }

    ethlete-design-tile-c .value {
      font-size: 2.8rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-tile-c .change {
      font-size: 1.3rem;
      color: ${DOWN};
    }

    ethlete-design-tile-c .change.rising {
      color: ${UP};
    }
  `,
})
export default class TileOptionCComponent {
  protected readonly TILES = TILES;
}
