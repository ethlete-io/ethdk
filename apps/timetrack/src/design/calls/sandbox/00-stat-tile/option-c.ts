import { css, drawing, html } from '@design-explore';
import { DOWN, GROUND, INK, MUTED, PLATE, TILES, UP } from './fixture';

export default drawing({
  body: html`
    <div class="row">
      ${TILES.map(
        (tile) => html`
          <div class="tile">
            <span class="label">${tile.label}</span>
            <span class="line">
              <span class="value">${tile.value}</span>
              <span class="change ${tile.rising && 'rising'}">${tile.change}</span>
            </span>
          </div>
        `,
      )}
    </div>
  `,
  styles: css`
    #root {
      display: block;
      padding: 3.2rem;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    .row {
      display: flex;
      gap: 0.8rem;
    }

    .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1.4rem 1.6rem;
      background: ${PLATE};
      border-radius: 0.6rem;
    }

    .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .line {
      display: flex;
      align-items: baseline;
      gap: 0.8rem;
    }

    .value {
      font-size: 2.8rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .change {
      font-size: 1.3rem;
      color: ${DOWN};
    }

    .change.rising {
      color: ${UP};
    }
  `,
});
