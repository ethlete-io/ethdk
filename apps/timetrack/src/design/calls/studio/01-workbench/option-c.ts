import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

@Component({
  selector: 'ethlete-design-workbench-c',
  template: `
    <div class="win">
      <div class="rail">
        <div class="search"></div>

        <div class="call-row">
          <span class="bar bar-eyebrow"></span>
          <span class="bar bar-headline"></span>
        </div>

        <div class="call-row is-current">
          <span class="eyebrow">{{ CALL.eyebrow }}</span>
          <span class="call-headline">{{ CALL.headline }}</span>
        </div>

        <div class="call-row">
          <span class="bar bar-eyebrow"></span>
          <span class="bar bar-headline"></span>
        </div>
      </div>

      <div class="stage">
        <div class="stage-head">
          <span class="stage-title">{{ CALL.feature }}</span>
          <span class="stage-count">{{ VARIANTS.length }} variants</span>
        </div>

        <div class="grid">
          @for (variant of VARIANTS; track variant.key) {
            <div [class.is-large]="variant.key === LARGE" class="cell">
              <div [class.is-dimmed]="variant.verdict === 'rejected'" class="picture">
                <div class="mini">
                  @if (variant.change === 'over') {
                    <span [class.is-accent]="variant.accent" class="mini-change">{{ TILE.change }}</span>
                  }

                  <span class="mini-label">{{ TILE.label }}</span>

                  <span class="mini-row">
                    <span class="mini-number"
                      >{{ TILE.number }}<span class="mini-unit">{{ TILE.unit }}</span></span
                    >

                    @if (variant.change === 'beside') {
                      <span [class.is-accent]="variant.accent" class="mini-change">{{ TILE.change }}</span>
                    }
                  </span>

                  @if (variant.change === 'under') {
                    <span [class.is-accent]="variant.accent" class="mini-change">{{ TILE.change }}</span>
                  }
                </div>
              </div>

              <div class="meta">
                <span class="name">{{ variant.name }}</span>

                <span class="marks">
                  @if (variant.stale) {
                    <span class="stale">stale</span>
                  }

                  @if (variant.verdict) {
                    <span [class.is-chosen]="variant.verdict === 'chosen'" class="verdict">{{ variant.verdict }}</span>
                  }
                </span>
              </div>

              @if (variant.key === LARGE) {
                <div class="verbs">
                  @for (verb of VERBS; track verb) {
                    <span class="verb">{{ verb }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-workbench-c {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-workbench-c .win {
      display: flex;
      width: 128rem;
      height: 78rem;
      border: 1px solid ${LINE};
      background: ${GROUND};
      overflow: hidden;
    }

    ethlete-design-workbench-c .rail {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      flex: 0 0 23rem;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-workbench-c .search {
      height: 3.2rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-c .call-row {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.6rem;
    }

    ethlete-design-workbench-c .call-row.is-current {
      background: ${PLATE};
    }

    ethlete-design-workbench-c .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-c .call-headline {
      font-size: 1.3rem;
      line-height: 1.35;
      color: ${INK};
    }

    ethlete-design-workbench-c .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.4rem;
      background: ${LINE};
    }

    ethlete-design-workbench-c .bar-eyebrow {
      width: 45%;
      height: 0.6rem;
    }

    ethlete-design-workbench-c .bar-headline {
      width: 85%;
      height: 1rem;
    }

    ethlete-design-workbench-c .stage {
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      flex: 1;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-workbench-c .stage-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    ethlete-design-workbench-c .stage-title {
      font-size: 1.4rem;
      color: ${INK};
    }

    ethlete-design-workbench-c .stage-count {
      font-size: 1rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-c .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-auto-rows: 20.6rem;
      gap: 1.2rem;
      align-content: start;
    }

    ethlete-design-workbench-c .cell {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      min-width: 0;
      padding: 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-c .cell.is-large {
      grid-column: span 2;
      grid-row: span 2;
      padding: 1.4rem;
    }

    ethlete-design-workbench-c .picture {
      display: grid;
      place-items: center;
      flex: 1;
      min-height: 0;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      background: ${GROUND};
    }

    ethlete-design-workbench-c .picture.is-dimmed {
      opacity: 0.45;
    }

    ethlete-design-workbench-c .mini {
      display: flex;
      flex-direction: column;
      gap: 0.3em;
      font-size: 1rem;
    }

    ethlete-design-workbench-c .cell.is-large .mini {
      font-size: 2rem;
    }

    ethlete-design-workbench-c .mini-label {
      font-size: 1.1em;
      letter-spacing: 0.04em;
      color: ${MUTED};
    }

    ethlete-design-workbench-c .mini-row {
      display: flex;
      align-items: baseline;
      gap: 0.5em;
    }

    ethlete-design-workbench-c .mini-number {
      font-size: 2.8em;
      line-height: 1.05;
      font-variant-numeric: tabular-nums;
      color: ${INK};
    }

    ethlete-design-workbench-c .mini-unit {
      margin-left: 0.12em;
      font-size: 0.42em;
      color: ${INK};
    }

    ethlete-design-workbench-c .mini-change {
      font-size: 1.1em;
      font-variant-numeric: tabular-nums;
      color: ${MUTED};
    }

    ethlete-design-workbench-c .mini-change.is-accent {
      color: ${ACCENT};
    }

    ethlete-design-workbench-c .meta {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.8rem;
    }

    ethlete-design-workbench-c .name {
      min-width: 0;
      font-size: 1.1rem;
      line-height: 1.3;
      color: ${INK};
    }

    ethlete-design-workbench-c .cell.is-large .name {
      font-size: 1.4rem;
    }

    ethlete-design-workbench-c .marks {
      display: flex;
      gap: 0.5rem;
      flex: none;
    }

    ethlete-design-workbench-c .stale,
    ethlete-design-workbench-c .verdict {
      padding: 0.1rem 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 0.9rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-c .verdict.is-chosen {
      border-color: ${ACCENT};
      color: ${ACCENT};
    }

    ethlete-design-workbench-c .verbs {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }

    ethlete-design-workbench-c .verb {
      padding: 0.4rem 1.1rem;
      border: 1px solid ${LINE};
      border-radius: 999px;
      font-size: 1.1rem;
      color: ${INK};
    }
  `,
})
export default class WorkbenchCComponent {
  protected readonly VARIANTS = VARIANTS;
  protected readonly TILE = TILE;
  protected readonly CALL = CALL;
  protected readonly VERBS = VERBS;
  protected readonly LARGE = LARGE;
}
