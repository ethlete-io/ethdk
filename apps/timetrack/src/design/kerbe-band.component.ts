import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { Band, BandTreatment } from './kerbe';

const HOUR_REM = 8;
const DETAIL_MIN_REM = 5.2;
const TIME_MIN_REM = 2.2;

/** Under this height a band cannot hold a padded line, so it drops to one tight row. */
const COMPACT_MAX_REM = 2.6;

@Component({
  selector: 'ethlete-design-kerbe-band',
  template: `
    <div
      [style.height.rem]="heightRem()"
      [attr.data-ask]="band().ask"
      [attr.data-compact]="compact() || null"
      [attr.data-kind]="band().kind"
      [attr.data-treatment]="treatment()"
      class="band"
    >
      <span class="band__notch"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>
      <span class="band__bracket"></span>

      <div class="band__head">
        <span class="band__label">{{ band().label }}</span>
        @if (showsTime()) {
          <span class="band__time">{{ duration() }}</span>
        }
      </div>
      @if (showsDetail() && band().detail) {
        <span class="band__detail">{{ band().detail }}</span>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-kerbe-band {
      display: block;
      container-type: inline-size;
    }

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

    .band[data-compact] {
      padding-block: 0;
    }

    .band__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
      min-width: 0;
    }

    .band__label {
      flex: 1;
      min-width: 0;
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

    .band[data-compact] .band__label {
      font-size: 1.15rem;
      line-height: 1.45;
    }

    /* A lane as narrow as the break column cannot hold a label and a duration. The grid already says
       how long the band is, so the duration is what goes. */
    @container (max-width: 10rem) {
      .band__time {
        display: none;
      }
    }

    .band__time {
      flex: none;
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

    /* Inlay - a flat plate with a strip of metal set into its left edge. A band that asks nothing
       carries a short cut at the top. A band that asks is marked down its whole length. */
    .band[data-treatment='inlay'] {
      padding: 0.7rem 0.9rem 0.7rem 1.3rem;
      background: var(--k-panel);
      /* Two touching plates of the same tone read as one slab, and the metal cannot separate them
         because the metal already says what the band asks. The plate's own lit edge does it. */
      border-top: 1px solid rgb(255 255 255 / 0.09);
    }

    .band[data-treatment='inlay'][data-kind='break'] {
      background: transparent;
    }

    .band[data-treatment='inlay'][data-kind='background'] {
      background: repeating-linear-gradient(135deg, transparent 0 6px, rgb(140 134 118 / 0.1) 6px 7px);
    }

    .band[data-treatment='inlay'] .band__notch {
      top: 0;
      left: 0;
      width: 3px;
      height: 1.6rem;
      opacity: 1;
      background: var(--k-metal);
    }

    .band[data-treatment='inlay'][data-compact] .band__notch {
      height: 0.9rem;
    }

    .band[data-treatment='inlay']:not([data-ask='nothing']) .band__notch {
      bottom: 0;
      height: auto;
    }
  `,
})
export class KerbeBandComponent {
  public band = input.required<Band>();
  public treatment = input.required<BandTreatment>();

  protected heightRem = computed(() => (this.band().minutes / 60) * HOUR_REM);
  protected compact = computed(() => this.heightRem() < COMPACT_MAX_REM);
  protected showsDetail = computed(() => this.heightRem() >= DETAIL_MIN_REM);
  protected showsTime = computed(() => this.heightRem() >= TIME_MIN_REM);

  protected duration = computed(() => {
    const m = this.band().minutes;

    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`.replace(' 0m', '');
  });
}
