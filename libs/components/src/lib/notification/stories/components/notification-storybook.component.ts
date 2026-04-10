import { ChangeDetectionStrategy, Component, DestroyRef, ViewEncapsulation, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take, tap, timer } from 'rxjs';
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
    <div class="sb-notification-controls">
      <div class="sb-notification-row">
        <button (click)="openSuccess()" class="sb-notification-btn sb-notification-btn--success" type="button">
          Open success
        </button>
        <button (click)="openInfo()" class="sb-notification-btn sb-notification-btn--info" type="button">
          Open info
        </button>
        <button (click)="openError()" class="sb-notification-btn sb-notification-btn--error" type="button">
          Open error
        </button>
        <button (click)="openLoading()" class="sb-notification-btn sb-notification-btn--loading" type="button">
          Open loading
        </button>
      </div>

      <div class="sb-notification-row">
        <button (click)="openWithAction()" class="sb-notification-btn" type="button">With action</button>
        <button (click)="openWithMessage()" class="sb-notification-btn" type="button">With message</button>
        <button (click)="openWithUpdate()" class="sb-notification-btn sb-notification-btn--loading" type="button">
          Loading → success
        </button>
        <button (click)="manager.dismissAll()" class="sb-notification-btn sb-notification-btn--dismiss" type="button">
          Dismiss all
        </button>
      </div>
    </div>
  `,
  imports: [NOTIFICATION_IMPORTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styles: `
    .sb-notification-controls {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 24px;
      font-family: sans-serif;
    }

    .sb-notification-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .sb-notification-btn {
      padding: 8px 16px;
      border: 1px solid #444;
      border-radius: 6px;
      background: #1a1a1a;
      color: #fff;
      cursor: pointer;
      font-size: 13px;
    }

    .sb-notification-btn--success {
      border-color: #22c55e;
      color: #22c55e;
    }
    .sb-notification-btn--info {
      border-color: #60a5fa;
      color: #60a5fa;
    }
    .sb-notification-btn--error {
      border-color: #ef4444;
      color: #ef4444;
    }
    .sb-notification-btn--loading {
      border-color: #a78bfa;
      color: #a78bfa;
    }
    .sb-notification-btn--dismiss {
      border-color: #6b7280;
      color: #6b7280;
    }
  `,
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
