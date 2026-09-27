import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TOOLTIP_ERROR_CODES, TOOLTIP_IMPORTS, TooltipComponent, TooltipDirective } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-file-actions',
  imports: [TOOLTIP_IMPORTS],
  template: `
    <button
      [etTooltip]="deleteHint()"
      [etTooltipDisabled]="disabled()"
      class="delete"
      aria-describedby="delete-warning"
      type="button"
    >
      Delete
    </button>
    <p id="delete-warning">This cannot be undone.</p>
    <button [etTooltip]="shareHint" class="share" etTooltipAriaDescription="Share with team A" type="button">
      Share
    </button>
    <button #broken="etTooltip" [etTooltip]="shareHint" class="broken" type="button">Broken</button>
    <button class="other" type="button">Other</button>

    <ng-template #shareHint>
      <span class="share-hint">Share with <strong>team A</strong></span>
    </ng-template>
  `,
})
class FileActionsComponent {
  deleteHint = signal<string | null>('Delete the file');
  disabled = signal(false);
  broken = viewChild.required('broken', { read: TooltipDirective });
}

const code = (value: number) => `ET${value}`;

const query = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

const tooltip = () => document.querySelector<HTMLElement>('et-tooltip');

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const hover = (s: Scenario, target: Element, pointerType = 'mouse') => {
  target.dispatchEvent(new PointerEvent('pointerenter', { pointerType }));
  s.tick();
};

const leave = (s: Scenario, target: Element) => {
  target.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
  settle(s);
};

const describedBy = (target: Element) => (target.getAttribute('aria-describedby') ?? '').split(' ');

const render = (s: Scenario) => {
  const fixture = TestBed.createComponent(FileActionsComponent);

  document.body.appendChild(fixture.nativeElement);
  s.tick();

  return fixture;
};

@Component({
  selector: 'et-scenario-save-hint',
  imports: [TooltipDirective, TooltipComponent],
  template: `<button #hint="etTooltip" class="save" etTooltip="Save the draft" type="button">Save</button>`,
})
class SaveHintComponent {
  hint = viewChild.required('hint', { read: TooltipDirective });
}

describe('tooltip scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('shows a hover tooltip after the delay and points the description at it while open', () => {
    const s = scenario();
    const fixture = render(s);
    const trigger = query('.delete');

    const [consumerHint, idleDescription] = describedBy(trigger);

    expect(consumerHint).toBe('delete-warning');
    expect(document.getElementById(idleDescription!)?.textContent).toBe('Delete the file');

    hover(s, trigger);
    s.tick(200);
    expect(tooltip()).toBeNull();

    s.tick(100);
    settle(s);

    expect(tooltip()?.getAttribute('role')).toBe('tooltip');
    expect(tooltip()?.textContent?.trim()).toBe('Delete the file');
    expect(describedBy(trigger)).toEqual(['delete-warning', tooltip()?.id]);

    fixture.componentInstance.deleteHint.set('Delete for everyone');
    s.tick();

    expect(tooltip()?.textContent?.trim()).toBe('Delete for everyone');

    leave(s, trigger);

    expect(tooltip()).toBeNull();
    expect(describedBy(trigger)).toEqual(['delete-warning', idleDescription]);
    expect(document.getElementById(idleDescription!)?.textContent).toBe('Delete for everyone');
  });

  it('ignores touch and a pointer that leaves before the delay', () => {
    const s = scenario();

    render(s);

    const trigger = query('.delete');

    hover(s, trigger, 'touch');
    s.tick(500);
    expect(tooltip()).toBeNull();

    hover(s, trigger);
    s.tick(100);
    leave(s, trigger);
    s.tick(500);

    expect(tooltip()).toBeNull();
  });

  it('shows on keyboard focus only, and closes on Escape and blur', async () => {
    const s = scenario();

    render(s);

    const trigger = query<HTMLButtonElement>('.delete');

    document.dispatchEvent(new PointerEvent('pointerdown'));
    trigger.focus();
    settle(s);
    expect(tooltip()).toBeNull();

    trigger.blur();
    s.keydown('Tab');
    await Promise.resolve();
    trigger.focus();
    settle(s);

    expect(tooltip()?.textContent?.trim()).toBe('Delete the file');

    expect(s.keydown('Escape', trigger).defaultPrevented).toBe(true);
    settle(s);
    expect(tooltip()).toBeNull();

    trigger.blur();
    s.keydown('Tab');
    await Promise.resolve();
    trigger.focus();
    settle(s);
    expect(tooltip()).not.toBeNull();

    trigger.blur();
    settle(s);
    expect(tooltip()).toBeNull();
  });

  it('closes on a press elsewhere, and when the hint is cleared or disabled', () => {
    const s = scenario();
    const fixture = render(s);
    const page = fixture.componentInstance;
    const trigger = query('.delete');
    const open = () => {
      hover(s, trigger);
      s.tick(300);
      settle(s);
      expect(tooltip()).not.toBeNull();
    };

    open();
    query('.other').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    settle(s);
    expect(tooltip()).toBeNull();

    open();
    page.deleteHint.set(null);
    settle(s);
    expect(tooltip()).toBeNull();
    expect(describedBy(trigger)).toEqual(['delete-warning']);

    page.deleteHint.set('Delete the file');
    open();
    page.disabled.set(true);
    settle(s);
    expect(tooltip()).toBeNull();

    trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    hover(s, trigger);
    s.tick(300);
    settle(s);
    expect(tooltip()).toBeNull();
  });

  it('renders a template tooltip with its plain-text description', () => {
    const s = scenario();

    render(s);

    const trigger = query('.share');
    const [description] = describedBy(trigger);

    expect(document.getElementById(description!)?.textContent).toBe('Share with team A');

    hover(s, trigger);
    s.tick(300);
    settle(s);

    expect(tooltip()?.hasAttribute('data-has-template')).toBe(true);
    expect(tooltip()?.querySelector('.share-hint strong')?.textContent).toBe('team A');

    leave(s, trigger);
    expect(tooltip()).toBeNull();
  });

  it('reports a template tooltip without a description', () => {
    const s = scenario();

    const fixture = render(s);

    expect(() => fixture.componentInstance.broken().show()).toThrow(
      code(TOOLTIP_ERROR_CODES.TEMPLATE_TOOLTIP_REQUIRES_DESCRIPTION),
    );
    settle(s);

    expect(tooltip()).toBeNull();
    expect(query('.broken').hasAttribute('aria-describedby')).toBe(false);
  });

  it('hands the open overlay a TooltipComponent that carries the text and the described-by id', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SaveHintComponent);

    document.body.appendChild(fixture.nativeElement);
    s.tick();

    const trigger = query('.save');

    hover(s, trigger);
    s.tick(300);
    settle(s);

    const instance = fixture.componentInstance.hint().overlayRef()?.componentInstance();

    expect(instance).toBeInstanceOf(TooltipComponent);

    const component = instance as TooltipComponent;

    expect(component.hasTemplate()).toBe(false);
    expect(component.contentText()).toBe('Save the draft');
    expect(describedBy(trigger)).toContain(component.tooltipId());
    expect(tooltip()?.id).toBe(component.tooltipId());

    leave(s, trigger);

    expect(fixture.componentInstance.hint().overlayRef()).toBeNull();
  });
});
