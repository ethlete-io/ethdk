import { Component, inject, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  injectNotificationManager,
  NotificationActionDirective,
  NotificationDirective,
  NotificationDismissDirective,
  NotificationSwipeToDismissDirective,
  provideNotificationManager,
} from '@ethlete/components';

@Component({
  selector: 'app-custom-toast',
  template: `
    <div class="app-custom-toast-body">
      <strong>{{ notification.title() }}</strong>
      @if (notification.message(); as message) {
        <span>{{ message }}</span>
      }
    </div>
    @if (notification.action(); as action) {
      <button etNotificationAction et-button size="sm">{{ action.label }}</button>
    }
    <button etNotificationDismiss et-button size="sm" variant="outline">Close</button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationActionDirective, NotificationDismissDirective, BUTTON_IMPORTS],
  hostDirectives: [{ directive: NotificationDirective, inputs: ['ref'] }, NotificationSwipeToDismissDirective],
  host: { class: 'app-custom-toast' },
  styles: `
    .app-custom-toast {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      min-width: 28rem;
      padding: 1.2rem 1.6rem;
      border-radius: 99rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    }

    .app-custom-toast-body {
      display: flex;
      flex: 1;
      flex-direction: column;
    }
  `,
})
export class CustomToastComponent {
  protected notification = inject(NotificationDirective);
}

@Component({
  selector: 'app-notification-custom-example',
  template: `
    <div class="app-example-row">
      <button (click)="openInfo()" et-button size="sm" variant="outline">Info</button>
      <button (click)="openWithAction()" et-button size="sm" variant="tonal">With action</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'bottom-center', component: CustomToastComponent })],
})
export class NotificationCustomExampleComponent {
  private manager = injectNotificationManager();

  protected openInfo() {
    this.manager.open({ status: 'info', title: 'Draft saved', message: 'A custom toast component renders this.' });
  }

  protected openWithAction() {
    this.manager.open({
      status: 'success',
      title: 'Item archived',
      duration: 0,
      action: { label: 'Undo', handler: () => this.openInfo() },
    });
  }
}
