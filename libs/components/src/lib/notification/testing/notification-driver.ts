import { Component, signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { mountControl } from '../../testing/control-driver';
import { flushFrames, pointerEvent, query, tick } from '../../testing/driver-core';
import { fakeLayout } from '../../testing/fake-layout';
import { NotificationSwipeToDismissDirective } from '../headless/notification-swipe-to-dismiss.directive';
import { NotificationDirective } from '../headless/notification.directive';
import {
  DEFAULT_NOTIFICATION_MANAGER_CONFIG,
  NotificationConfig,
  NotificationManagerConfig,
  provideNotificationManagerConfig,
} from '../notification-config';
import { NotificationRef, createNotificationRef } from '../notification-ref';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from '../notification-stack-context.token';

/** The notification's `offsetWidth` under {@link fakeLayout} - jsdom itself never measures it. */
const NOTIFICATION_WIDTH_PX = 300;

@Component({
  template: `
    @for (ref of refs(); track ref.id) {
      <div
        [attr.data-ref-id]="ref.id"
        [ref]="ref"
        class="notification-harness-item"
        etNotification
        etNotificationSwipeToDismiss
      >
        <button type="button" data-testid="action">Action</button>
        <div data-testid="axis-guard" style="touch-action: none"></div>
      </div>
    }
  `,
  imports: [NotificationDirective, NotificationSwipeToDismissDirective],
})
class NotificationHarnessHost {
  public refs = signal<NotificationRef[]>([]);
}

export type SwipeDismissOptions = {
  /** Physical direction the drag throws the notification toward. @default 1 */
  direction?: 1 | -1;
  /** Pointer travel along the swipe axis, in px. Defaults to comfortably past the dismiss floor. */
  distance?: number;
};

export type NotificationHarness = {
  fixture: ComponentFixture<unknown>;
  /** Opens a notification against the harness's manager config and renders it. Returns its ref. */
  open: (config: NotificationConfig) => NotificationRef;
  /** The refs open in the harness, in render order. */
  refs: () => NotificationRef[];
  /** The rendered element for `ref`, or `null` once it has been removed. */
  elementFor: (ref: NotificationRef) => HTMLElement | null;
  /** Flushes pending change detection and animation frames. */
  advance: () => Promise<void>;
  /** Drives a full pointer-drag gesture that swipes `ref` past the dismiss threshold and releases it. */
  dismiss: (ref: NotificationRef, options?: SwipeDismissOptions) => void;
};

/**
 * Mounts `[etNotification][etNotificationSwipeToDismiss]` hosts against a real
 * `NotificationManagerConfig` / stack context, without the rest of `et-notification`'s chrome - the
 * swipe directive only needs `NotificationDirective` for its ref and pause/resume calls.
 */
export const createNotificationHarness = (config: Partial<NotificationManagerConfig> = {}): NotificationHarness => {
  const managerConfig: NotificationManagerConfig = {
    ...DEFAULT_NOTIFICATION_MANAGER_CONFIG,
    defaultDuration: { success: 0, info: 0, loading: 0, error: 0 },
    ...config,
  };

  fakeLayout([{ match: '.notification-harness-item', offsetWidth: NOTIFICATION_WIDTH_PX }]);

  const fixture = mountControl(NotificationHarnessHost, [
    provideNotificationManagerConfig(managerConfig),
    {
      provide: NOTIFICATION_STACK_CONTEXT_TOKEN,
      useValue: {
        visibleNotifications: signal<NotificationRef[]>([]),
        position: managerConfig.position,
        captureBeforeState: null,
      },
    },
  ]);

  const host = fixture.componentInstance;

  const elementFor = (ref: NotificationRef) => query<HTMLElement>(fixture, `[data-ref-id="${ref.id}"]`);

  const open = (notificationConfig: NotificationConfig): NotificationRef => {
    const ref = createNotificationRef(notificationConfig, { managerConfig });

    host.refs.update((refs) => [...refs, ref]);
    fixture.detectChanges();

    // jsdom implements no PointerEvent capture, and `trackGesture` calls it unconditionally once a
    // drag commits.
    const element = elementFor(ref);
    if (element) element.setPointerCapture = () => undefined;

    return ref;
  };

  const advance = async () => {
    await flushFrames();
    tick();
  };

  const dismiss = (ref: NotificationRef, { direction = 1, distance }: SwipeDismissOptions = {}) => {
    const element = elementFor(ref)!;
    const travel = (distance ?? Math.max(element.offsetWidth * 0.6, 120)) * direction;
    const pointerId = 1;

    pointerEvent(element, 'pointerdown', {
      pointerId,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    pointerEvent(document, 'pointermove', { pointerId, clientX: travel, clientY: 0 });
    pointerEvent(document, 'pointerup', { pointerId, clientX: travel, clientY: 0 });
  };

  return { fixture, open, refs: host.refs, elementFor, advance, dismiss };
};
