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
      <span class="et-sb-custom-toast-status">{{ notification.status() }}</span>
      <strong>{{ notification.title() }}</strong>
      @if (notification.message(); as message) {
        <span class="et-sb-custom-toast-message">{{ message }}</span>
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
      min-width: 32rem;
      padding: 1.2rem 1.6rem 1.2rem 2rem;
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
      gap: 0.2rem;
    }

    .et-sb-custom-toast-status {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.6;
    }

    .et-sb-custom-toast-message {
      opacity: 0.8;
    }
  `,
})
export class CustomToastStorybookComponent {
  protected notification = inject(NotificationDirective);
}

@Component({
  selector: 'et-sb-notification-default-demo',
  template: `<button (click)="open()" et-button size="sm" variant="outline">Show default toast</button>`,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  providers: [provideNotificationManager({ position: 'top-center' })],
})
export class NotificationDefaultDemoStorybookComponent {
  private manager = injectNotificationManager();

  protected open() {
    this.manager.open({ status: 'success', title: 'Item archived', message: 'Rendered by et-notification.' });
  }
}

@Component({
  selector: 'et-sb-notification-custom',
  template: `
    <div [style.max-inline-size.px]="720" class="flex flex-col gap-8 p-8 font-sans">
      <div class="flex flex-col gap-2">
        <h3 class="m-0 text-h5">Custom notification component</h3>
        <p class="m-0 text-medium opacity-70">
          By default the manager renders every toast with <code>et-notification</code>: an icon, title, message and
          buttons in the library's own look. Pass your own <code>component</code> in the manager config and it replaces
          that markup entirely. The component is built on the headless directives (<code>etNotification</code>,
          <code>etNotificationAction</code>, <code>etNotificationDismiss</code>), so the stack, timing, deduping and
          swipe-to-dismiss behave the same.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-8">
        <div class="flex flex-col items-start gap-3">
          <h4 class="m-0 text-base">Default</h4>
          <p class="m-0 text-small opacity-70">Opens at the top with <code>et-notification</code>.</p>
          <et-sb-notification-default-demo />
        </div>

        <div class="flex flex-col items-start gap-3">
          <h4 class="m-0 text-base">Custom component</h4>
          <p class="m-0 text-small opacity-70">
            Opens at the bottom as an app-owned pill with a status label and its own buttons.
          </p>
          <div class="flex flex-wrap gap-2">
            <button (click)="openInfo()" et-button size="sm" variant="outline">Show custom toast</button>
            <button (click)="openWithAction()" et-button size="sm" variant="tonal">With action</button>
          </div>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, NotificationDefaultDemoStorybookComponent],
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
