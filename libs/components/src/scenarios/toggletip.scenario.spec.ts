import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  ButtonComponent,
  TOGGLETIP_ERROR_CODES,
  TOGGLETIP_IMPORTS,
  ToggletipCloseDirective,
  ToggletipComponent,
  ToggletipDirective,
  ToggletipTriggerDirective,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const takeError = (s: Scenario, code: number) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => String((entry.error as Error | undefined)?.message).includes(`${code}`));

  return index === -1 ? undefined : (s.errors.splice(index, 1)[0]?.error as Error);
};

@Component({
  selector: 'et-scenario-help-toggletips',
  imports: [TOGGLETIP_IMPORTS, ButtonComponent],
  template: `
    <button
      [(etToggletipOpen)]="feeOpen"
      [etToggletipDisabled]="disabled()"
      class="fee-trigger"
      etToggletip="A 2% fee applies to every payout."
      et-button
      etToggletipTrigger
      type="button"
      variant="outline"
    >
      Fees
    </button>

    <button [etToggletip]="details" class="details-trigger" etToggletipAriaLabel="Roster rules" type="button">
      Rules
    </button>

    <ng-template #details>
      <p class="details-text">team-a may register up to 12 players.</p>
      <button class="details-close" etToggletipClose type="button">Got it</button>
    </ng-template>
  `,
})
class HelpToggletipsComponent {
  feeOpen = signal(false);
  disabled = signal(false);
}

@Component({
  selector: 'et-scenario-misused-toggletips',
  imports: [ToggletipDirective, ToggletipTriggerDirective, ButtonComponent],
  template: `
    <button [etToggletip]="details" class="unlabelled" type="button">Unlabelled</button>
    <ng-template #details><p>Template without a name</p></ng-template>

    <button class="plain" etToggletip="Plain" etToggletipTrigger type="button">Plain</button>
    <button class="lonely" et-button etToggletipTrigger type="button">Lonely</button>
  `,
})
class MisusedToggletipsComponent {}

describe('toggletip scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('opens a text toggletip from an et-button, mirrors it on the button and closes on Escape', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HelpToggletipsComponent);
    const app = fixture.componentInstance;

    settle(s);

    const trigger = query<HTMLButtonElement>('.fee-trigger');

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(trigger.hasAttribute('data-pressed-variant')).toBe(false);

    trigger.focus();
    trigger.click();
    settle(s);

    const panel = query('et-toggletip');

    expect(app.feeOpen()).toBe(true);
    expect(panel.classList).toContain('et-toggletip');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(trigger.getAttribute('data-toggletip-open')).toBe('true');
    expect(trigger.getAttribute('data-pressed-variant')).toBe('filled');
    expect(trigger.hasAttribute('aria-pressed')).toBe(false);
    expect(text(query('.et-toggletip__text', panel))).toBe('A 2% fee applies to every payout.');

    const dialog = query('[role="dialog"]');

    expect(dialog.getAttribute('aria-label')).toBe('A 2% fee applies to every payout.');
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);

    s.keydown('Escape', trigger);
    settle(s);

    expect(app.feeOpen()).toBe(false);
    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('data-pressed-variant')).toBe(false);
    expect(document.activeElement).toBe(trigger);

    app.feeOpen.set(true);
    settle(s);
    expect(document.querySelector('et-toggletip')).not.toBeNull();

    app.disabled.set(true);
    settle(s);
    expect(app.feeOpen()).toBe(false);
    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(trigger.hasAttribute('aria-haspopup')).toBe(false);

    trigger.click();
    settle(s);
    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(s.errors).toEqual([]);
  });

  it('names a template toggletip from its label, describes it by its content and closes from inside', () => {
    const s = scenario();

    TestBed.createComponent(HelpToggletipsComponent);
    settle(s);

    const trigger = query<HTMLButtonElement>('.details-trigger');

    trigger.focus();
    trigger.click();
    settle(s);

    const panel = query('et-toggletip');
    const dialog = query('[role="dialog"]');
    const content = query('.et-toggletip__content', panel);

    expect(getDebugNode(panel)?.componentInstance).toBeInstanceOf(ToggletipComponent);
    expect(getDebugNode(query('.details-close', content))?.injector.get(ToggletipCloseDirective)).toBeInstanceOf(
      ToggletipCloseDirective,
    );
    expect(panel.getAttribute('data-has-template')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Roster rules');
    expect(dialog.getAttribute('aria-describedby')).toBe(content.id);
    expect(text(query('.details-text', content))).toBe('team-a may register up to 12 players.');

    query<HTMLButtonElement>('.details-close', content).click();
    settle(s);

    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    settle(s);
    expect(document.querySelector('et-toggletip')).not.toBeNull();
    trigger.click();
    settle(s);
    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(s.errors).toEqual([]);
  });

  it('reports an unnamed template toggletip and a trigger without a button or a toggletip', () => {
    const s = scenario();

    TestBed.createComponent(MisusedToggletipsComponent);
    s.tick();

    expect(takeError(s, TOGGLETIP_ERROR_CODES.TRIGGER_REQUIRES_BUTTON)?.message).toContain(
      'etToggletipTrigger must be used on an element that also has a button directive',
    );
    expect(takeError(s, TOGGLETIP_ERROR_CODES.TRIGGER_REQUIRES_TOGGLETIP)?.message).toContain(
      'etToggletipTrigger must be used on the same element as [etToggletip]',
    );

    const unlabelled = query<HTMLButtonElement>('.unlabelled');

    unlabelled.click();
    expect(() => TestBed.tick()).not.toThrow();
    expect(takeError(s, TOGGLETIP_ERROR_CODES.TEMPLATE_TOGGLETIP_REQUIRES_LABEL)?.message).toContain(
      'Template toggletips require etToggletipAriaLabel',
    );
    expect(document.querySelector('et-toggletip')).toBeNull();
    expect(s.errors.map((entry) => (entry.error as { element?: HTMLElement }).element?.className.split(' '))).toEqual([
      ['plain'],
      expect.arrayContaining(['lonely']),
    ]);
    s.errors.length = 0;
    settle(s);
  });
});
