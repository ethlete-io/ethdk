import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BandTreatment, KERBE_VARS } from '../../../kerbe';
import { KerbeBandComponent } from '../../../kerbe-band.component';
import { DAY_HEIGHT_REM, GutterRule, GUTTER_SPECS, HOURS, LANES, MARKS, NOW_REM, RUNGS } from './fixture';

/**
 * The day as calls 4 to 8 settled it. Only `rule` changes: how wide the clock column is, and
 * what the hour label in it says.
 */
@Component({
  selector: 'ethlete-design-gutter-day',
  template: `
    <div [style.--k-gutter.rem]="spec().gutterRem" class="window">
      <div class="chrome">
        <span class="mark">KERBE</span>
        <span class="date">Tuesday, 16 September</span>
        <span class="total">7h 15m</span>
      </div>

      <div class="timeline">
        <div class="head">
          <span [style.width.rem]="spec().gutterRem" class="head-gutter"></span>
          @for (lane of LANES; track lane.key) {
            <span [style.minWidth.rem]="lane.widthRem" class="head-lane">
              <span class="head-name">{{ lane.label }}</span>
              <span class="head-total">{{ lane.total }}</span>
            </span>
          }
        </div>

        <div class="scroller">
          <div [style.height.rem]="DAY_HEIGHT_REM" class="axis">
            @for (rung of RUNGS; track rung.key) {
              <div [style.top.rem]="rung.topRem" [class.rung--half]="rung.half" class="rung">
                <span [style.width.rem]="spec().gutterRem" class="rung-tick"></span>
                <span class="rung-line"></span>
              </div>
            }

            @for (hour of hours(); track hour.hour) {
              <div [style.top.rem]="hour.topRem" class="hour">
                <span
                  [style.width.rem]="spec().gutterRem - 0.8"
                  [style.fontSize.rem]="spec().labelRem"
                  [style.color]="spec().labelInk"
                  class="hour-label"
                  ><span class="hour-text">{{ hour.text }}</span></span
                >
                <span class="hour-line"></span>
              </div>
            }

            @for (mark of MARKS; track mark.id) {
              <div [style.top.rem]="mark.topRem" [style.height.rem]="mark.heightRem" class="brk">
                @for (lane of LANES; track lane.key) {
                  <span [style.minWidth.rem]="lane.widthRem" class="brk-cell"></span>
                }
                <span class="brk-hatch"></span>
                <span class="brk-edge brk-edge--top"></span>
                <span class="brk-edge brk-edge--bottom"></span>
                <span class="brk-sign">
                  <span [class.brk-pause--small]="mark.short" class="brk-pause"></span>
                </span>
              </div>
            }

            <div [style.top.rem]="NOW_REM" class="now"><span class="now-dot"></span></div>

            <div class="lanes">
              @for (lane of LANES; track lane.key) {
                <div [style.minWidth.rem]="lane.widthRem" class="lane">
                  @for (laid of lane.laid; track laid.band.id) {
                    <div
                      [style.top.rem]="laid.topRem"
                      [style.left.%]="laid.inlineOffset"
                      [style.width.%]="laid.inlineSize"
                      class="slot"
                    >
                      <ethlete-design-kerbe-band [band]="laid.band" [treatment]="TREATMENT" />
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KerbeBandComponent],
  styles: `
    .window {
      ${KERBE_VARS}
      display: flex;
      flex-direction: column;
      width: 110rem;
      height: 76rem;
      overflow: hidden;
      background: var(--k-ground);
      font-family: var(--k-sans);
      font-weight: 300;
      color: var(--k-ink-2);
    }

    .chrome {
      display: flex;
      flex: none;
      align-items: center;
      gap: 1.6rem;
      padding: 1rem 1.6rem;
      border-bottom: 1px solid rgb(255 255 255 / 0.06);
    }

    .mark {
      font-family: var(--k-mono);
      font-size: 1.1rem;
      letter-spacing: 0.32em;
      color: var(--k-brass);
    }

    .date {
      flex: 1;
      font-size: 1.3rem;
      color: var(--k-ink);
    }

    .total {
      font-family: var(--k-mono);
      font-size: 1.2rem;
      color: var(--k-ink-3);
    }

    .timeline {
      display: flex;
      min-height: 0;
      flex-direction: column;
    }

    .head {
      display: flex;
      flex: none;
      border-bottom: 1px solid rgb(255 255 255 / 0.06);
    }

    .head-gutter {
      flex: none;
    }

    .head-lane {
      display: flex;
      flex: 1;
      align-items: baseline;
      flex-basis: 0;
      gap: 0.8rem;
      overflow: hidden;
      padding: 0.6rem 0.8rem;
      border-left: 1px solid rgb(255 255 255 / 0.06);
      font-family: var(--k-mono);
      font-size: 1.05rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .head-name {
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--k-ink);
    }

    .head-total {
      flex: none;
      letter-spacing: 0.02em;
      text-transform: none;
      color: var(--k-ink-3);
    }

    .scroller {
      min-height: 0;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgb(140 134 118 / 0.3) transparent;
    }

    .axis {
      position: relative;
    }

    /* The transform makes this a stacking context, so the z-index has to sit here and not on the label. */
    .hour {
      position: absolute;
      right: 0;
      left: 0;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      transform: translateY(-50%);
    }

    .hour-label {
      flex: none;
      text-align: right;
      font-family: var(--k-mono);
    }

    .hour-text {
      padding: 0 0.3rem;
      background: var(--k-ground);
    }

    .hour-line {
      height: 1px;
      flex: 1;
      background: rgb(255 255 255 / 0.05);
    }

    .rung {
      position: absolute;
      right: 0;
      left: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      transform: translateY(-50%);
    }

    .rung-tick {
      display: flex;
      flex: none;
      justify-content: flex-end;
    }

    .rung-tick::after {
      width: 0.5rem;
      height: 1px;
      background: rgb(140 134 118 / 0.34);
      content: '';
    }

    .rung--half .rung-tick::after {
      width: 0.9rem;
    }

    .rung-line {
      height: 1px;
      flex: 1;
    }

    .brk {
      position: absolute;
      right: 0;
      left: var(--k-gutter);
      z-index: 3;
      display: flex;
      box-sizing: border-box;
      border-top: 1px solid rgb(140 134 118 / 0.26);
      border-bottom: 1px solid rgb(140 134 118 / 0.26);
      pointer-events: none;
    }

    .brk-cell {
      position: relative;
      flex: 1;
      flex-basis: 0;
    }

    /* The lane line has to stop at the break, so the rules read as one span across the day. */
    .brk-cell::before {
      position: absolute;
      top: 0;
      bottom: 0;
      left: -1px;
      width: 1px;
      background: var(--k-ground);
      content: '';
    }

    .brk-hatch {
      position: absolute;
      top: -1px;
      bottom: -1px;
      left: calc(var(--k-gutter) * -1);
      width: var(--k-gutter);
      border-top: 1px solid rgb(140 134 118 / 0.26);
      border-bottom: 1px solid rgb(140 134 118 / 0.26);
      background-image: repeating-linear-gradient(45deg, rgb(140 134 118 / 0.3) 0 1px, transparent 1px 5px);
    }

    .brk-edge {
      position: absolute;
      right: 0;
      left: calc(var(--k-gutter) * -1);
      height: 2px;
      background: rgb(169 161 146 / 0.5);
    }

    .brk-edge--top {
      top: -1px;
    }

    .brk-edge--bottom {
      bottom: -1px;
    }

    .brk-sign {
      position: absolute;
      top: 0;
      bottom: 0;
      left: calc(var(--k-gutter) * -1);
      display: flex;
      width: var(--k-gutter);
      align-items: center;
      justify-content: center;
    }

    /*
     * 4px bar and 4px gap, so the width and the pitch are both whole device pixels at scale
     * 1.25, 1.5, 2 and 3. At 2px the bar is 2.5 device pixels at 1.25, the two bars land on
     * different subpixel phases, and one renders wider than the other.
     */
    .brk-pause {
      display: flex;
      align-items: center;
      padding: 4px 6px;
      gap: 4px;
      background: var(--k-ground);
    }

    .brk-pause::before,
    .brk-pause::after {
      width: 4px;
      height: 14px;
      background: var(--k-ink-2);
      content: '';
    }

    .brk-pause--small {
      padding: 2px 5px;
    }

    .brk-pause--small::before,
    .brk-pause--small::after {
      height: 10px;
    }

    .now {
      position: absolute;
      right: 0;
      left: var(--k-gutter);
      z-index: 2;
      border-top: 1px solid var(--k-oxide);
    }

    .now-dot {
      position: absolute;
      top: -0.3rem;
      left: -0.3rem;
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: var(--k-oxide);
    }

    .lanes {
      position: absolute;
      inset: 0 0 0 var(--k-gutter);
      z-index: 1;
      display: flex;
    }

    .lane {
      position: relative;
      flex: 1;
      flex-basis: 0;
      border-left: 1px solid rgb(255 255 255 / 0.06);
    }

    .slot {
      position: absolute;
      padding-right: 1px;
    }
  `,
})
export class GutterDayComponent {
  public rule = input.required<GutterRule>();

  protected spec = computed(() => GUTTER_SPECS[this.rule()]);
  protected hours = computed(() => {
    const { label } = this.spec();

    return HOURS.map((hour) => ({ ...hour, text: label(hour.hour) }));
  });

  protected readonly TREATMENT: BandTreatment = 'inlay';
  protected readonly LANES = LANES;
  protected readonly RUNGS = RUNGS;
  protected readonly MARKS = MARKS;
  protected readonly DAY_HEIGHT_REM = DAY_HEIGHT_REM;
  protected readonly NOW_REM = NOW_REM;
}
