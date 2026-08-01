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
import { defineRootProvider, injectRenderer, toInjectFn, toProvideFn } from '@ethlete/core';
import {
  NotificationConfig,
  NotificationManagerConfig,
  injectNotificationManagerConfig,
  provideNotificationManagerConfig,
} from './notification-config';
import { NotificationPromiseFn, createNotificationPromiseFn } from './notification-promise';
import { NotificationRef, createNotificationRef } from './notification-ref';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';
import { NotificationStackComponent } from './notification-stack.component';

export type NotificationManager = {
  /**
   * Opens a notification and returns its ref. A {@link NotificationConfig.id} that is already on
   * screen replaces that notification in place instead of stacking a duplicate.
   */
  open: (config: NotificationConfig) => NotificationRef;

  /** Opens a `loading` notification that follows a promise, observable or query — see {@link NotificationPromiseFn}. */
  promise: NotificationPromiseFn;

  dismissAll: () => void;
  notifications: Signal<NotificationRef[]>;
  visibleNotifications: Signal<NotificationRef[]>;
};

const NOTIFICATION_MANAGER_DEF = /* @__PURE__ */ defineRootProvider(
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
          ...provideNotificationManagerConfig(managerConfig),
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
      const sameId = config.id ? notifications().find((r) => r.id === config.id) : undefined;

      if (sameId) {
        const entry = sameId.entry();

        if (!entry.isDismissing && !entry.isDismissed) {
          sameId.replaceConfig(config);

          return sameId;
        }

        // That id is already leaving. Drop it now rather than let it animate out beside its
        // replacement — the stack tracks items by id, so two of them may not coexist.
        sameId.markDismissed();
        notifications.update((n) => n.filter((r) => r !== sameId));
      }

      const currentActive = notifications().filter((r) => !r.entry().isDismissing && !r.entry().isDismissed);
      if (currentActive.length >= managerConfig.maxVisible) {
        currentActive[0]?.dismiss();
      }

      beforeChange();
      const ref = createNotificationRef(config, { managerConfig, beforeChange });
      notifications.update((n) => [...n, ref]);

      return ref;
    };

    const promise = createNotificationPromiseFn({ open, injector: envInjector });

    const dismissAll = () => {
      notifications().forEach((r) => r.dismiss());
    };

    return {
      open,
      promise,
      dismissAll,
      notifications: notifications.asReadonly(),
      visibleNotifications,
    };
  },
  { name: 'NotificationManager' },
);

export const provideNotificationManagerInstance = /* @__PURE__ */ toProvideFn(NOTIFICATION_MANAGER_DEF);
export const injectNotificationManager = /* @__PURE__ */ toInjectFn(NOTIFICATION_MANAGER_DEF);

export const provideNotificationManager = (config?: Partial<NotificationManagerConfig>) => [
  ...provideNotificationManagerConfig(config),
  ...provideNotificationManagerInstance(),
];
