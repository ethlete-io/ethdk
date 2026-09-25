import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  BUTTON_ICON_ALIGNMENTS,
  BUTTON_IMPORTS,
  BUTTON_SIZES,
  BUTTON_SPINNER_CONFIG,
  BUTTON_TYPES,
  BUTTON_VARIANTS,
  ButtonColor,
  ButtonColorDirective,
  ButtonComponent,
  ButtonDirective,
  ButtonStylesDirective,
  FabComponent,
  IconButtonComponent,
  INHERIT_COLOR,
  SPLIT_BUTTON_ERROR_CODES,
  SplitButtonActionDirective,
  SplitButtonComponent,
  SplitButtonDirective,
  SplitButtonTriggerDirective,
  TextButtonComponent,
  WINDOW_CONTROL_BUTTON_KINDS,
  WINDOW_CONTROL_BUTTON_SIZES,
  WindowControlButtonComponent,
} from '../index';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'secondary', primary: swatch('120 20 160') },
];

@Component({
  selector: 'et-scenario-save-form',
  imports: [BUTTON_IMPORTS],
  template: `
    <button
      [variant]="variant()"
      [size]="size()"
      [iconAlignment]="iconAlignment()"
      [loading]="saving()"
      [progress]="progress()"
      [disabled]="locked()"
      [type]="type"
      (click)="saves.set(saves() + 1)"
      class="save"
      et-button
    >
      Save
    </button>
    <a [disabled]="locked()" (click)="opens.set(opens() + 1)" class="docs" href="#docs" et-button>Docs</a>
    <button [etButton] class="bare" type="button" etButtonStyles>Bare</button>
  `,
})
class SaveFormComponent {
  variant = signal<(typeof BUTTON_VARIANTS)[keyof typeof BUTTON_VARIANTS]>(BUTTON_VARIANTS.FILLED);
  size = signal<(typeof BUTTON_SIZES)[keyof typeof BUTTON_SIZES]>(BUTTON_SIZES.MD);
  iconAlignment = signal<(typeof BUTTON_ICON_ALIGNMENTS)[keyof typeof BUTTON_ICON_ALIGNMENTS]>(
    BUTTON_ICON_ALIGNMENTS.START,
  );
  saving = signal(false);
  progress = signal<number | null>(null);
  locked = signal(false);
  type = BUTTON_TYPES.SUBMIT;
  saves = signal(0);
  opens = signal(0);
  save = viewChild.required(ButtonComponent);
  bare = viewChild.required(ButtonStylesDirective);
}

@Component({
  selector: 'et-scenario-toolbar',
  imports: [
    ButtonComponent,
    ButtonDirective,
    ButtonColorDirective,
    IconButtonComponent,
    TextButtonComponent,
    FabComponent,
    WindowControlButtonComponent,
  ],
  template: `
    <button
      [pressed]="bold()"
      [color]="color()"
      [pressedColor]="pressedColor()"
      (click)="bold.set(!bold())"
      class="bold"
      et-icon-button
      aria-label="Bold"
    >
      B
    </button>
    <button [pressed]="bold()" class="silent" emitAriaPressed="false" et-icon-button aria-label="Silent">S</button>
    <button [size]="size" class="more" type="button" et-text-button>More</button>
    <button [expanded]="expanded()" class="compose" type="button" et-fab>Compose</button>
    <button [kind]="kind" [size]="windowSize" class="close" type="button" et-window-control-button aria-label="Close">
      x
    </button>
    <button [pressed]="bold()" class="pinned" type="button" et-button>Pin</button>
  `,
})
class ToolbarComponent {
  bold = signal(false);
  color = signal<ButtonColor | undefined>(undefined);
  pressedColor = signal<ButtonColor | undefined>(undefined);
  expanded = signal(false);
  size = BUTTON_SIZES.SM;
  kind = WINDOW_CONTROL_BUTTON_KINDS.CLOSE;
  windowSize = WINDOW_CONTROL_BUTTON_SIZES.LG;
}

@Component({
  selector: 'et-scenario-publish',
  imports: [BUTTON_IMPORTS],
  template: `
    <et-split-button>
      <button (click)="published.set(true)" type="button" et-button etSplitButtonAction>Publish</button>
      @if (withTrigger()) {
        <button type="button" et-icon-button etSplitButtonTrigger aria-label="More publish options">v</button>
      }
    </et-split-button>
  `,
})
class PublishComponent {
  withTrigger = signal(true);
  published = signal(false);
  group = viewChild.required(SplitButtonDirective);
  action = viewChild.required(SplitButtonActionDirective);
  trigger = viewChild(SplitButtonTriggerDirective);
  shell = viewChild.required(SplitButtonComponent);
}

@Component({
  selector: 'et-scenario-stray-trigger',
  imports: [SplitButtonTriggerDirective],
  template: `<button type="button" etSplitButtonTrigger>v</button>`,
})
class StrayTriggerComponent {}

const query = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const takeErrorPayload = (s: Scenario) => {
  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  expect(index).not.toBe(-1);

  return s.errors.splice(index, 1)[0]?.error as { element: HTMLElement };
};

describe('button scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemesWithTailwind4(COLOR_THEMES)] });

  it('submits a form action, blocks it while saving, and reports progress on the spinner', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SaveFormComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const save = query(host, '.save') as HTMLButtonElement;

    expect(save.getAttribute('type')).toBe('submit');
    expect(save.dataset['variant']).toBe('filled');
    expect(save.dataset['size']).toBe('md');
    expect(save.dataset['iconAlignment']).toBe('start');

    save.click();
    expect(fixture.componentInstance.saves()).toBe(1);

    fixture.componentInstance.variant.set(BUTTON_VARIANTS.OUTLINE);
    fixture.componentInstance.size.set(BUTTON_SIZES.LG);
    fixture.componentInstance.iconAlignment.set(BUTTON_ICON_ALIGNMENTS.END);
    fixture.componentInstance.saving.set(true);
    s.tick();

    expect(save.dataset['variant']).toBe('outline');
    expect(save.dataset['size']).toBe('lg');
    expect(save.dataset['iconAlignment']).toBe('end');
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.hasAttribute('disabled')).toBe(false);

    const spinner = query(save, 'et-spinner');

    expect(spinner.style.getPropertyValue('--et-spinner-size')).toBe(`${BUTTON_SPINNER_CONFIG.lg.diameter}px`);
    expect(spinner.hasAttribute('aria-valuenow')).toBe(false);

    const blocked = new MouseEvent('click', { bubbles: true, cancelable: true });

    save.dispatchEvent(blocked);
    expect(blocked.defaultPrevented).toBe(true);

    fixture.componentInstance.progress.set(40);
    s.tick();
    expect(spinner.getAttribute('aria-valuenow')).toBe('40');

    fixture.componentInstance.saving.set(false);
    s.tick();
    expect(save.querySelector('et-spinner')).toBeNull();
    expect(save.hasAttribute('aria-busy')).toBe(false);

    const savesBefore = fixture.componentInstance.saves();

    save.click();
    expect(fixture.componentInstance.saves()).toBe(savesBefore + 1);
  });

  it('disables a native button and takes a disabled link out of the tab order', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SaveFormComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const save = query(host, '.save');
    const docs = query(host, '.docs');

    expect(docs.hasAttribute('type')).toBe(false);
    expect(docs.hasAttribute('tabindex')).toBe(false);

    fixture.componentInstance.locked.set(true);
    s.tick();

    expect(save.hasAttribute('disabled')).toBe(true);
    expect(docs.hasAttribute('disabled')).toBe(false);
    expect(docs.getAttribute('tabindex')).toBe('-1');
    expect(docs.getAttribute('aria-disabled')).toBe('true');

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });

    docs.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);

    fixture.componentInstance.locked.set(false);
    s.tick();
    expect(docs.hasAttribute('tabindex')).toBe(false);
  });

  it.fails('keeps a template (click) handler from running while the button is loading', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SaveFormComponent);

    fixture.componentInstance.saving.set(true);
    s.flush();

    query(fixture.nativeElement as HTMLElement, '.save').click();
    expect(fixture.componentInstance.saves()).toBe(0);
  });

  it.fails('keeps a template (click) handler from running on a disabled link', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SaveFormComponent);

    fixture.componentInstance.locked.set(true);
    s.flush();

    query(fixture.nativeElement as HTMLElement, '.docs').click();
    expect(fixture.componentInstance.opens()).toBe(0);
  });

  it('mounts the shared button styles once for every button on the page', () => {
    const s = scenario();
    const first = TestBed.createComponent(SaveFormComponent);

    TestBed.createComponent(SaveFormComponent);
    s.flush();

    expect(first.componentInstance.bare()).toBeInstanceOf(ButtonStylesDirective);
    expect(document.querySelectorAll('.et-style-manager > et-button-properties-styles')).toHaveLength(1);
  });

  it('toggles a pressed tool and swaps its color theme while pressed', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ToolbarComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const bold = query(host, '.bold');
    const silent = query(host, '.silent');
    const pinned = query(host, '.pinned');

    expect(bold.getAttribute('aria-pressed')).toBe('false');
    expect(bold.dataset['pressedVariant']).toBeUndefined();
    expect(silent.hasAttribute('aria-pressed')).toBe(false);

    fixture.componentInstance.color.set('secondary');
    fixture.componentInstance.pressedColor.set(INHERIT_COLOR);
    s.tick();
    expect(bold.className).toContain('et-color--secondary');

    bold.click();
    s.tick();

    expect(bold.getAttribute('aria-pressed')).toBe('true');
    expect(bold.dataset['pressedVariant']).toBe('tonal');
    expect(bold.className).toContain('et-color--inherited');
    expect(pinned.getAttribute('aria-pressed')).toBe('true');
    expect(pinned.dataset['pressedVariant']).toBe('outline');
    expect(silent.hasAttribute('aria-pressed')).toBe(false);

    bold.click();
    s.tick();
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    expect(bold.className).toContain('et-color--secondary');
  });

  it('renders the text, floating and window-control buttons with their own options', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ToolbarComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    expect(query(host, '.more').dataset['size']).toBe('sm');
    expect(query(host, '.close').dataset['kind']).toBe('close');
    expect(query(host, '.close').dataset['size']).toBe('lg');

    const compose = query(host, '.compose');

    expect(compose.hasAttribute('data-expanded')).toBe(false);

    fixture.componentInstance.expanded.set(true);
    s.tick();
    expect(compose.dataset['expanded']).toBe('true');
  });

  it('groups an action and a trigger into one split button and tracks the trigger leaving', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PublishComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    const publish = fixture.componentInstance;

    expect(query(host, 'et-split-button').getAttribute('role')).toBe('group');
    expect(publish.shell()).toBeInstanceOf(SplitButtonComponent);
    expect(publish.group().registeredAction()).toBe(publish.action());
    expect(publish.group().registeredTrigger()).toBe(publish.trigger());

    query(host, '.et-split-button-action').click();
    expect(publish.published()).toBe(true);

    publish.withTrigger.set(false);
    s.tick();
    expect(publish.group().registeredTrigger()).toBeNull();
  });

  it('reports a split button rendered without its trigger', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PublishComponent);

    fixture.componentInstance.withTrigger.set(false);
    s.flush();

    s.expectError(`ET${SPLIT_BUTTON_ERROR_CODES.MISSING_TRIGGER}`);
    expect(takeErrorPayload(s).element).toBe((fixture.nativeElement as HTMLElement).querySelector('et-split-button'));
  });

  it('throws when a trigger is placed outside a split button', () => {
    const s = scenario();

    expect(() => TestBed.createComponent(StrayTriggerComponent)).toThrow(
      `ET${SPLIT_BUTTON_ERROR_CODES.TRIGGER_OUTSIDE_SPLIT_BUTTON}`,
    );

    s.flush();
    expect(takeErrorPayload(s).element.tagName).toBe('BUTTON');
  });
});
