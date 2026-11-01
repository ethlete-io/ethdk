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
  // eslint-disable-next-line ethlete/no-native-html-input-name -- the design state key and the harness input are named title
  public title = input.required<string>();
  public message = input.required<string>();

  protected ref = computed(() =>
    createNotificationRef(
      { status: 'error', title: this.title(), message: this.message() },
      { managerConfig: DEFAULT_NOTIFICATION_MANAGER_CONFIG },
    ),
  );

  // eslint-disable-next-line ethlete/prefer-present-tense-output -- the design wires the dismiss button to emit:dismissed
  public dismissed = outputFromObservable(toObservable(this.ref).pipe(switchMap((ref) => ref.afterDismissed())));
}
