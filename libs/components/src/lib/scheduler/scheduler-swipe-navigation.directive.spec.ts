import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchedulerDirective } from './headless';
import {
  SchedulerSwipeNavigationConfig,
  SchedulerSwipeNavigationDirective,
} from './scheduler-swipe-navigation.directive';

@Component({
  template: `
    <div [(focusedDate)]="focusedDate" [etSchedulerSwipeNavigation]="config()" [firstDayOfWeek]="1" etScheduler></div>
  `,
  imports: [SchedulerDirective, SchedulerSwipeNavigationDirective],
})
class SwipeNavigationTestHostComponent {
  focusedDate = signal(new Date(2026, 6, 15));
  config = signal<SchedulerSwipeNavigationConfig>({});
}

const touchEvent = (type: string, clientX: number, clientY: number) => {
  const touch = { clientX, clientY } as Touch;
  const event = new Event(type, { bubbles: true, cancelable: true });

  return Object.assign(event, { touches: [touch], targetTouches: [touch], changedTouches: [touch] });
};

describe('SchedulerSwipeNavigationDirective', () => {
  let fixture: ComponentFixture<SwipeNavigationTestHostComponent>;
  let host: SwipeNavigationTestHostComponent;
  let element: HTMLElement;

  const drag = (from: [number, number], to: [number, number]) => {
    element.dispatchEvent(touchEvent('touchstart', from[0], from[1]));
    element.dispatchEvent(touchEvent('touchmove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2));
    element.dispatchEvent(touchEvent('touchmove', to[0], to[1]));
    element.dispatchEvent(touchEvent('touchend', to[0], to[1]));
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SwipeNavigationTestHostComponent] });
    fixture = TestBed.createComponent(SwipeNavigationTestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.debugElement.children[0]!.nativeElement;
  });

  it('steps to the next period on a swipe toward the inline start', () => {
    drag([300, 200], [100, 200]);

    expect(host.focusedDate()).toEqual(new Date(2026, 7, 15));
  });

  it('steps to the previous period on a swipe toward the inline end', () => {
    drag([100, 200], [300, 200]);

    expect(host.focusedDate()).toEqual(new Date(2026, 5, 15));
  });

  it('ignores a movement too short to be a swipe', () => {
    drag([300, 200], [280, 200]);

    expect(host.focusedDate()).toEqual(new Date(2026, 6, 15));
  });

  it('ignores a vertical drag, which is scrolling the view', () => {
    drag([200, 400], [200, 100]);

    expect(host.focusedDate()).toEqual(new Date(2026, 6, 15));
  });

  it('leaves the gesture alone once a drag-to-create range is being drawn', () => {
    const scheduler = fixture.debugElement.children[0]!.injector.get(SchedulerDirective);

    element.dispatchEvent(touchEvent('touchstart', 300, 200));
    scheduler.setDraftRange({ start: new Date(2026, 6, 15), end: new Date(2026, 6, 16) });
    element.dispatchEvent(touchEvent('touchmove', 100, 200));
    element.dispatchEvent(touchEvent('touchend', 100, 200));

    expect(host.focusedDate()).toEqual(new Date(2026, 6, 15));
  });

  it('does nothing while disabled', () => {
    host.config.set({ enabled: false });
    fixture.detectChanges();

    drag([300, 200], [100, 200]);

    expect(host.focusedDate()).toEqual(new Date(2026, 6, 15));
  });
});
