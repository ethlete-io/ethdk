import { css, drawing, html } from '@design-explore';
import { DOWN, GROUND, INK, LINE, MUTED, TILES, UP } from './fixture';

export default drawing({
  body: html`
    <div class="row">
      ${TILES.map(
        (tile) => html`
          <div class="tile">
            <span class="head">
              <span class="label">${tile.label}</span>
              <span class="change ${tile.rising && 'rising'}">${tile.change}</span>
            </span>
            <span class="value">${tile.value}</span>
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
      gap: 1.6rem;
    }

    .tile {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1rem;
      padding: 1.6rem;
      border: 1px solid ${LINE};
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
    }

    .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    .change {
      font-size: 1.1rem;
      color: ${DOWN};
      font-variant-numeric: tabular-nums;
    }

    .change.rising {
      color: ${UP};
    }

    .value {
      font-size: 3.2rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
  `,
});
