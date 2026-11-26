import { css, drawing, html } from '@design-explore';
import { BandTreatment, KERBE_VARS } from '../../shared/kerbe';
import { KERBE_BAND_STYLES, kerbeBand } from '../../shared/kerbe-band.component';
import { BAND, STATES } from './fixture';

const TREATMENT: BandTreatment = 'inlay';

export default drawing({
  body: html`
    <div class="page">
      <div class="grid">
        ${STATES.map(
          (state) => html`
            <div class="cell">
              <h2>${state.name}</h2>
              <div class="slot" data-state="${state.key}">
                ${kerbeBand({
                  band: BAND,
                  treatment: TREATMENT,
                  marked: !!state.marked,
                  dragging: !!state.dragging,
                })}
              </div>
              <p class="claim">${state.claim}</p>
            </div>
          `,
        )}
      </div>
    </div>
  `,
  styles: css`
    .page {
      ${KERBE_VARS}
      padding: 4rem;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 26rem);
      gap: 3.2rem;
    }

    .cell {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    h2 {
      margin: 0;
      font-family: var(--k-mono);
      font-size: 1.1rem;
      font-weight: 300;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--k-brass);
    }

    /* The grid line under the band is what a drag has to read through, so every cell carries one. */
    .slot {
      background: repeating-linear-gradient(to bottom, transparent 0 3.9rem, rgb(255 255 255 / 0.06) 3.9rem 4rem);
    }

    .claim {
      margin: 0;
      font-size: 1.2rem;
      line-height: 1.5;
      color: var(--k-ink-3);
      text-wrap: pretty;
    }

    ${KERBE_BAND_STYLES}
  `,
});
