import { Component, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS, injectNotificationManager, provideNotificationManager } from '@ethlete/components';
import { take, tap, timer } from 'rxjs';

const LOADING_MESSAGES = ['Feeding the cats', 'Mowing the lawn', 'Walking the dog', 'Watering the plants'];
const TICK_MS = 50;
const TOTAL_TICKS = 4000 / TICK_MS;

@Component({
  selector: 'app-notification-default-example',
  template: `
    <div class="app-example-row">
      <button (click)="openSuccess()" et-button size="sm" variant="outline">Success</button>
      <button (click)="openInfo()" et-button size="sm" variant="outline">Info</button>
      <button (click)="openError()" et-button size="sm" variant="outline">Error</button>
      <button (click)="openLoading()" et-button size="sm" variant="outline">Loading</button>
    </div>

    <div class="app-example-row">
      <button (click)="openWithAction()" et-button size="sm" variant="tonal">With action</button>
      <button (click)="openWithTwoActions()" et-button size="sm" variant="tonal">Two actions</button>
      <button (click)="openWithUpdate()" et-button size="sm" variant="tonal">Loading to success</button>
    </div>

    <div class="app-example-row">
      <button (click)="openDeduped()" et-button size="sm" variant="outline">
        Same id (clicked {{ dedupeClicks() }}x)
      </button>
      <button (click)="openWithoutIcon()" et-button size="sm" variant="outline">No icon</button>
      <button (click)="manager.dismissAll()" et-button size="sm" variant="transparent">Dismiss all</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'bottom-end' })],
})
export class NotificationDefaultExampleComponent {
  private destroyRef = inject(DestroyRef);
  protected manager = injectNotificationManager();

  protected dedupeClicks = signal(0);

  protected openSuccess() {
    this.manager.open({ status: 'success', title: 'Changes saved', message: 'Your profile has been updated.' });
  }

  protected openInfo() {
    this.manager.open({ status: 'info', title: 'Update available', message: 'A new version is ready to install.' });
  }

  protected openError() {
    this.manager.open({
      status: 'error',
      title: 'Upload failed',
      message: 'The file could not be uploaded. Please check your connection and try again.',
    });
  }

  protected openLoading() {
    this.manager.open({ status: 'loading', title: 'Uploading…', message: 'Please wait.' });
  }

  protected openWithAction() {
    this.manager.open({
      status: 'info',
      title: 'File deleted',
      message: 'report-q4-final-v2.pdf was moved to trash.',
      action: { label: 'Undo', handler: () => this.openInfo() },
    });
  }

  protected openWithTwoActions() {
    this.manager.open({
      status: 'info',
      title: 'Delete this file?',
      message: 'report-q4-final-v2.pdf will be moved to trash.',
      action: { label: 'Delete', handler: () => this.openSuccess() },
      secondaryAction: { label: 'Keep', handler: () => undefined },
    });
  }

  protected openDeduped() {
    this.dedupeClicks.update((clicks) => clicks + 1);

    this.manager.open({
      id: 'deduped',
      status: 'success',
      title: 'Message sent',
      message: `${this.dedupeClicks()} message${this.dedupeClicks() === 1 ? '' : 's'} sent so far.`,
      duration: 0,
    });
  }

  protected openWithoutIcon() {
    this.manager.open({ status: 'success', title: 'Changes saved', icon: null });
  }

  protected openWithUpdate() {
    const ref = this.manager.open({
      status: 'loading',
      title: 'Working on it…',
      message: LOADING_MESSAGES[0],
      progress: 0,
      duration: 0,
    });

    timer(0, TICK_MS)
      .pipe(
        take(TOTAL_TICKS + 1),
        tap((tick) => {
          const progress = Math.min(100, Math.round((tick / TOTAL_TICKS) * 100));
          const messageIndex = Math.min(
            LOADING_MESSAGES.length - 1,
            Math.floor((progress / 100) * LOADING_MESSAGES.length),
          );

          if (progress < 100) {
            ref.update({ progress, message: LOADING_MESSAGES[messageIndex] });
          } else {
            ref.update({
              status: 'success',
              title: 'All done!',
              message: 'Fed the cats, mowed the lawn and walked the dog.',
              progress: undefined,
              duration: 5000,
            });
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
