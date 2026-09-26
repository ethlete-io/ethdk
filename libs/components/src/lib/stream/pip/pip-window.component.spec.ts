import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

  return { fixture, pipWindow };
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
