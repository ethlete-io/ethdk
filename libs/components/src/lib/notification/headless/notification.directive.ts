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
  public progress = computed(() => this.entry().config.progress);
  public ariaRole = computed(() => (this.status() === 'error' ? 'alert' : 'status'));

  /** @internal */
  public registeredAction = signal<NotificationActionDirective | null>(null);
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
