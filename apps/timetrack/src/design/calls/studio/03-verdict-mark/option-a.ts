import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

const LARGE_VARIANT = VARIANTS.find((variant) => variant.key === LARGE);

@Component({
  selector: 'ethlete-design-verdict-mark-a',
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
              <div [class.chosen]="variant.verdict === 'chosen'" class="thumb-pic">
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
              <div class="thumb-foot">
                <span [class.chosen]="variant.verdict === 'chosen'" class="thumb-name">{{ variant.name }}</span>
              </div>
            </div>
          }
        </div>

        @if (LARGE_VARIANT; as variant) {
          <div class="large">
            <div [class.chosen]="variant.verdict === 'chosen'" class="large-pic">
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
              <span [class.chosen]="variant.verdict === 'chosen'" class="large-name">{{ variant.name }}</span>
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
    ethlete-design-verdict-mark-a {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-verdict-mark-a .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-verdict-mark-a .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-verdict-mark-a .filter {
      height: 2.8rem;
      margin-bottom: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-verdict-mark-a .rail-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    ethlete-design-verdict-mark-a .rail-row.on {
      gap: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-verdict-mark-a .bar {
      height: 0.9rem;
      width: 60%;
      border-radius: 999px;
      background: ${LINE};
    }

    ethlete-design-verdict-mark-a .bar.wide {
      width: 88%;
    }

    ethlete-design-verdict-mark-a .rail-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-verdict-mark-a .rail-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    ethlete-design-verdict-mark-a .stage {
      display: flex;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-verdict-mark-a .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 0 0 19rem;
      overflow: hidden;
    }

    ethlete-design-verdict-mark-a .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 0 0 auto;
      padding: 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-verdict-mark-a .thumb.on {
      border-color: ${INK};
    }

    ethlete-design-verdict-mark-a .thumb-pic {
      display: flex;
      align-items: center;
      height: 6.2rem;
      padding: 0 1rem;
      border: 1px solid transparent;
      border-radius: 0.3rem;
      background: ${GROUND};
      --mini-label: 0.95rem;
      --mini-number: 2.8rem;
      --mini-unit: 1.1rem;
      --mini-change: 1.05rem;
      --mini-gap: 0.2rem;
      --mini-gap-x: 0.4rem;
    }

    ethlete-design-verdict-mark-a .thumb-pic.chosen {
      border-color: ${ACCENT};
    }

    ethlete-design-verdict-mark-a .thumb-foot {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.6rem;
    }

    ethlete-design-verdict-mark-a .thumb-name {
      min-width: 0;
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    ethlete-design-verdict-mark-a .thumb-name.chosen {
      color: ${ACCENT};
    }

    ethlete-design-verdict-mark-a .mini {
      display: flex;
      flex-direction: column;
      gap: var(--mini-gap);
    }

    ethlete-design-verdict-mark-a .mini-row {
      display: flex;
      align-items: baseline;
      gap: var(--mini-gap-x);
    }

    ethlete-design-verdict-mark-a .mini-label {
      font-size: var(--mini-label);
      color: ${MUTED};
    }

    ethlete-design-verdict-mark-a .mini-number {
      font-size: var(--mini-number);
      line-height: 1;
      color: ${INK};
    }

    ethlete-design-verdict-mark-a .mini-unit {
      font-size: var(--mini-unit);
      color: ${INK};
    }

    ethlete-design-verdict-mark-a .mini-change {
      font-size: var(--mini-change);
      line-height: 1;
    }

    ethlete-design-verdict-mark-a .large {
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

    ethlete-design-verdict-mark-a .large-pic {
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

    ethlete-design-verdict-mark-a .large-pic.chosen {
      border-color: ${ACCENT};
    }

    ethlete-design-verdict-mark-a .large-foot {
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
    }

    ethlete-design-verdict-mark-a .large-name {
      font-size: 1.5rem;
    }

    ethlete-design-verdict-mark-a .large-name.chosen {
      color: ${ACCENT};
    }

    ethlete-design-verdict-mark-a .verbs {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-verdict-mark-a .verb {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }
  `,
})
export default class VerdictMarkAComponent {
  protected readonly CALL = CALL;
  protected readonly VARIANTS = VARIANTS;
  protected readonly TILE = TILE;
  protected readonly VERBS = VERBS;
  protected readonly LARGE = LARGE;
  protected readonly LARGE_VARIANT = LARGE_VARIANT;
  protected readonly ACCENT = ACCENT;
  protected readonly MUTED = MUTED;
}
