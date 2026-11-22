import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { TitleBarComponent } from '../components/title-bar/title-bar.component';
import {
  SKETCH_DRAWN_AS,
  SKETCH_LOOKS,
  SKETCH_MANY_SAMPLE,
  SKETCH_MANY_STATES,
  SKETCH_NARROW_SAMPLE,
  SKETCH_NEIGHBOURS_SAMPLE,
  SKETCH_ROWS,
  SKETCH_SCREEN_SAMPLE,
  SKETCH_TITLE_BARS,
  SketchRow,
} from '../design-parts/sketches/sketches-sample';
import { SketchShotContext } from '../design-parts/sketches/sketches.component';
import { ZoomChipComponent, ZoomControl, ZoomInteraction } from '../design-parts/zoom-chip/zoom-chip.component';

const SCREEN_STATES = new Set(SKETCH_SCREEN_SAMPLE.rows.flatMap((row) => row.shots.map((shot) => shot.state)));

const MANY_STATES = new Set(SKETCH_MANY_STATES);

const chipSampleOf = (row: SketchRow) =>
  SKETCH_NEIGHBOURS_SAMPLE.rows.some((candidate) => candidate.key === row.key && candidate.note === row.note)
    ? SKETCH_NEIGHBOURS_SAMPLE
    : SKETCH_NARROW_SAMPLE;

const changedIn = (rows: SketchRow[], { key, state }: { key: string; state: string }) =>
  rows.find((row) => row.key === key)?.shots.find((shot) => shot.state === state)?.changed === true;

@Component({
  selector: 'ethlete-design-harness-sketch-shots',
  template: `
    <ng-template #shot let-row let-state="state">
      <div [class]="lookOf(row, state)">
        @if (TITLE_BARS[state]; as bar) {
          <ethlete-title-bar
            [os]="bar.os"
            [right]="bar.right"
            [update]="bar.update"
            product="studio"
            part="Title bar"
          />
        } @else if (MANY_STATES.has(state)) {
          <div
            class="box-border flex h-225 w-360 items-center justify-center bg-et-surface-bg font-code text-ui-lg text-et-surface shadow-[0_0_0_1px_var(--et-surface-border-solid)]"
          >
            {{ state }}
          </div>
        } @else if (screenHeightOf(row, state); as height) {
          <div [style.width.px]="row.width" [style.height.px]="height" class="bg-et-surface-bg"></div>
        } @else {
          @let force = chipForceOf(state);
          <ethlete-zoom-chip
            [percent]="100"
            [target]="force?.target ?? null"
            [interaction]="force?.interaction ?? null"
          />
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TitleBarComponent, ZoomChipComponent],
})
export class DesignHarnessSketchShotsComponent {
  private shot = viewChild.required<TemplateRef<SketchShotContext>>('shot');
  protected readonly TITLE_BARS = SKETCH_TITLE_BARS;
  protected readonly MANY_STATES = MANY_STATES;

  public templates() {
    return { shot: this.shot() };
  }

  protected screenHeightOf(row: SketchRow, state: string) {
    return SCREEN_STATES.has(state) ? row.shots.find((shot) => shot.state === state)?.height : null;
  }

  protected chipForceOf(state: string) {
    const [, target, interaction] =
      /^(out|reset|in|fit)-(hover|active|focus-visible)$/.exec(SKETCH_DRAWN_AS[state] ?? state) ?? [];

    return target && interaction
      ? { target: target as ZoomControl, interaction: interaction as ZoomInteraction }
      : null;
  }

  protected lookOf(row: SketchRow, state: string) {
    const sample = Object.hasOwn(SKETCH_TITLE_BARS, state)
      ? { rows: SKETCH_ROWS, looks: SKETCH_LOOKS }
      : MANY_STATES.has(state)
        ? SKETCH_MANY_SAMPLE
        : chipSampleOf(row);
    const shot = row.shots.find((candidate) => candidate.state === state);
    const changed =
      shot?.changed === true || (shot?.changed === null && changedIn(sample.rows, { key: row.key, state }));

    return changed ? (sample.looks[row.key] ?? '') : '';
  }
}
