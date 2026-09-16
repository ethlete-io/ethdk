import { Component, ViewEncapsulation } from '@angular/core';
import { BandTreatment, KERBE_VARS } from '../../../kerbe';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { BAND, STATES } from './fixture';

@Component({
  selector: 'ethlete-design-band-states',
  template: `
    <div class="page">
      <div class="grid">
        @for (state of STATES; track state.key) {
          <div class="cell">
            <h2>{{ state.name }}</h2>
            <div class="slot">
              <ethlete-design-kerbe-band
                [band]="BAND"
                [treatment]="TREATMENT"
                [marked]="!!state.marked"
                [dragging]="!!state.dragging"
                [attr.data-state]="state.key"
              />
            </div>
            <p class="claim">{{ state.claim }}</p>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent],
  styles: `
    ethlete-design-band-states .page {
      ${KERBE_VARS}
      padding: 4rem;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    ethlete-design-band-states .grid {
      display: grid;
      grid-template-columns: repeat(3, 26rem);
      gap: 3.2rem;
    }

    ethlete-design-band-states .cell {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    ethlete-design-band-states h2 {
      margin: 0;
      font-family: var(--k-mono);
      font-size: 1.1rem;
      font-weight: 300;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--k-brass);
    }

    /* The grid line under the band is what a drag has to read through, so every cell carries one. */
    ethlete-design-band-states .slot {
      background: repeating-linear-gradient(to bottom, transparent 0 3.9rem, rgb(255 255 255 / 0.06) 3.9rem 4rem);
    }

    ethlete-design-band-states .claim {
      margin: 0;
      font-size: 1.2rem;
      line-height: 1.5;
      color: var(--k-ink-3);
      text-wrap: pretty;
    }
  `,
})
export default class BandStatesViewComponent {
  protected readonly BAND = BAND;
  protected readonly STATES = STATES;
  protected readonly TREATMENT: BandTreatment = 'inlay';
}
