import { Directive, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ANIMATED_LIFECYCLE_TOKEN } from '@ethlete/core';
import { filter, of, switchMap, take, tap } from 'rxjs';
import { NotificationRef } from '../notification-ref';
import { NotificationActionDirective } from './notification-action.directive';
import { NotificationDismissDirective } from './notification-dismiss.directive';

@Directive({
  selector: '[etNotification]',
  exportAs: 'etNotification',
  host: {
    '[attr.data-status]': 'status()',
    '[attr.data-dismissing]': 'entry().isDismissing || null',
    '[attr.role]': 'ariaRole()',
  },
})
export class NotificationDirective {
  private animatedLifecycle = inject(ANIMATED_LIFECYCLE_TOKEN, { optional: true });
  public ref = input.required<NotificationRef>();

  public entry = computed(() => this.ref().entry());
  public status = computed(() => this.entry().config.status);
  public isLoading = computed(() => this.status() === 'loading');
  public isSuccess = computed(() => this.status() === 'success');
  public isError = computed(() => this.status() === 'error');
  public isInfo = computed(() => this.status() === 'info');
  public title = computed(() => this.entry().config.title);
  public message = computed(() => this.entry().config.message);
  public action = computed(() => this.entry().config.action);
  public secondaryAction = computed(() => this.entry().config.secondaryAction);
  public progress = computed(() => this.entry().config.progress);

  /** The notification's own icon override - `undefined` leaves the icon to its status, `null` means none. */
  public icon = computed(() => this.entry().config.icon);

  public ariaRole = computed(() => (this.status() === 'error' ? 'alert' : 'status'));

  /** @internal Every action element inside this notification - one per slot at most, in registration order. */
  public registeredActions = signal<NotificationActionDirective[]>([]);
  /** @internal */
  public registeredDismiss = signal<NotificationDismissDirective | null>(null);

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
