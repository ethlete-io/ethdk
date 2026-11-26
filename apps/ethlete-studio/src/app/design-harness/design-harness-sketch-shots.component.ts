import { Component, inject, TemplateRef, viewChild, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  SKETCH_DRAWN_AS,
  SKETCH_LOOKS,
  SKETCH_MANY_SAMPLE,
  SKETCH_MANY_STATES,
  SKETCH_NARROW_SAMPLE,
  SKETCH_NEIGHBOURS_SAMPLE,
  SKETCH_PHONE_STATES,
  SKETCH_ROWS,
  SKETCH_SCREEN_SAMPLE,
  SketchRow,
} from '../design-parts/sketches/sketches-sample';
import { SketchShotContext } from '../design-parts/sketches/sketches.component';
import { SAMPLE_BAR_STATES, sampleBar, sampleNarrowPage, samplePage, sampleStepper } from './sample-product';

const SCREEN_STATES = new Set(SKETCH_SCREEN_SAMPLE.rows.flatMap((row) => row.shots.map((shot) => shot.state)));

const MANY_STATES = new Set(SKETCH_MANY_STATES);

const PHONE_STATES = new Set(SKETCH_PHONE_STATES);

const BAR_STATES = new Set(SAMPLE_BAR_STATES);

const stepperSampleOf = (row: SketchRow) =>
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
        @if (screenHeightOf(row, state); as height) {
          <div [style.width.px]="row.width" [style.height.px]="height" class="bg-et-surface-background"></div>
        } @else {
          <div [innerHTML]="sampleOf(state)" class="contents"></div>
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class DesignHarnessSketchShotsComponent {
  private sanitizer = inject(DomSanitizer);
  private shot = viewChild.required<TemplateRef<SketchShotContext>>('shot');
  private drawn = new Map<string, SafeHtml>();

  public templates() {
    return { shot: this.shot() };
  }

  protected screenHeightOf(row: SketchRow, state: string) {
    return SCREEN_STATES.has(state) ? row.shots.find((shot) => shot.state === state)?.height : null;
  }

  protected sampleOf(state: string) {
    const known = this.drawn.get(state);
    if (known) return known;
    const markup = BAR_STATES.has(state)
      ? sampleBar(state)
      : PHONE_STATES.has(state)
        ? sampleNarrowPage(state)
        : MANY_STATES.has(state)
          ? samplePage(state)
          : sampleStepper(SKETCH_DRAWN_AS[state] ?? state);
    const safe = this.sanitizer.bypassSecurityTrustHtml(markup);
    this.drawn.set(state, safe);
    return safe;
  }

  protected lookOf(row: SketchRow, state: string) {
    const sample = BAR_STATES.has(state)
      ? { rows: SKETCH_ROWS, looks: SKETCH_LOOKS }
      : MANY_STATES.has(state)
        ? SKETCH_MANY_SAMPLE
        : stepperSampleOf(row);
    const shot = row.shots.find((candidate) => candidate.state === state);
    const changed =
      shot?.changed === true || (shot?.changed === null && changedIn(sample.rows, { key: row.key, state }));

    return changed ? (sample.looks[row.key] ?? '') : '';
  }
}
