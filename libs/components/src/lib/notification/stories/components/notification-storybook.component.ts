import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take, tap, timer } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import { injectNotificationManager } from '../../notification-manager';
import { NOTIFICATION_IMPORTS } from '../../notification.imports';

const LOADING_MESSAGES = [
  'Feeding the cats',
  'Mowing the lawn',
  'Walking the dog',
  'Watering the plants',
  'Chasing ducks',
];

const TOTAL_MS = 4000;
const TICK_MS = 50;
const TOTAL_TICKS = TOTAL_MS / TICK_MS;

@Component({
  selector: 'et-sb-notification',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <p class="m-0 text-xs font-semibold uppercase tracking-widest text-slate-500">Notifications</p>

      <div class="flex flex-wrap gap-2">
        <button (click)="openSuccess()" et-button size="sm" variant="outline">Success</button>
        <button (click)="openInfo()" et-button size="sm" variant="outline">Info</button>
        <button (click)="openError()" et-button size="sm" variant="outline">Error</button>
        <button (click)="openLoading()" et-button size="sm" variant="outline">Loading</button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button (click)="openWithAction()" et-button size="sm" variant="tonal">With action</button>
        <button (click)="openWithMessage()" et-button size="sm" variant="tonal">With message</button>
        <button (click)="openWithUpdate()" et-button size="sm" variant="tonal">Loading → Success</button>
        <button (click)="manager.dismissAll()" et-button size="sm" variant="transparent">Dismiss all</button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NOTIFICATION_IMPORTS, BUTTON_IMPORTS],
})
export class NotificationStorybookComponent {
  protected manager = injectNotificationManager();
  private destroyRef = inject(DestroyRef);

  openSuccess() {
    this.manager.open({
      status: 'success',
      title: 'Changes saved',
      message: 'Your profile has been updated.',
    });
  }

  openInfo() {
    this.manager.open({
      status: 'info',
      title: 'Update available',
      message: 'A new version is ready to install.',
    });
  }

  openError() {
    this.manager.open({
      status: 'error',
      title: 'Upload failed',
      message: 'The file could not be uploaded. Please check your connection and try again.',
    });
  }

  openLoading() {
    this.manager.open({ status: 'loading', title: 'Uploading…', message: 'Please wait.' });
  }

  openWithAction() {
    this.manager.open({
      status: 'info',
      title: 'File deleted',
      message: 'report-q4-final-v2.pdf was moved to trash.',
      action: { label: 'Undo', handler: () => alert('Undo!') },
    });
  }

  openWithMessage() {
    this.manager.open({
      status: 'success',
      title: 'Profile updated',
      message: 'Your profile picture and bio have been updated successfully.',
    });
  }

  openWithUpdate() {
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
          const msgIndex = Math.min(
            LOADING_MESSAGES.length - 1,
            Math.floor((progress / 100) * LOADING_MESSAGES.length),
          );

          if (progress < 100) {
            ref.update({ progress, message: LOADING_MESSAGES[msgIndex] });
          } else {
            ref.update({
              status: 'success',
              title: 'All done!',
              message: 'Fed the cats, mowed the lawn, walked the dog, and chased a few ducks.',
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
