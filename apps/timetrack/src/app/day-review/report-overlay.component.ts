import { Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  SWITCH_IMPORTS,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { catchError, finalize, map, of, tap } from 'rxjs';
import { injectAutoMode } from './auto-mode';

type SaveState = { kind: 'saved'; path: string } | { kind: 'dismissed' } | { kind: 'failed'; message: string };

@Component({
  selector: 'ethlete-report-overlay',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Export a debug report</h2>
    </div>

    <et-overlay-body>
      <div class="flex flex-col gap-4" data-report-modal>
        <et-choice-field data-report-anonymize>
          <et-switch [checked]="anonymize()" (checkedChange)="anonymize.set($event)" />
          <et-label>Anonymize</et-label>
          <et-hint>Replaces every checkout, branch, project, issue key and app with a placeholder.</et-hint>
        </et-choice-field>

        @if (!anonymize()) {
          <et-banner
            data-report-warning
            description="The file holds client names and issue keys exactly as the app has them. Share it only with someone who may read them."
            heading="This report is not anonymous"
            type="warning"
          />

          <et-choice-field data-report-inputs>
            <et-switch [checked]="includeInputs()" (checkedChange)="includeInputs.set($event)" />
            <et-label>Include the raw day inputs</et-label>
            <et-hint
              >The streams, edits and cut a day is rebuilt from, as the agent day.inputs op returns them.</et-hint
            >
          </et-choice-field>
        }

        @if (state(); as result) {
          <p class="text-small text-et-surface-muted" data-report-result>
            @switch (result.kind) {
              @case ('saved') {
                Saved to {{ result.path }}
              }
              @case ('dismissed') {
                Nothing was saved.
              }
              @case ('failed') {
                The report could not be saved: {{ result.message }}
              }
            }
          </p>
        }
      </div>
    </et-overlay-body>

    <div class="flex justify-end gap-3" etOverlayFooter>
      <button [disabled]="saving()" (click)="save()" et-button size="sm" data-report-save>Save as file</button>
      <button et-button etOverlayClose size="sm" variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, OVERLAY_CONTENT_IMPORTS, SWITCH_IMPORTS],
  hostDirectives: [OverlayMainDirective],
})
export class ReportOverlayComponent {
  private autoMode = injectAutoMode();
  private destroyRef = inject(DestroyRef);

  protected anonymize = signal(true);
  protected includeInputs = signal(false);
  protected saving = signal(false);
  protected state = signal<SaveState | null>(null);

  protected save() {
    this.saving.set(true);
    this.state.set(null);

    this.autoMode
      .saveReport$({ anonymize: this.anonymize(), includeInputs: this.includeInputs() })
      .pipe(
        map((result): SaveState => (result === null ? { kind: 'dismissed' } : { kind: 'saved', path: result })),
        catchError((error: unknown) =>
          of<SaveState>({ kind: 'failed', message: error instanceof Error ? error.message : String(error) }),
        ),
        tap((result) => this.state.set(result)),
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}

export const REPORT_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: ReportOverlayComponent,
  strategies: dialogOverlayStrategy({ width: 'min(560px, 90%)', maxWidth: '90%' }),
});
