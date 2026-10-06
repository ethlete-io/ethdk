import { Component, ViewEncapsulation, inject } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { NotificationActionDirective } from '../../headless/notification-action.directive';
import { NotificationDismissDirective } from '../../headless/notification-dismiss.directive';
import { NotificationSwipeToDismissDirective } from '../../headless/notification-swipe-to-dismiss.directive';
import { NotificationDirective } from '../../headless/notification.directive';
import { injectNotificationManager, provideNotificationManager } from '../../notification-manager';

@Component({
  selector: 'et-sb-custom-toast',
  template: `
    <div class="et-sb-custom-toast-body">
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
  host: {
    class: 'et-sb-custom-toast',
  },
  styles: `
    .et-sb-custom-toast {
      display: flex;
      align-items: center;
      gap: 1.2rem;
      min-width: 28rem;
      padding: 1.2rem 1.6rem;
      border-radius: 99rem;
      background: var(--et-surface-background-solid, #fff);
      color: var(--et-surface-color-solid, #111);
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
      font-family: sans-serif;
      font-size: 1.4rem;
    }

    .et-sb-custom-toast-body {
      display: flex;
      flex: 1;
      flex-direction: column;
    }
  `,
})
export class CustomToastStorybookComponent {
  protected notification = inject(NotificationDirective);
}

@Component({
  selector: 'et-sb-notification-custom',
  template: `
    <div class="flex gap-2 p-8">
      <button (click)="openInfo()" et-button size="sm" variant="outline">Info</button>
      <button (click)="openWithAction()" et-button size="sm" variant="tonal">With action</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'bottom-center', component: CustomToastStorybookComponent })],
})
export class NotificationCustomStorybookComponent {
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
