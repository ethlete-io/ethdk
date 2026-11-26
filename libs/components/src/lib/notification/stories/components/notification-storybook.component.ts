import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ViewEncapsulation, effect, inject, input, signal } from '@angular/core';
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
        <button (click)="openWithTwoActions()" et-button size="sm" variant="tonal">Two actions</button>
        <button (click)="openWithMessage()" et-button size="sm" variant="tonal">With message</button>
        <button (click)="openWithUpdate()" et-button size="sm" variant="tonal">Loading → Success</button>
      </div>

      <div class="flex flex-wrap gap-2">
        <button (click)="openDeduped()" et-button size="sm" variant="outline">
          Same id (clicked {{ dedupeClicks() }}×)
        </button>
        <button (click)="openWithCustomIcon()" et-button size="sm" variant="outline">Custom icon</button>
        <button (click)="openWithoutIcon()" et-button size="sm" variant="outline">No icon</button>
        <button (click)="manager.dismissAll()" et-button size="sm" variant="transparent">Dismiss all</button>
      </div>

      <p class="m-0 text-xs text-slate-500">Drag a notification toward the edge its stack sits on to flick it away.</p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NOTIFICATION_IMPORTS, BUTTON_IMPORTS],
})
export class NotificationStorybookComponent {
  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
  protected manager = injectNotificationManager();

  /**
   * The stack is appended to the body, so it inherits its writing direction from the document root -
   * not from this component. Toggling it here is the only way to see the `start`/`end` positions and
   * the slide-in animation flip.
   */
  public direction = input<'' | 'rtl'>('');

  protected dedupeClicks = signal(0);

  constructor() {
    const root = this.document.documentElement;
    const initialDir = root.dir;

    effect(() => (root.dir = this.direction() || initialDir));
    this.destroyRef.onDestroy(() => (root.dir = initialDir));
  }

  public openSuccess() {
    this.manager.open({
      status: 'success',
      title: 'Changes saved',
      message: 'Your profile has been updated.',
    });
  }

  public openInfo() {
    this.manager.open({
      status: 'info',
      title: 'Update available',
      message: 'A new version is ready to install.',
    });
  }

  public openError() {
    this.manager.open({
      status: 'error',
      title: 'Upload failed',
      message: 'The file could not be uploaded. Please check your connection and try again.',
    });
  }

  public openLoading() {
    this.manager.open({ status: 'loading', title: 'Uploading…', message: 'Please wait.' });
  }

  public openWithAction() {
    this.manager.open({
      status: 'info',
      title: 'File deleted',
      message: 'report-q4-final-v2.pdf was moved to trash.',
      action: { label: 'Undo', handler: () => alert('Undo!') },
    });
  }

  public openWithTwoActions() {
    this.manager.open({
      status: 'info',
      title: 'Delete this file?',
      message: 'report-q4-final-v2.pdf will be moved to trash.',
      action: { label: 'Delete', handler: () => alert('Deleted!') },
      secondaryAction: { label: 'Keep', handler: () => undefined },
    });
  }

  /** Every click lands on the same notification instead of stacking a fifth "message sent" toast. */
  public openDeduped() {
    this.dedupeClicks.update((clicks) => clicks + 1);

    this.manager.open({
      id: 'deduped',
      status: 'success',
      title: 'Message sent',
      message: `${this.dedupeClicks()} message${this.dedupeClicks() === 1 ? '' : 's'} sent so far.`,
      duration: 0,
    });
  }

  public openWithCustomIcon() {
    this.manager.open({ status: 'info', title: 'Time is up', icon: 'et-clock' });
  }

  public openWithoutIcon() {
    this.manager.open({ status: 'success', title: 'Changes saved', icon: null });
  }

  public openWithMessage() {
    this.manager.open({
      status: 'success',
      title: 'Profile updated',
      message: 'Your profile picture and bio have been updated successfully.',
    });
  }

  public openWithUpdate() {
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
