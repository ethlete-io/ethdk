import { Component, ViewEncapsulation } from '@angular/core';
import { ACCENT, CALL, GROUND, INK, LARGE, LINE, MUTED, PLATE, TILE, VARIANTS, VERBS } from './fixture';

@Component({
  selector: 'ethlete-design-workbench-b',
  template: `
    <div class="window">
      <div class="rail">
        <div class="search">Search</div>
        <div class="calls">
          <div class="call">
            <span class="bar eyebrow-bar"></span>
            <span class="bar headline-bar"></span>
          </div>
          <div class="call open">
            <span class="eyebrow">{{ CALL.eyebrow }}</span>
            <span class="headline">{{ CALL.headline }}</span>
          </div>
          <div class="call">
            <span class="bar eyebrow-bar"></span>
            <span class="bar headline-bar"></span>
          </div>
        </div>
      </div>

      <div class="stage">
        @for (variant of VARIANTS; track variant.key) {
          @if (variant.key === LARGE) {
            <div class="hero">
              <div class="hero-head">
                <span class="hero-name">{{ variant.name }}</span>
                @if (variant.stale) {
                  <span class="stale">stale</span>
                }
                @if (variant.verdict) {
                  <span [class.chosen]="variant.verdict === 'chosen'" class="verdict">{{ variant.verdict }}</span>
                }
              </div>

              <div [class.dimmed]="variant.verdict === 'rejected'" class="hero-picture">
                <div class="mini large">
                  @if (variant.change === 'over') {
                    <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                  }
                  <span class="label">{{ TILE.label }}</span>
                  <span class="figure">
                    <span class="number">{{ TILE.number }}</span>
                    <span class="unit">{{ TILE.unit }}</span>
                    @if (variant.change === 'beside') {
                      <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                    }
                  </span>
                  @if (variant.change === 'under') {
                    <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                  }
                </div>
              </div>

              <div class="verbs">
                @for (verb of VERBS; track verb) {
                  <span class="verb">{{ verb }}</span>
                }
              </div>
            </div>
          }
        }

        <div class="strip">
          <div class="strip-head">
            <span class="strip-title">All {{ VARIANTS.length }} variants</span>
            <span class="strip-note">a ninth starts a second row, and the large one moves up</span>
          </div>

          <div class="thumbs">
            @for (variant of VARIANTS; track variant.key) {
              <div [class.open]="variant.key === LARGE" class="thumb">
                <div [class.dimmed]="variant.verdict === 'rejected'" class="thumb-picture">
                  <div class="mini">
                    @if (variant.change === 'over') {
                      <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                    }
                    <span class="label">{{ TILE.label }}</span>
                    <span class="figure">
                      <span class="number">{{ TILE.number }}</span>
                      <span class="unit">{{ TILE.unit }}</span>
                      @if (variant.change === 'beside') {
                        <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                      }
                    </span>
                    @if (variant.change === 'under') {
                      <span [class.accent]="variant.accent" class="change">{{ TILE.change }}</span>
                    }
                  </div>
                </div>

                <span class="thumb-name">{{ variant.name }}</span>

                <div class="markers">
                  @if (variant.verdict) {
                    <span [class.chosen]="variant.verdict === 'chosen'" class="verdict">{{ variant.verdict }}</span>
                  }
                  @if (variant.stale) {
                    <span class="stale">stale</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  styles: `
    ethlete-design-workbench-b {
      display: block;
      background: ${GROUND};
      font-family: 'Jost', sans-serif;
      color: ${INK};
    }

    ethlete-design-workbench-b .window {
      display: flex;
      width: 128rem;
      height: 72rem;
      overflow: hidden;
    }

    ethlete-design-workbench-b .rail {
      display: flex;
      flex-direction: column;
      gap: 1.6rem;
      width: 23rem;
      flex: none;
      padding: 1.6rem;
      border-right: 1px solid ${LINE};
    }

    ethlete-design-workbench-b .search {
      padding: 0.8rem 1rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .calls {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    ethlete-design-workbench-b .call {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 1rem;
      border-radius: 0.4rem;
    }

    ethlete-design-workbench-b .call.open {
      background: ${PLATE};
    }

    ethlete-design-workbench-b .eyebrow {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .headline {
      font-size: 1.3rem;
      line-height: 1.3;
    }

    ethlete-design-workbench-b .bar {
      display: block;
      height: 0.8rem;
      border-radius: 0.2rem;
      background: ${LINE};
    }

    ethlete-design-workbench-b .eyebrow-bar {
      width: 4.8rem;
      height: 0.6rem;
    }

    ethlete-design-workbench-b .headline-bar {
      width: 100%;
      height: 1.2rem;
    }

    ethlete-design-workbench-b .stage {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-width: 0;
      padding: 1.6rem;
    }

    ethlete-design-workbench-b .hero {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 1.6rem;
      min-height: 0;
      padding: 1.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-b .hero-head {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      flex: none;
    }

    ethlete-design-workbench-b .hero-name {
      font-size: 1.4rem;
    }

    ethlete-design-workbench-b .hero-picture {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-height: 0;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
    }

    ethlete-design-workbench-b .verbs {
      display: flex;
      gap: 0.8rem;
      flex: none;
    }

    ethlete-design-workbench-b .verb {
      padding: 0.6rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 1.4rem;
      font-size: 1.2rem;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .strip {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      height: 20rem;
      flex: none;
    }

    ethlete-design-workbench-b .strip-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      font-size: 1.1rem;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .strip-title {
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    ethlete-design-workbench-b .thumbs {
      display: flex;
      gap: 0.8rem;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    ethlete-design-workbench-b .thumb {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      width: 12rem;
      flex: none;
      padding: 0.8rem;
      border: 1px solid ${LINE};
      border-radius: 0.4rem;
      background: ${PLATE};
    }

    ethlete-design-workbench-b .thumb.open {
      border-color: ${ACCENT};
    }

    ethlete-design-workbench-b .thumb-picture {
      display: flex;
      flex: 1;
      align-items: center;
      min-height: 0;
    }

    ethlete-design-workbench-b .thumb-name {
      font-size: 1rem;
      line-height: 1.3;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .markers {
      display: flex;
      gap: 0.6rem;
      min-height: 1.4rem;
    }

    ethlete-design-workbench-b .dimmed {
      opacity: 0.45;
    }

    ethlete-design-workbench-b .verdict {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .verdict.chosen {
      color: ${ACCENT};
    }

    ethlete-design-workbench-b .stale {
      padding: 0 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      font-size: 1rem;
      line-height: 1.6rem;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .mini {
      display: flex;
      flex-direction: column;
      gap: 0.4em;
      font-size: 1rem;
    }

    ethlete-design-workbench-b .mini.large {
      font-size: 2.4rem;
    }

    ethlete-design-workbench-b .label {
      font-size: 1.1em;
      color: ${MUTED};
    }

    ethlete-design-workbench-b .figure {
      display: flex;
      align-items: baseline;
      gap: 0.3em;
    }

    ethlete-design-workbench-b .number {
      font-size: 3.2em;
      line-height: 1;
      color: ${INK};
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-workbench-b .unit {
      font-size: 1.2em;
      color: ${INK};
    }

    ethlete-design-workbench-b .change {
      font-size: 1.2em;
      color: ${MUTED};
      font-variant-numeric: tabular-nums;
    }

    ethlete-design-workbench-b .change.accent {
      color: ${ACCENT};
    }
  `,
})
export default class WorkbenchBComponent {
  protected readonly VARIANTS = VARIANTS;
  protected readonly TILE = TILE;
  protected readonly CALL = CALL;
  protected readonly VERBS = VERBS;
  protected readonly LARGE = LARGE;
}
