import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { Band, BandTreatment } from './kerbe';

const HOUR_REM = 8;
const DETAIL_MIN_REM = 4.4;
const TIME_MIN_REM = 2.6;

@Component({
  selector: 'ethlete-design-kerbe-band',
  template: `
    <div
      [style.height.rem]="heightRem()"
      [attr.data-ask]="band().ask"
      [attr.data-kind]="band().kind"
      [attr.data-treatment]="treatment()"
      class="band"
    >
      <span class="band__notch"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>

      <span class="band__label">{{ band().label }}</span>
      @if (showsTime()) {
        <span class="band__time">{{ band().from }} · {{ duration() }}</span>
      }
      @if (showsDetail() && band().detail) {
        <span class="band__detail">{{ band().detail }}</span>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .band {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      box-sizing: border-box;
      overflow: hidden;
      font-family: var(--k-sans);
      font-weight: 300;

      --k-metal: rgb(140 134 118 / 0.45);
      --k-metal-soft: rgb(140 134 118 / 0.16);
    }

    .band[data-ask='a glance'] {
      --k-metal: var(--k-brass);
      --k-metal-soft: rgb(214 181 105 / 0.3);
    }

    .band[data-ask='an answer'] {
      --k-metal: var(--k-brass-hi);
      --k-metal-soft: rgb(240 224 180 / 0.45);
    }

    .band[data-ask='a ticket'] {
      --k-metal: var(--k-patina);
      --k-metal-soft: rgb(63 179 154 / 0.35);
    }

    .band[data-kind='background'],
    .band[data-kind='break'] {
      --k-metal: rgb(140 134 118 / 0.26);
      --k-metal-soft: rgb(140 134 118 / 0.12);
    }

    .band__label {
      font-size: 1.3rem;
      line-height: 1.35;
      color: var(--k-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .band[data-kind='background'] .band__label,
    .band[data-kind='break'] .band__label,
    .band[data-ask='nothing'] .band__label {
      color: var(--k-ink-2);
    }

    .band__time {
      font-family: var(--k-mono);
      font-size: 1.05rem;
      letter-spacing: 0.08em;
      color: var(--k-ink-3);
    }

    .band__detail {
      font-size: 1.2rem;
      line-height: 1.4;
      color: var(--k-ink-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .band__notch,
    .band__bracket {
      position: absolute;
      pointer-events: none;
      opacity: 0;
    }

    /* Plate - a raised panel, framed in the metal. The four corner brackets close only on a band
       that asks for something, so the deco is the question and not the decoration. */
    .band[data-treatment='plate'] {
      padding: 0.7rem 0.9rem;
      background: var(--k-panel);
      border: 1px solid rgb(255 255 255 / 0.06);
    }

    .band[data-treatment='plate']:not([data-ask='nothing']) {
      background: var(--k-panel-hi);
      border-color: var(--k-metal-soft);
    }

    .band[data-treatment='plate'][data-kind='break'] {
      background: transparent;
      border-style: dashed;
    }

    .band[data-treatment='plate'] .band__bracket {
      width: 0.9rem;
      height: 0.9rem;
      border: 0 solid var(--k-metal);
    }

    .band[data-treatment='plate']:not([data-ask='nothing']) .band__bracket {
      opacity: 1;
    }

    .band[data-treatment='plate'] .band__bracket:nth-of-type(1) {
      top: -1px;
      left: -1px;
      border-top-width: 1px;
      border-left-width: 1px;
    }

    .band[data-treatment='plate'] .band__bracket:nth-of-type(2) {
      top: -1px;
      right: -1px;
      border-top-width: 1px;
      border-right-width: 1px;
    }

    .band[data-treatment='plate'] .band__bracket:nth-of-type(3) {
      bottom: -1px;
      left: -1px;
      border-bottom-width: 1px;
      border-left-width: 1px;
    }

    .band[data-treatment='plate'] .band__bracket:nth-of-type(4) {
      bottom: -1px;
      right: -1px;
      border-bottom-width: 1px;
      border-right-width: 1px;
    }

    /* Tally - no plate at all. The only mark is the cut stick down the left edge, which is the
       logo's own construction. The column reads as a row of notches. */
    .band[data-treatment='tally'] {
      padding: 0.4rem 0.8rem 0.4rem 1.5rem;
      background: transparent;
    }

    .band[data-treatment='tally'] .band__notch {
      top: 0.3rem;
      bottom: 0.3rem;
      left: 0;
      width: 3px;
      opacity: 1;
      background: repeating-linear-gradient(to bottom, var(--k-metal) 0 0.7rem, transparent 0.7rem 1.1rem);
    }

    /* Rule - hairlines only. The band is an open bracket cut into the ground. */
    .band[data-treatment='rule'] {
      padding: 0.6rem 0.8rem 0.6rem 1rem;
      background: transparent;
      border-top: 1px solid var(--k-metal);
    }

    .band[data-treatment='rule'] .band__notch {
      top: 0;
      left: 0;
      width: 1px;
      height: 0.9rem;
      opacity: 1;
      background: var(--k-metal);
    }

    .band[data-treatment='rule'] .band__bracket:nth-of-type(1) {
      bottom: 0;
      left: 0;
      width: 2.2rem;
      height: 1px;
      opacity: 0.55;
      background: var(--k-metal);
    }

    /* Inlay - a flat plate with a strip of metal set into its left edge. The strip is broken while
       the band asks nothing, and closes when it asks. One gesture, taken from the mark. */
    .band[data-treatment='inlay'] {
      padding: 0.7rem 0.9rem 0.7rem 1.3rem;
      background: var(--k-panel);
    }

    .band[data-treatment='inlay'][data-kind='break'] {
      background: transparent;
    }

    .band[data-treatment='inlay'] .band__notch {
      top: 0;
      bottom: 0;
      left: 0;
      width: 3px;
      opacity: 1;
      background: var(--k-metal);
    }

    .band[data-treatment='inlay'] .band__notch::after {
      content: '';
      position: absolute;
      top: calc(50% - 0.6rem);
      right: 0;
      left: 0;
      height: 1.2rem;
      background: var(--k-ground);
    }

    .band[data-treatment='inlay']:not([data-ask='nothing']) .band__notch::after {
      height: 0;
    }
  `,
})
export class KerbeBandComponent {
  public band = input.required<Band>();
  public treatment = input.required<BandTreatment>();

  protected heightRem = computed(() => (this.band().minutes / 60) * HOUR_REM);
  protected showsDetail = computed(() => this.heightRem() >= DETAIL_MIN_REM);
  protected showsTime = computed(() => this.heightRem() >= TIME_MIN_REM);

  protected duration = computed(() => {
    const m = this.band().minutes;

    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`.replace(' 0m', '');
  });
}
