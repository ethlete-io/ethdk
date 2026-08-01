import { Component, computed, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { provideRouter } from '@angular/router';
import { applyFaviconOverlay } from '@ethlete/core';
import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { concatWith, fromEvent, interval, map, take, tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import { injectOverlayManager } from '../overlay-manager';
import { OVERLAY_REF } from '../overlay-ref';
import { OVERLAY_CONTENT_IMPORTS, provideOverlay } from '../overlay.imports';
import { dialogOverlayStrategy } from '../strategies';
import { createOverlayUnsavedChangesGuard } from '../utils/overlay-unsaved-changes-guard';

@Component({
  selector: 'et-sb-confirm-discard',
  template: `
    <div class="font-sans" etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" et-overlay-title>Discard changes?</h2>
      </div>

      <div et-overlay-body>
        <p class="max-w-sm text-medium text-white/70">You have unsaved changes. Closing now will lose them.</p>
      </div>

      <div class="flex justify-end gap-2" etOverlayFooter>
        <button (click)="ref.close(false)" et-button size="sm" variant="outline">Keep editing</button>
        <button (click)="ref.close(true)" et-button size="sm" variant="filled" color="danger">Discard</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
class ConfirmDiscardComponent {
  protected ref = inject(OVERLAY_REF);
}

@Component({
  selector: 'et-sb-edit-item',
  template: `
    <div class="font-sans" etOverlayMain>
      <div etOverlayHeader>
        <h2 class="text-h6 font-title" et-overlay-title>Edit item</h2>
      </div>

      <div et-overlay-body>
        <div class="flex w-[28rem] max-w-full flex-col gap-4">
          <label class="flex flex-col gap-1 text-small text-white/70">
            Title
            <input
              #titleInput
              [value]="title()"
              (input)="title.set(titleInput.value)"
              class="rounded border border-white/20 bg-transparent px-3 py-2 text-medium text-white outline-none focus:border-white/60"
              placeholder="Type to create unsaved changes…"
            />
          </label>

          <p class="text-small">
            Status: <strong>{{ guard.hasChanges() ? 'unsaved changes' : 'clean' }}</strong>
          </p>
          <p class="text-small text-white/50">
            Try Escape or the Close button - while there are unsaved changes you'll be asked to confirm. Save
            re-baselines, so closing right after a save won't prompt.
          </p>
          <p class="text-small text-white/50">
            The browser tab is guarded too: reloading or closing this page while there are unsaved changes triggers the
            browser's own confirmation, the tab title carries a dot (blinking once you switch to another tab), and the
            favicon gets a badge.
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2" etOverlayFooter>
        <button (click)="overlayRef.close()" et-button size="sm" variant="outline">Close</button>
        <button (click)="save()" et-button size="sm" variant="filled">Save</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
})
class EditItemOverlayComponent {
  private overlays = injectOverlayManager();
  private destroyRef = inject(DestroyRef);
  protected overlayRef = inject(OVERLAY_REF);

  protected title = signal('Weekly report');

  protected guard = createOverlayUnsavedChangesGuard<string>({
    source: this.title,
    confirm: (_, { signal }) => {
      const ref = this.overlays.open<ConfirmDiscardComponent, boolean>(ConfirmDiscardComponent, {
        strategies: dialogOverlayStrategy({ width: 400 }),
        panelClass: 'et-sb-overlay-panel',
      });

      // The session can end while the dialog is up (a logout redirects to the login page) - close it
      // instead of leaving it stranded there.
      fromEvent(signal, 'abort')
        .pipe(
          take(1),
          tap(() => ref.close(false)),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe();

      return ref.afterClosed();
    },
    tab: {
      titleMarker: true,
      flash: true,
      favicon: true,
    },
  });

  protected save() {
    // pretend to persist, then re-baseline so the saved value no longer counts as unsaved
    this.guard.refreshDefaultValue();
    this.overlayRef.close(this.title());
  }
}

@Component({
  selector: 'et-sb-overlay-unsaved-changes',
  template: `
    <div class="flex flex-col items-start gap-4 p-8 font-sans">
      <p class="text-medium text-white/70">
        An overlay hosting a form guards itself against accidental dismissal while it has unsaved changes.
      </p>
      <button (click)="open()" et-button>Edit item</button>
      @if (lastResult() !== undefined) {
        <p class="text-small text-white/50">Last close result: {{ lastResult() }}</p>
      }

      <hr class="w-full border-white/10" />

      <p class="text-medium text-white/70">
        Pending work can claim the tab too - a favicon ring is as close as the web gets to tab progress.
      </p>
      <button [disabled]="uploadProgress() !== null" (click)="simulateUpload()" et-button variant="outline">
        Simulate an upload
      </button>
      @if (uploadProgress() !== null) {
        <p class="text-small text-white/50">Uploading - favicon at {{ uploadProgress() }}%</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  styles: `
    .et-overlay--dialog.et-sb-overlay-panel {
      background-color: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      border-radius: 12px;
    }
  `,
})
class OverlayUnsavedChangesStorybookComponent {
  private overlays = injectOverlayManager();
  private destroyRef = inject(DestroyRef);

  protected lastResult = signal<string | undefined>(undefined);
  protected uploadProgress = signal<number | null>(null);

  constructor() {
    applyFaviconOverlay(
      computed(() => {
        const progress = this.uploadProgress();

        return progress === null ? null : { kind: 'progress' as const, value: progress };
      }),
    );
  }

  protected simulateUpload() {
    interval(300)
      .pipe(
        take(11),
        map((tick) => tick * 10),
        // …then let the finished ring linger for a moment before the favicon is restored.
        concatWith(timer(600).pipe(map(() => null))),
        takeUntilDestroyed(this.destroyRef),
        tap((progress) => this.uploadProgress.set(progress)),
      )
      .subscribe();
  }

  protected open() {
    this.overlays
      .open<EditItemOverlayComponent, string>(EditItemOverlayComponent, {
        strategies: dialogOverlayStrategy(),
        panelClass: 'et-sb-overlay-panel',
      })
      .afterClosed()
      .pipe(tap((result) => this.lastResult.set(result ?? '(dismissed)')))
      .subscribe();
  }
}

export default {
  title: 'Components/Overlay/Unsaved Changes',
  component: OverlayUnsavedChangesStorybookComponent,
  decorators: [
    moduleMetadata({ imports: [OverlayUnsavedChangesStorybookComponent] }),
    // The title marker goes through the core title store, which needs a router.
    applicationConfig({ providers: [provideOverlay(), provideRouter([])] }),
  ],
} as Meta<OverlayUnsavedChangesStorybookComponent>;

type Story = StoryObj<OverlayUnsavedChangesStorybookComponent>;

export const Default: Story = {};
