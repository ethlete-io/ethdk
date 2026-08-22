import '../../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../../testing/destroyed-mid-gesture';
import { pointerEvent } from '../../testing/driver-core';
import { NotificationRef } from '../notification-ref';
import { createNotificationHarness } from '../testing/notification-driver';

const drag = (element: HTMLElement, dx: number, dy = 0, pointerId = 1) => {
  pointerEvent(element, 'pointerdown', {
    pointerId,
    isPrimary: true,
    pointerType: 'touch',
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  pointerEvent(document, 'pointermove', { pointerId, clientX: dx, clientY: dy });
};

const release = (dx: number, dy = 0, pointerId = 1) =>
  pointerEvent(document, 'pointerup', { pointerId, clientX: dx, clientY: dy });

const cancel = (pointerId = 1) => pointerEvent(document, 'pointercancel', { pointerId });

describe('NotificationSwipeToDismissDirective', () => {
  it('follows a committed drag, fading proportionally to how far it has travelled', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    drag(element, 60);

    expect(element.style.transform).toBe('translateX(60px)');
    expect(Number(element.style.getPropertyValue('--_et-notification-swipe-opacity'))).toBeLessThan(1);

    release(60);
  });

  it('dismisses a notification dragged past the distance floor', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    harness.dismiss(ref);

    expect(ref.entry().isDismissed).toBe(true);
    expect(element.getAttribute('data-swiped-away')).toBe('');
    expect(parseFloat(element.style.transitionDuration)).toBeGreaterThanOrEqual(100);
    expect(parseFloat(element.style.transitionDuration)).toBeLessThanOrEqual(350);

    const exitX = parseFloat(element.style.getPropertyValue('--_et-notification-swipe-exit-x'));
    expect(exitX).toBeGreaterThanOrEqual(element.offsetWidth);
  });

  it('settles back and resumes the timer when the drag falls short of the distance floor', () => {
    // A real drag never releases at the exact instant it started; a synchronous test does, which
    // would otherwise price a 20px move as an infinite-speed flick. Pinning `Date.now()` keeps the
    // release velocity at 0, so only the (too-short) distance decides the outcome.
    vi.useFakeTimers({ toFake: ['Date'] });

    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading', duration: 4000 });
    const element = harness.elementFor(ref)!;

    const resumeReasons: unknown[] = [];
    const resumeTimer = ref.resumeTimer;
    ref.resumeTimer = (reason) => {
      resumeReasons.push(reason);
      resumeTimer(reason);
    };

    drag(element, 20);
    release(20);

    expect(ref.entry().isDismissing).toBe(false);
    expect(element.style.transform).toBe('translateX(0px)');
    expect(element.style.getPropertyValue('--_et-notification-swipe-opacity')).toBe('1');
    expect(resumeReasons).toEqual(['gesture']);

    vi.useRealTimers();
  });

  it('settles back and resumes the timer when the gesture is cancelled', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    drag(element, 60);
    cancel();

    expect(ref.entry().isDismissing).toBe(false);
    expect(element.style.transform).toBe('translateX(0px)');
  });

  it('holds the auto-dismiss timer for the whole gesture, and lets it resume once released', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Saved', duration: 4000 });
    const element = harness.elementFor(ref)!;

    drag(element, 20);
    vi.advanceTimersByTime(5000);
    expect(ref.entry().isDismissing).toBe(false);

    release(20);
    vi.advanceTimersByTime(4000);
    expect(ref.entry().isDismissing).toBe(true);

    vi.useRealTimers();
  });

  it('forgets a drag that turns out to be a vertical scroll, without ever committing it', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    const resumeReasons: unknown[] = [];
    const resumeTimer = ref.resumeTimer;
    ref.resumeTimer = (reason) => {
      resumeReasons.push(reason);
      resumeTimer(reason);
    };

    pointerEvent(element, 'pointerdown', {
      pointerId: 1,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    pointerEvent(document, 'pointermove', { pointerId: 1, clientX: 5, clientY: 60 });

    expect(element.style.transform).toBe('');
    expect(resumeReasons).toEqual(['gesture']);

    release(5, 60);
    expect(ref.entry().isDismissing).toBe(false);
  });

  it('ignores a drag started on an interactive descendant', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;
    const button = element.querySelector<HTMLButtonElement>('[data-testid="action"]')!;

    drag(button, 60);

    expect(element.style.transform).toBe('');
  });

  it('ignores a drag started where a descendant already claims the pointer axis', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;
    const guard = element.querySelector<HTMLElement>('[data-testid="axis-guard"]')!;

    drag(guard, 60);

    expect(element.style.transform).toBe('');
  });

  it('ignores a non-primary pointer and a secondary mouse button', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    pointerEvent(element, 'pointerdown', {
      pointerId: 1,
      isPrimary: false,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    pointerEvent(document, 'pointermove', { pointerId: 1, clientX: 60, clientY: 0 });
    expect(element.style.transform).toBe('');

    pointerEvent(element, 'pointerdown', {
      pointerId: 2,
      isPrimary: true,
      pointerType: 'mouse',
      button: 2,
      clientX: 0,
      clientY: 0,
    });
    pointerEvent(document, 'pointermove', { pointerId: 2, clientX: 60, clientY: 0 });
    expect(element.style.transform).toBe('');
  });

  it('ignores a second pointerdown while a gesture is already active', () => {
    const harness = createNotificationHarness();
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    drag(element, 60);
    pointerEvent(element, 'pointerdown', {
      pointerId: 2,
      isPrimary: true,
      pointerType: 'touch',
      button: 0,
      clientX: 0,
      clientY: 0,
    });
    pointerEvent(document, 'pointermove', { pointerId: 2, clientX: 5, clientY: 0 });

    expect(element.style.transform).toBe('translateX(60px)');

    release(60);
  });

  it('never engages when the manager config turns swipeToDismiss off', () => {
    const harness = createNotificationHarness({ swipeToDismiss: false });
    const ref = harness.open({ status: 'info', title: 'Uploading' });
    const element = harness.elementFor(ref)!;

    harness.dismiss(ref);

    expect(element.style.transform).toBe('');
    expect(ref.entry().isDismissing).toBe(false);
  });

  it('flips the commit direction for a stack docked to the inline start', () => {
    const harness = createNotificationHarness({ position: 'bottom-start' });
    const wrongWay = harness.open({ status: 'info', title: 'One' });
    const rightWay = harness.open({ status: 'info', title: 'Two' });

    harness.dismiss(wrongWay, { direction: 1 });
    expect(wrongWay.entry().isDismissed).toBe(false);
    expect(harness.elementFor(wrongWay)!.style.transform).toBe('');

    harness.dismiss(rightWay, { direction: -1 });
    expect(rightWay.entry().isDismissed).toBe(true);
  });

  it('flips the commit direction under a right-to-left writing direction', () => {
    const harness = createNotificationHarness({ position: 'bottom-end' });
    const ref = harness.open({ status: 'info', title: 'One' });
    harness.elementFor(ref)!.style.direction = 'rtl';

    harness.dismiss(ref, { direction: -1 });

    expect(ref.entry().isDismissed).toBe(true);
  });

  it('dismisses either direction for a center-docked stack', () => {
    const harness = createNotificationHarness({ position: 'bottom-center' });
    const toTheRight = harness.open({ status: 'info', title: 'One' });
    const toTheLeft = harness.open({ status: 'info', title: 'Two' });

    harness.dismiss(toTheRight, { direction: 1 });
    harness.dismiss(toTheLeft, { direction: -1 });

    expect(toTheRight.entry().isDismissed).toBe(true);
    expect(toTheLeft.entry().isDismissed).toBe(true);
  });

  it('stops reacting to the drag once the notification is destroyed mid-gesture', async () => {
    const harness = createNotificationHarness();
    let ref!: NotificationRef;

    const activity = await expectNothingRunsAfterDestroy({
      fixture: harness.fixture,
      start: () => {
        ref = harness.open({ status: 'info', title: 'Uploading' });
        drag(harness.elementFor(ref)!, 60);
      },
      settle: () => harness.advance(),
    });

    expect(activity.listenersRegistered).toBeGreaterThan(0);
    expect(ref.entry().isDismissing).toBe(false);
  });
});
