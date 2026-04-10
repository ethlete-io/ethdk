import {
  ApplicationRef,
  ComponentRef,
  DOCUMENT,
  DestroyRef,
  EnvironmentInjector,
  Signal,
  computed,
  createComponent,
  createEnvironmentInjector,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { createRootProvider, injectRenderer } from '@ethlete/core';
import {
  NotificationConfig,
  NotificationManagerConfig,
  injectNotificationManagerConfig,
  provideNotificationManagerConfig,
} from './notification-config';
import { NotificationRef, createNotificationRef } from './notification-ref';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationStackComponent } from './notification-stack.component';

export type NotificationManager = {
  open: (config: NotificationConfig) => NotificationRef;
  dismissAll: () => void;
  notifications: Signal<NotificationRef[]>;
  visibleNotifications: Signal<NotificationRef[]>;
};

export const [provideNotificationManagerInstance, injectNotificationManager] = createRootProvider(
  (): NotificationManager => {
    const managerConfig = injectNotificationManagerConfig();
    const appRef = inject(ApplicationRef);
    const envInjector = inject(EnvironmentInjector);
    const destroyRef = inject(DestroyRef);
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();

    const notifications = signal<NotificationRef[]>([]);

    const visibleNotifications = computed(() => {
      const active = notifications().filter((r) => !r.entry().isDismissing && !r.entry().isDismissed);
      const cappedActiveIds = new Set(active.slice(-managerConfig.maxVisible).map((r) => r.id));
      // Keep insertion order stable: dismissing items stay in their original position
      return notifications().filter((r) => r.entry().isDismissing || cappedActiveIds.has(r.id));
    });

    let stackRef: ComponentRef<NotificationStackComponent> | null = null;

    const stackContext = {
      visibleNotifications,
      position: managerConfig.position,
      captureBeforeState: null as (() => void) | null,
    };

    const beforeChange = () => stackContext.captureBeforeState?.();

    const destroyStack = () => {
      if (!stackRef) return;
      appRef.detachView(stackRef.hostView);
      stackRef.destroy();
      stackRef = null;
    };

    const createStack = () => {
      const childInjector = createEnvironmentInjector(
        [
          {
            provide: NOTIFICATION_STACK_CONTEXT_TOKEN,
            useValue: stackContext,
          },
        ],
        envInjector,
      );

      stackRef = createComponent(NotificationStackComponent, { environmentInjector: childInjector });
      appRef.attachView(stackRef.hostView);
      renderer.appendChild(document.body, stackRef.location.nativeElement);
    };

    effect(() => {
      const visible = visibleNotifications();

      if (visible.length > 0 && !stackRef) {
        untracked(createStack);
      } else if (visible.length === 0 && stackRef) {
        untracked(() => {
          destroyStack();
          notifications.set([]);
        });
      }
    });

    destroyRef.onDestroy(destroyStack);

    const open = (config: NotificationConfig): NotificationRef => {
      const currentActive = notifications().filter((r) => !r.entry().isDismissing && !r.entry().isDismissed);
      if (currentActive.length >= managerConfig.maxVisible) {
        currentActive[0]?.dismiss();
      }

      beforeChange();
      const ref = createNotificationRef(config, { managerConfig, beforeChange });
      notifications.update((n) => [...n, ref]);

      return ref;
    };

    const dismissAll = () => {
      notifications().forEach((r) => r.dismiss());
    };

    return {
      open,
      dismissAll,
      notifications: notifications.asReadonly(),
      visibleNotifications,
    };
  },
  { name: 'NotificationManager' },
);

export const provideNotificationManager = (config?: Partial<NotificationManagerConfig>) => [
  ...provideNotificationManagerConfig(config),
  ...provideNotificationManagerInstance(),
];
