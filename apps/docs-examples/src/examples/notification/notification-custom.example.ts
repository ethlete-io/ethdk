import { Component, inject, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  CIRCLE_CHECK_ICON,
  CIRCLE_INFO_ICON,
  ICON_IMPORTS,
  injectNotificationManager,
  NotificationActionDirective,
  NotificationDirective,
  NotificationDismissDirective,
  NotificationSwipeToDismissDirective,
  provideIcons,
  provideNotificationManager,
  TIMES_ICON,
} from '@ethlete/components';
import { AnimatedLifecycleDirective } from '@ethlete/core';

@Component({
  selector: 'app-custom-toast',
  template: `
    <i [etIcon]="notification.isSuccess() ? 'et-circle-check' : 'et-circle-info'" class="app-custom-toast-icon"></i>
    <div class="app-custom-toast-body">
      <span class="app-custom-toast-title">{{ notification.title() }}</span>
      @if (notification.message(); as message) {
        <span class="app-custom-toast-message">{{ message }}</span>
      }
    </div>
    @if (notification.action(); as action) {
      <button etNotificationAction et-text-button size="sm">{{ action.label }}</button>
    }
    <button etNotificationDismiss et-icon-button size="xs" type="button" aria-label="Close">
      <i etIcon="et-times"></i>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NotificationActionDirective, NotificationDismissDirective, BUTTON_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(TIMES_ICON, CIRCLE_CHECK_ICON, CIRCLE_INFO_ICON)],
  hostDirectives: [
    { directive: NotificationDirective, inputs: ['ref'] },
    NotificationSwipeToDismissDirective,
    AnimatedLifecycleDirective,
  ],
  host: { class: 'app-custom-toast' },
  styles: `
    .app-custom-toast {
      display: flex;
      align-items: center;
      gap: 1rem;
      box-sizing: border-box;
      min-width: 32rem;
      max-width: 42rem;
      padding: 1rem 1rem 1rem 1.4rem;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 1.2rem;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
      box-shadow: 0 0.8rem 2.4rem rgb(0 0 0 / 0.18);
      pointer-events: all;
      opacity: var(--_et-notification-swipe-opacity, 1);

      &.et-animation-enter-from,
      &.et-animation-leave-to {
        opacity: 0;
      }

      &.et-animation-enter-active,
      &.et-animation-leave-active {
        transition: opacity 200ms ease;
      }
    }

    .app-custom-toast-icon {
      flex-shrink: 0;
      width: 1.8rem;
      height: 1.8rem;
      color: var(--et-surface-color-muted-solid);
    }

    .app-custom-toast[data-status='success'] .app-custom-toast-icon {
      color: var(--et-theme-color-primary-solid);
    }

    .app-custom-toast-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
    }

    .app-custom-toast-title {
      font-size: 1.4rem;
      font-weight: 600;
      line-height: 2rem;
    }

    .app-custom-toast-message {
      color: var(--et-surface-color-muted-solid);
      font-size: 1.3rem;
      line-height: 1.8rem;
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
