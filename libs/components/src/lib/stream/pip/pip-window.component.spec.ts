import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../../testing/destroyed-mid-gesture';
import { provideStreamPip } from '../stream-pip.provider';
import { PipTitleBarTemplateDirective } from './headless/pip-title-bar-template.directive';
import { PIP_WINDOW_ASPECT_RATIO_TOKEN } from './headless/pip-window-aspect-ratio.token';
import { PipWindowComponent } from './pip-window.component';

@Component({
  template: `
    <et-pip-window>
      <ng-template etPipTitleBar>Title</ng-template>
      <div>content</div>
    </et-pip-window>
  `,
  imports: [PipWindowComponent, PipTitleBarTemplateDirective],
  providers: [provideStreamPip(), { provide: PIP_WINDOW_ASPECT_RATIO_TOKEN, useValue: signal(16 / 9) }],
})
class HostComponent {}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const pipWindow = host.querySelector<HTMLElement>('et-pip-window')!;

  const component = fixture.debugElement.query(By.directive(PipWindowComponent))
    .componentInstance as PipWindowComponent;

  return { fixture, pipWindow, component };
};

const press = (target: Element, clientX: number, clientY: number) =>
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX,
      clientY,
      pointerId: 1,
      pointerType: 'mouse',
    }),
  );

const moveTo = (clientX: number, clientY: number) =>
  document.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, pointerId: 1 }));

describe('PipWindowComponent', () => {
  it('ends the drag when the pointer is released', () => {
    const { fixture, pipWindow } = create();

    press(pipWindow.querySelector('.et-pip-window__title-bar')!, 100, 100);
    moveTo(160, 140);
    fixture.detectChanges();

    expect(document.body.classList).toContain('et-pip-interacting');

    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 140, pointerId: 1 }));
    fixture.detectChanges();

    expect(document.body.classList).not.toContain('et-pip-interacting');
    expect(pipWindow.classList).not.toContain('et-pip-window--dragging');
  });
});

describe('PipWindowComponent overlapping transitions', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the title bar forced while another holder still needs it', () => {
    const { fixture, pipWindow, component } = create();
    const releaseAnimation = component.holdTitleBar();

    press(pipWindow.querySelector('.et-resize-handle--se')!, 100, 100);
    moveTo(160, 140);
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 160, clientY: 140, pointerId: 1 }));
    fixture.detectChanges();

    expect(component.forcedTitleBar()).toBe(true);
    expect(pipWindow.classList).toContain('et-pip-window--title-bar-forced');

    releaseAnimation();
    releaseAnimation();
    fixture.detectChanges();

    expect(component.forcedTitleBar()).toBe(false);
  });

  it('ends a mode transition only after the latest one has run its course', () => {
    vi.useFakeTimers();
    const { fixture, pipWindow, component } = create();

    component.posState.startModeTransition(260);
    vi.advanceTimersByTime(200);
    component.posState.startModeTransition(260);
    vi.advanceTimersByTime(100);
    fixture.detectChanges();

    expect(pipWindow.classList).toContain('et-pip-window--mode-transitioning');

    vi.advanceTimersByTime(200);

    expect(pipWindow.classList).not.toContain('et-pip-window--mode-transitioning');
  });

  it('keeps the snap transition until the latest snap has finished', () => {
    vi.useFakeTimers();
    const { component, pipWindow } = create();

    component.posState.snapToViewport();
    vi.advanceTimersByTime(100);
    component.posState.snapToViewport();
    vi.advanceTimersByTime(100);

    expect(pipWindow.style.transition).toContain('translate');

    vi.advanceTimersByTime(100);

    expect(pipWindow.style.transition).toBe('');
  });

  it('leaves an app-set user-select on the body when it never ran a gesture', () => {
    document.body.style.setProperty('user-select', 'text');
    expect(document.body.style.getPropertyValue('user-select')).toBe('text');

    const { fixture } = create();

    fixture.destroy();

    expect(document.body.style.getPropertyValue('user-select')).toBe('text');
    document.body.style.removeProperty('user-select');
  });
});

describe('PipWindowComponent destroyed mid-gesture', () => {
  it('stops dragging the window when it is destroyed mid-drag', async () => {
    const { fixture, pipWindow } = create();
    const titleBar = pipWindow.querySelector('.et-pip-window__title-bar')!;
    let styleAtDestroy = '';

    await expectNothingRunsAfterDestroy({
      fixture,
      start: () => {
        press(titleBar, 100, 100);
        moveTo(160, 140);
        fixture.detectChanges();
      },
      settle: () => {
        styleAtDestroy = pipWindow.style.cssText;
      },
    });

    expect(pipWindow.style.cssText).toBe(styleAtDestroy);
    expect(document.body.classList).not.toContain('et-pip-interacting');
  });

  it('stops resizing the window when it is destroyed mid-resize', async () => {
    const { fixture, pipWindow } = create();
    const edge = pipWindow.querySelector('.et-resize-handle--se')!;
    let styleAtDestroy = '';

    await expectNothingRunsAfterDestroy({
      fixture,
      start: () => {
        press(edge, 100, 100);
        moveTo(160, 140);
        fixture.detectChanges();
      },
      settle: () => {
        styleAtDestroy = pipWindow.style.cssText;
      },
    });

    expect(pipWindow.style.cssText).toBe(styleAtDestroy);

    expect(document.body.classList).not.toContain('et-pip-interacting');
  });
});
