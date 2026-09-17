import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

const LARGE_VARIANT = VARIANTS.find((variant) => variant.key === LARGE);

@Component({
  selector: 'ethlete-design-workbench-a',
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
    ethlete-design-workbench-a {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-workbench-a .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-workbench-a .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-workbench-a .filter {
      height: 2.8rem;
      margin-bottom: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-a .rail-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border-radius: 0.4rem;
    }

    ethlete-design-workbench-a .rail-row.on {
      gap: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-a .bar {
      height: 0.9rem;
      width: 60%;
      border-radius: 999px;
      background: ${LINE};
    }

    ethlete-design-workbench-a .bar.wide {
      width: 88%;
    }

    ethlete-design-workbench-a .rail-eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-a .rail-headline {
      font-size: 1.3rem;
      line-height: 1.35;
    }

    ethlete-design-workbench-a .stage {
      display: flex;
      gap: 1.6rem;
      flex: 1 1 auto;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-workbench-a .column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      flex: 0 0 19rem;
      overflow: hidden;
    }

    ethlete-design-workbench-a .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      flex: 0 0 auto;
      padding: 0.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-a .thumb.on {
      border-color: ${INK};
    }

    ethlete-design-workbench-a .thumb-pic {
      display: flex;
      align-items: center;
      height: 4.4rem;
      padding: 0 0.8rem;
      border-radius: 0.3rem;
      background: ${GROUND};
      --mini-label: 0.8rem;
      --mini-number: 2rem;
      --mini-unit: 0.9rem;
      --mini-change: 0.85rem;
      --mini-gap: 0.1rem;
      --mini-gap-x: 0.3rem;
    }

    ethlete-design-workbench-a .thumb-name {
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    ethlete-design-workbench-a .dim {
      opacity: 0.45;
    }

    ethlete-design-workbench-a .marks {
      display: flex;
      gap: 0.5rem;
    }

    ethlete-design-workbench-a .mark {
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    ethlete-design-workbench-a .mark.chosen {
      color: ${ACCENT};
    }

    ethlete-design-workbench-a .mark.rejected {
      color: ${MUTED};
    }

    ethlete-design-workbench-a .mark.stale {
      padding: 0 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.2rem;
      color: ${MUTED};
    }

    ethlete-design-workbench-a .mini {
      display: flex;
      flex-direction: column;
      gap: var(--mini-gap);
    }

    ethlete-design-workbench-a .mini-row {
      display: flex;
      align-items: baseline;
      gap: var(--mini-gap-x);
    }

    ethlete-design-workbench-a .mini-label {
      font-size: var(--mini-label);
      color: ${MUTED};
    }

    ethlete-design-workbench-a .mini-number {
      font-size: var(--mini-number);
      line-height: 1;
      color: ${INK};
    }

    ethlete-design-workbench-a .mini-unit {
      font-size: var(--mini-unit);
      color: ${INK};
    }

    ethlete-design-workbench-a .mini-change {
      font-size: var(--mini-change);
      line-height: 1;
    }

    ethlete-design-workbench-a .large {
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

    ethlete-design-workbench-a .large-pic {
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

    ethlete-design-workbench-a .large-foot {
      display: flex;
      align-items: baseline;
      gap: 1.2rem;
    }

    ethlete-design-workbench-a .large-name {
      font-size: 1.5rem;
    }

    ethlete-design-workbench-a .verbs {
      display: flex;
      gap: 0.8rem;
    }

    ethlete-design-workbench-a .verb {
      padding: 0.5rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.2rem;
      color: ${MUTED};
    }
  `,
})
export default class WorkbenchAComponent {
  protected readonly CALL = CALL;
  protected readonly VARIANTS = VARIANTS;
  protected readonly TILE = TILE;
  protected readonly VERBS = VERBS;
  protected readonly LARGE = LARGE;
  protected readonly LARGE_VARIANT = LARGE_VARIANT;
  protected readonly ACCENT = ACCENT;
  protected readonly MUTED = MUTED;
}
