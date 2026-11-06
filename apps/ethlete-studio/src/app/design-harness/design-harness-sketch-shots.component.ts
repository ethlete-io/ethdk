import { Component, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { TitleBarComponent } from '../components/title-bar/title-bar.component';
import {
  SKETCH_LOOKS,
  SKETCH_NARROW_SAMPLE,
  SKETCH_ROWS,
  SKETCH_TITLE_BARS,
  SketchRow,
} from '../design-parts/sketches/sketches-sample';
import { SketchShotContext } from '../design-parts/sketches/sketches.component';
import { ZoomChipComponent } from '../design-parts/zoom-chip/zoom-chip.component';

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
        } @else {
          <ethlete-zoom-chip [percent]="100" />
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

  public templates() {
    return { shot: this.shot() };
  }

  protected lookOf(row: SketchRow, state: string) {
    const wide = Object.hasOwn(SKETCH_TITLE_BARS, state);
    const shot = row.shots.find((candidate) => candidate.state === state);
    const changed =
      shot?.changed === true ||
      (shot?.changed === null && changedIn(wide ? SKETCH_ROWS : SKETCH_NARROW_SAMPLE.rows, { key: row.key, state }));

    return changed ? ((wide ? SKETCH_LOOKS : SKETCH_NARROW_SAMPLE.looks)[row.key] ?? '') : '';
  }
}
