import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { flushFrames, pointerEvent } from '../../testing/driver-core';
import { fakeLayout } from '../../testing/fake-layout';
import { createOverlayDriver } from '../../testing/overlay-driver';
import { ToggletipContent, ToggletipDirective } from './toggletip.directive';

@Component({
  template: `
    <button etToggletip type="button">Trigger</button>

    <ng-template #toggletipTemplate>
      <span class="toggletip-template-content">Template toggletip</span>
    </ng-template>
  `,
  imports: [ToggletipDirective],
})
class ToggletipDirectiveTestHost {
  toggletipTemplate = viewChild.required<TemplateRef<unknown>>('toggletipTemplate');
}

@Component({
  template: `
    <button class="toggletip-trigger" etToggletip="More information" type="button">Trigger</button>
    <input class="outside-input" type="text" />
  `,
  imports: [ToggletipDirective],
})
class ToggletipNeighbourTestHost {}

describe('ToggletipDirective', () => {
  let fixture: ComponentFixture<ToggletipDirectiveTestHost>;
  let button: HTMLButtonElement;
  let toggletipDirective: ToggletipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToggletipDirectiveTestHost],
    });

    fixture = TestBed.createComponent(ToggletipDirectiveTestHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
    toggletipDirective = fixture.debugElement.query(By.directive(ToggletipDirective)).injector.get(ToggletipDirective);
    setInputSignal(toggletipDirective.content, 'More information' satisfies ToggletipContent);
    fixture.detectChanges();
  });

  afterEach(() => {
    toggletipDirective.hide();
    fixture.detectChanges();
  });

  it('exposes dialog trigger semantics while closed', () => {
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('data-toggletip-open')).toBeNull();
    expect(button.getAttribute('aria-controls')).toBeNull();
  });

  it('opens with the string content as the accessible label', () => {
    toggletipDirective.show();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('data-toggletip-open')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(toggletipDirective.overlayRef()?.config.id ?? null);
    expect(toggletipDirective.overlayRef()?.config.ariaLabel).toBe('More information');
  });

  it('re-renders content that changes while open', () => {
    toggletipDirective.show();
    fixture.detectChanges();

    setInputSignal(toggletipDirective.content, 'Second content');
    fixture.detectChanges();

    const panelId = toggletipDirective.overlayRef()?.config.id ?? '';
    expect(document.getElementById(panelId)?.textContent).toContain('Second content');
  });

  it('clears its open state when disabled after opening', () => {
    toggletipDirective.show();
    fixture.detectChanges();

    setInputSignal(toggletipDirective.disabled, true);
    fixture.detectChanges();

    expect(toggletipDirective.open()).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBeNull();
    expect(button.getAttribute('aria-haspopup')).toBeNull();
  });

  it('reopens when shown again while its leave transition is still running', async () => {
    fakeLayout([
      { match: 'html', clientWidth: 1024, clientHeight: 768 },
      { match: 'button', rect: { x: 100, y: 100, width: 80, height: 32 } },
    ]);

    toggletipDirective.show();
    fixture.detectChanges();
    await flushFrames();

    toggletipDirective.hide();
    fixture.detectChanges();
    toggletipDirective.show();
    fixture.detectChanges();

    await flushFrames();
    fixture.detectChanges();
    await flushFrames();

    expect(toggletipDirective.open()).toBe(true);
    expect(toggletipDirective.overlayRef()).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves focus on the element an outside press moved it to', async () => {
    fakeLayout([
      { match: 'html', clientWidth: 1024, clientHeight: 768 },
      { match: '.toggletip-trigger', rect: { x: 100, y: 100, width: 80, height: 32 } },
    ]);

    const neighbourFixture = TestBed.createComponent(ToggletipNeighbourTestHost);
    neighbourFixture.detectChanges();

    const driver = createOverlayDriver(neighbourFixture);
    const directive = neighbourFixture.debugElement
      .query(By.directive(ToggletipDirective))
      .injector.get(ToggletipDirective);
    const trigger = neighbourFixture.nativeElement.querySelector('.toggletip-trigger') as HTMLButtonElement;
    const input = neighbourFixture.nativeElement.querySelector('.outside-input') as HTMLInputElement;

    trigger.focus();
    await driver.openVia(() => {
      directive.show();
      neighbourFixture.detectChanges();
    });

    expect(directive.open()).toBe(true);

    pointerEvent(input, 'pointerdown');
    input.focus();
    await driver.settle();
    await driver.settle();

    expect(directive.open()).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('throws when template content is used without an accessible label', () => {
    setInputSignal(toggletipDirective.content, fixture.componentInstance.toggletipTemplate());
    fixture.detectChanges();

    expect(() => {
      toggletipDirective.show();
      fixture.detectChanges();
    }).toThrow(/Template toggletips require etToggletipAriaLabel or etToggletipAriaLabelledBy/);
  });
});
