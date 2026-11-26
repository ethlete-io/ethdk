import { Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BUTTON_IMPORTS,
  createOverlayUnsavedChangesGuard,
  dialogOverlayStrategy,
  injectOverlayManager,
  OVERLAY_CONTENT_IMPORTS,
  OVERLAY_REF,
} from '@ethlete/components';
import { fromEvent, take, tap } from 'rxjs';

@Component({
  selector: 'app-overlay-unsaved-changes-confirm',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 et-overlay-title>Discard changes?</h2>
      </div>

      <div et-overlay-body>
        <p>You have unsaved changes. Closing now will lose them.</p>
      </div>

      <div etOverlayFooter>
        <button (click)="ref.close(false)" et-button size="sm" variant="outline">Keep editing</button>
        <button (click)="ref.close(true)" et-button size="sm" variant="filled" color="danger">Discard</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayUnsavedChangesConfirmComponent {
  protected ref = inject(OVERLAY_REF);
}

@Component({
  selector: 'app-overlay-unsaved-changes-form',
  template: `
    <div etOverlayMain>
      <div etOverlayHeader>
        <h2 et-overlay-title>Edit item</h2>
      </div>

      <div et-overlay-body>
        <label>
          Title
          <input #titleInput [value]="title()" (input)="title.set(titleInput.value)" />
        </label>

        <p>
          Status: <strong>{{ guard.hasChanges() ? 'unsaved changes' : 'clean' }}</strong>
        </p>
        <p>
          Try Escape or the Close button. While there are unsaved changes you are asked to confirm. Save re-baselines,
          so closing right after a save does not prompt.
        </p>
      </div>

      <div etOverlayFooter>
        <button (click)="overlayRef.close()" et-button size="sm" variant="outline">Close</button>
        <button (click)="save()" et-button size="sm" variant="filled">Save</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
export class OverlayUnsavedChangesFormComponent {
  private overlays = injectOverlayManager();
  private destroyRef = inject(DestroyRef);
  protected overlayRef = inject(OVERLAY_REF);

  protected title = signal('Weekly report');

  protected guard = createOverlayUnsavedChangesGuard<string>({
    source: this.title,
    confirm: (_, { signal }) => {
      const ref = this.overlays.open<OverlayUnsavedChangesConfirmComponent, boolean>(
        OverlayUnsavedChangesConfirmComponent,
        { strategies: dialogOverlayStrategy({ width: 400 }) },
      );

      fromEvent(signal, 'abort')
        .pipe(
          take(1),
          tap(() => ref.close(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();

      return ref.afterClosed();
    },
    tab: { titleMarker: true, flash: true, favicon: true },
  });

  protected save() {
    this.guard.refreshDefaultValue();
    this.overlayRef.close(this.title());
  }
}

@Component({
  selector: 'app-overlay-unsaved-changes-example',
  template: `
    <button (click)="open()" et-button>Edit item</button>
    @if (lastResult() !== undefined) {
      <p>Last close result: {{ lastResult() }}</p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class OverlayUnsavedChangesExampleComponent {
  private overlays = injectOverlayManager();

  protected lastResult = signal<string | undefined>(undefined);

  protected open() {
    this.overlays
      .open<OverlayUnsavedChangesFormComponent, string>(OverlayUnsavedChangesFormComponent, {
        strategies: dialogOverlayStrategy(),
      })
      .afterClosed()
      .pipe(tap((result) => this.lastResult.set(result ?? '(dismissed)')))
      .subscribe();
  }
}
