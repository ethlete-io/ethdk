import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

const LARGE_VARIANT = VARIANTS.find((variant) => variant.key === LARGE);

@Component({
  selector: 'ethlete-design-tile-controls-b',
  template: `
    <div class="window">
      <div class="rail">
        <div class="filter"></div>
        <div class="rail-row"><span class="bar wide"></span><span class="bar"></span></div>
        <div class="rail-row on">
          <span class="rail-eyebrow">{{ CALL.eyebrow }}</span>
          <span class="rail-headline">{{ CALL.headline }}</span>
        </div>
        <div class="rail-row"><span class="bar wide"></span><span class="bar"></span></div>
      </div>

      <div class="stage">
        <div class="column">
          @for (variant of VARIANTS; track variant.key) {
            <div [class.on]="variant.key === LARGE" class="thumb">
              <div [class.dim]="variant.verdict === 'rejected'" class="thumb-pic">
                <div class="mini">
                  @if (variant.change === 'over') {
                    <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                  }
                  <span class="mini-label">{{ TILE.label }}</span>
                  <span class="mini-row">
                    <span class="mini-number">{{ TILE.number }}</span>
                    <span class="mini-unit">{{ TILE.unit }}</span>
                    @if (variant.change === 'beside') {
                      <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                    }
                  </span>
                  @if (variant.change === 'under') {
                    <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                  }
                </div>
              </div>

              <span class="thumb-name">{{ variant.name }}</span>

              <div class="controls">
                <span [class.pressed-accept]="variant.verdict === 'chosen'" class="control">Accept</span>
                <span [class.pressed-reject]="variant.verdict === 'rejected'" class="control">Reject</span>
                @if (variant.stale) {
                  <span class="mark stale">stale</span>
                }
              </div>
            </div>
          }
        </div>

        @if (LARGE_VARIANT; as variant) {
          <div class="large">
            <div [class.dim]="variant.verdict === 'rejected'" class="large-pic">
              <div class="mini">
                @if (variant.change === 'over') {
                  <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                }
                <span class="mini-label">{{ TILE.label }}</span>
                <span class="mini-row">
                  <span class="mini-number">{{ TILE.number }}</span>
                  <span class="mini-unit">{{ TILE.unit }}</span>
                  @if (variant.change === 'beside') {
                    <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                  }
                </span>
                @if (variant.change === 'under') {
                  <span [style.color]="variant.accent ? ACCENT : MUTED" class="mini-change">{{ TILE.change }}</span>
                }
              </div>
            </div>

            <div class="large-foot">
              <span class="large-name">{{ variant.name }}</span>
              <span class="marks">
                @if (variant.verdict === 'chosen') {
                  <span class="mark chosen">chosen</span>
                } @else if (variant.verdict === 'rejected') {
                  <span class="mark rejected">rejected</span>
                }
                @if (variant.stale) {
                  <span class="mark stale">stale</span>
                }
              </span>
            </div>

            <div class="verbs">
              @for (verb of VERBS; track verb) {
                <span class="verb">{{ verb }}</span>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-tile-controls-b {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-tile-controls-b .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-tile-controls-b .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-tile-controls-b .filter {
      height: 2.8rem;
      margin-bottom: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-tile-controls-b .rail-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    ethlete-design-tile-controls-b .rail-row.on {
      gap: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-tile-controls-b .bar {
      height: 0.9rem;
      width: 60%;
      border-radius: 999px;
      background: ${LINE};
    }

    ethlete-design-tile-controls-b .bar.wide {
      width: 88%;
    }

    ethlete-design-tile-controls-b .rail-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .rail-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    ethlete-design-tile-controls-b .stage {
      display: flex;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-tile-controls-b .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 0 0 19rem;
      overflow: hidden;
    }

    ethlete-design-tile-controls-b .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      flex: 0 0 auto;
      padding: 0.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-tile-controls-b .thumb.on {
      border-color: ${INK};
    }

    ethlete-design-tile-controls-b .thumb-pic {
      display: flex;
      align-items: center;
      height: 3.4rem;
      padding: 0 0.8rem;
      border-radius: 0.3rem;
      background: ${GROUND};
      --mini-label: 0.7rem;
      --mini-number: 1.5rem;
      --mini-unit: 0.75rem;
      --mini-change: 0.7rem;
      --mini-gap: 0.08rem;
      --mini-gap-x: 0.25rem;
    }

    ethlete-design-tile-controls-b .thumb-name {
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .controls {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    ethlete-design-tile-controls-b .control {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 0;
      height: 2.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.3rem;
      background: ${GROUND};
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .control.pressed-accept {
      border-color: ${ACCENT};
      background: ${ACCENT};
      color: ${GROUND};
    }

    ethlete-design-tile-controls-b .control.pressed-reject {
      border-color: ${MUTED};
      background: ${LINE};
      color: ${INK};
    }

    ethlete-design-tile-controls-b .dim {
      opacity: 0.45;
    }

    ethlete-design-tile-controls-b .marks {
      display: flex;
      gap: 0.5rem;
    }

    ethlete-design-tile-controls-b .mark {
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    ethlete-design-tile-controls-b .mark.chosen {
      color: ${ACCENT};
    }

    ethlete-design-tile-controls-b .mark.rejected {
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .mark.stale {
      flex: 0 0 auto;
      padding: 0 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.2rem;
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .mini {
      display: flex;
      flex-direction: column;
      gap: var(--mini-gap);
    }

    ethlete-design-tile-controls-b .mini-row {
      display: flex;
      align-items: baseline;
      gap: var(--mini-gap-x);
    }

    ethlete-design-tile-controls-b .mini-label {
      font-size: var(--mini-label);
      color: ${MUTED};
    }

    ethlete-design-tile-controls-b .mini-number {
      font-size: var(--mini-number);
      line-height: 1;
      color: ${INK};
    }

    ethlete-design-tile-controls-b .mini-unit {
      font-size: var(--mini-unit);
      color: ${INK};
    }

    ethlete-design-tile-controls-b .mini-change {
      font-size: var(--mini-change);
      line-height: 1;
    }

    ethlete-design-tile-controls-b .large {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    ethlete-design-tile-controls-b .large-pic {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1 1 auto;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${GROUND};
      --mini-label: 1.4rem;
      --mini-number: 6.4rem;
      --mini-unit: 2.2rem;
      --mini-change: 1.8rem;
      --mini-gap: 0.6rem;
      --mini-gap-x: 0.8rem;
    }

    ethlete-design-tile-controls-b .large-foot {
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
    }

    ethlete-design-tile-controls-b .large-name {
      font-size: 1.5rem;
    }

    ethlete-design-tile-controls-b .verbs {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-tile-controls-b .verb {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }
  `,
})
export default class TileControlsBComponent {
  protected readonly CALL = CALL;
  protected readonly VARIANTS = VARIANTS;
  protected readonly TILE = TILE;
  protected readonly VERBS = VERBS;
  protected readonly LARGE = LARGE;
  protected readonly LARGE_VARIANT = LARGE_VARIANT;
  protected readonly ACCENT = ACCENT;
  protected readonly MUTED = MUTED;
}
