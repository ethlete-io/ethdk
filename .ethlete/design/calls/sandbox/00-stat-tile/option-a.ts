import { css, drawing, html } from '@design-explore';
import { GROUND, INK, MUTED, TILES } from './fixture';

export default drawing({
  body: html`
    <div class="row">
      ${TILES.map(
        (tile) => html`
          <div class="tile">
            <span class="value">${tile.value}</span>
            <span class="label">${tile.label}</span>
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
      gap: 6.4rem;
    }

    .tile {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .value {
      font-size: 3.6rem;
      font-weight: 300;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .label {
      font-size: 1.1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }
  `,
});
