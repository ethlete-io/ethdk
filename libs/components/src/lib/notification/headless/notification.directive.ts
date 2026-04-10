import { Directive, Signal, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { filter, of, switchMap, take, tap } from 'rxjs';
import { NotificationAction, NotificationStatus } from '../notification-config';
import { NotificationEntry, NotificationRef } from '../notification-ref';
import { NotificationActionDirective } from './notification-action.directive';
import { NotificationDismissDirective } from './notification-dismiss.directive';

@Directive({
  selector: '[etNotification]',
  exportAs: 'etNotification',
  host: {
    '[attr.data-status]': 'status()',
    '[attr.data-dismissing]': 'entry().isDismissing || null',
  },
})
export class NotificationDirective {
  ref = input.required<NotificationRef>();

  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN, { optional: true });

  entry: Signal<NotificationEntry> = computed(() => this.ref().entry());
  status: Signal<NotificationStatus> = computed(() => this.entry().config.status);
  isLoading = computed(() => this.status() === 'loading');
  isSuccess = computed(() => this.status() === 'success');
  isError = computed(() => this.status() === 'error');
  isInfo = computed(() => this.status() === 'info');
  title = computed(() => this.entry().config.title);
  message = computed(() => this.entry().config.message);
  action: Signal<NotificationAction | undefined> = computed(() => this.entry().config.action);
  progress = computed(() => this.entry().config.progress);

  /** @internal */
  registeredAction = signal<NotificationActionDirective | null>(null);
  /** @internal */
  registeredDismiss = signal<NotificationDismissDirective | null>(null);

  constructor() {
    toObservable(computed(() => this.entry().isDismissing))
      .pipe(
        filter(Boolean),
        take(1),
        switchMap(() => {
          const lifecycle = this.animatedLifecycle;
          if (!lifecycle) {
            return of(null);
          }
          lifecycle.leave();
          return lifecycle.state$.pipe(
            filter((s) => s === 'left'),
            take(1),
          );
        }),
        takeUntilDestroyed(),
        tap(() => this.ref().markDismissed()),
      )
      .subscribe();
  }
}
