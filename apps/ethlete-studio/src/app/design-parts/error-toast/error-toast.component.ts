import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { outputFromObservable, toObservable } from '@angular/core/rxjs-interop';
import { createNotificationRef, DEFAULT_NOTIFICATION_MANAGER_CONFIG, NOTIFICATION_IMPORTS } from '@ethlete/components';
import { switchMap } from 'rxjs';

@Component({
  selector: 'ethlete-error-toast',
  template: `<et-notification [ref]="ref()" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [NOTIFICATION_IMPORTS],
  host: { class: 'flex flex-col items-end' },
})
export class ErrorToastComponent {
  public heading = input.required<string>();
  public message = input.required<string>();

  protected ref = computed(() =>
    createNotificationRef(
      { status: 'error', title: this.heading(), message: this.message() },
      { managerConfig: DEFAULT_NOTIFICATION_MANAGER_CONFIG },
    ),
  );

  public dismiss = outputFromObservable(toObservable(this.ref).pipe(switchMap((ref) => ref.afterDismissed())));
}
