import { Component, ViewEncapsulation } from '@angular/core';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { Band, BandTreatment, KERBE_VARS } from './kerbe';
import { KerbeBandComponent } from './kerbe-band.component';

const BAND: Band = {
  id: 's',
  kind: 'work',
  ask: 'a glance',
  from: '10:00',
  minutes: 45,
  label: 'ET-772',
  detail: 'fix(repo): Cut the inlay instead of breaking it',
};

type StateCell = { key: string; name: string; claim: string; marked?: boolean; dragging?: boolean };

const STATES: StateCell[] = [
  { key: 'rest', name: 'Rest', claim: 'The plate is flat. Only the metal speaks.' },
  { key: 'hover', name: 'Hover', claim: 'The plate lifts one step. The metal does not move.' },
  { key: 'focus', name: 'Focus', claim: 'A ring inside the plate, so a packed lane cannot clip it.' },
  { key: 'press', name: 'Press', claim: 'The plate goes down into the ground.' },
  { key: 'drag', name: 'Drag', claim: 'The band goes translucent and the grid reads through it.', dragging: true },
  { key: 'marked', name: 'Marked for a merge', claim: 'Brackets close on the edge away from the metal.', marked: true },
];

@Component({
  selector: 'ethlete-design-kerbe-states',
  template: `
    <div class="page">
      <header>
        <span class="eyebrow">Kerbe · the band under the pointer</span>
        <h1>Six states, one gesture</h1>
        <p>
          The metal strip says what the band asks of the reader. A pointer over a band says nothing about that, so no
          state here touches the strip. The plate answers instead. Marked for a merge is the one state that earns an
          ornament: it is chosen by hand, it is rare, and two at once is the whole point of it.
        </p>
      </header>

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
    .page {
      ${KERBE_VARS}
      display: flex;
      flex-direction: column;
      gap: 4rem;
      min-height: 100vh;
      padding: 4rem;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    header {
      display: flex;
      max-width: 88rem;
      flex-direction: column;
      gap: 1.2rem;
    }

    .eyebrow {
      font-family: var(--k-mono);
      font-size: 1rem;
      letter-spacing: 0.24em;
      text-transform: uppercase;
      color: var(--k-ink-3);
    }

    h1 {
      margin: 0;
      font-family: var(--k-display);
      font-size: 3.2rem;
      font-weight: 300;
      letter-spacing: 0.1em;
      color: var(--k-brass-hi);
    }

    header p {
      margin: 0;
      font-size: 1.4rem;
      line-height: 1.65;
      text-wrap: pretty;
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
  `,
})
class KerbeStatesComponent {
  protected readonly BAND = BAND;
  protected readonly STATES = STATES;
  protected readonly TREATMENT: BandTreatment = 'inlay';
}

const meta: Meta<KerbeStatesComponent> = {
  title: 'Kerbe/Band states',
  component: KerbeStatesComponent,
  decorators: [moduleMetadata({ imports: [KerbeStatesComponent] })],
};

export default meta;

export const Inlay: StoryObj<KerbeStatesComponent> = {};
