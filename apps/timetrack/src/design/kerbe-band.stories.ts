import { Component, ViewEncapsulation } from '@angular/core';
import { moduleMetadata, Meta, StoryObj } from '@storybook/angular';
import { Band, BandTreatment, DAY, KERBE_VARS } from './kerbe';
import { KerbeBandComponent } from './kerbe-band.component';

const HOUR_REM = 8;
const DAY_START_HOUR = 11;
const DAY_END_HOUR = 19;

const TREATMENTS: { key: BandTreatment; name: string; claim: string }[] = [
  { key: 'plate', name: 'Plate', claim: 'A raised panel. The corner brackets close on a band that asks.' },
  { key: 'tally', name: 'Tally', claim: 'No panel. One cut stick down the left edge, straight off the mark.' },
  { key: 'rule', name: 'Rule', claim: 'Hairlines only. Each band is an open bracket cut into the ground.' },
  { key: 'inlay', name: 'Inlay', claim: 'A flat plate with a metal strip inlaid. The break closes when it asks.' },
];

const minutesFromStart = (from: string) => {
  const [h = 0, m = 0] = from.split(':').map(Number);

  return (h - DAY_START_HOUR) * 60 + m;
};

@Component({
  selector: 'ethlete-design-kerbe-lanes',
  template: `
    <div class="page">
      <header>
        <span class="eyebrow">Kerbe · the band rebuilt</span>
        <h1>Four answers to one question</h1>
        <p>
          The same afternoon, four times. Nothing here refines what the app draws today. Each column is a different
          answer to "what makes a band visible", and all four are flat first, with one deco gesture that carries a
          meaning. Read the metal: dim is a band that asks nothing, brass is a glance, lit brass is a yes or a no,
          patina waits on a ticket.
        </p>
      </header>

      <div class="lanes">
        <div class="gutter">
          @for (hour of HOURS; track hour) {
            <span [style.top.rem]="(hour - DAY_START_HOUR) * HOUR_REM" class="hour">{{ hour }}:00</span>
          }
        </div>

        @for (t of TREATMENTS; track t.key) {
          <section class="lane">
            <h2>{{ t.name }}</h2>
            <p class="claim">{{ t.claim }}</p>
            <div [style.height.rem]="(DAY_END_HOUR - DAY_START_HOUR) * HOUR_REM" class="track">
              @for (hour of HOURS; track hour) {
                <span [style.top.rem]="(hour - DAY_START_HOUR) * HOUR_REM" class="line"></span>
              }
              @for (band of DAY; track band.id) {
                <div [style.top.rem]="topOf(band)" class="slot">
                  <ethlete-design-kerbe-band [band]="band" [treatment]="t.key" />
                </div>
              }
            </div>
          </section>
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
      padding: 4rem;
      min-height: 100vh;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    header {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      max-width: 88rem;
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
      font-weight: 300;
      font-size: 3.2rem;
      letter-spacing: 0.1em;
      color: var(--k-brass-hi);
    }

    header p {
      margin: 0;
      font-size: 1.4rem;
      line-height: 1.65;
      text-wrap: pretty;
    }

    .lanes {
      display: flex;
      gap: 2.4rem;
      align-items: flex-start;
    }

    .gutter {
      position: relative;
      width: 5rem;
      flex: none;
      margin-top: 7.4rem;
      height: ${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_REM}rem;
    }

    .hour {
      position: absolute;
      right: 0;
      transform: translateY(-50%);
      font-family: var(--k-mono);
      font-size: 1.1rem;
      color: var(--k-ink-3);
    }

    .lane {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      width: 27rem;
      flex: none;
    }

    h2 {
      margin: 0;
      font-family: var(--k-mono);
      font-size: 1.1rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--k-brass);
    }

    .claim {
      margin: 0 0 1rem;
      min-height: 4rem;
      font-size: 1.2rem;
      line-height: 1.5;
      color: var(--k-ink-3);
      text-wrap: pretty;
    }

    .track {
      position: relative;
      border-left: 1px solid rgb(255 255 255 / 0.07);
    }

    .line {
      position: absolute;
      right: 0;
      left: 0;
      height: 1px;
      background: rgb(255 255 255 / 0.04);
    }

    .slot {
      position: absolute;
      right: 0;
      left: 0;
    }
  `,
})
class KerbeLanesComponent {
  protected readonly DAY = DAY;
  protected readonly TREATMENTS = TREATMENTS;
  protected readonly HOUR_REM = HOUR_REM;
  protected readonly DAY_START_HOUR = DAY_START_HOUR;
  protected readonly DAY_END_HOUR = DAY_END_HOUR;
  protected HOURS = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

  protected topOf(band: Band) {
    return (minutesFromStart(band.from) / 60) * HOUR_REM;
  }
}

const meta: Meta<KerbeLanesComponent> = {
  title: 'Kerbe/Band rebuilds',
  component: KerbeLanesComponent,
  decorators: [moduleMetadata({ imports: [KerbeLanesComponent] })],
};

export default meta;

export const FourWays: StoryObj<KerbeLanesComponent> = {};
