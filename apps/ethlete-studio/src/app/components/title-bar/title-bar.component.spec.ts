import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { of } from 'rxjs';
import { WindowChrome } from '../../../host/window';
import { THEMES } from '../../../themes';
import { TitleBarComponent, TitleBarPush } from './title-bar.component';

vi.mock('../../../host/window', () => ({ isWindowMaximized$: () => of(false) }));

type Props = Omit<WindowChrome, 'preferNoCsd'> & {
  update?: boolean;
  notice?: boolean;
  noticeText?: string | null;
  restart?: 'pending' | 'failed' | null;
  push?: TitleBarPush | null;
  product?: string;
  part?: string;
};

const render = (props: Props) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(TitleBarComponent);

  Object.entries(props).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const bar = element.querySelector<HTMLElement>('[data-tauri-drag-region="deep"]');
  const buttons = [...element.querySelectorAll<HTMLElement>('[data-window-button]')];

  return { fixture, element, bar, buttons, names: buttons.map((button) => button.dataset['windowButton']) };
};

const linux = (left: WindowChrome['left'], right: WindowChrome['right']): Props => ({ os: 'linux', left, right });

describe('TitleBarComponent', () => {
  it('draws only a round close button on the right for appmenu:close', () => {
    const { bar, buttons, names } = render(linux([], ['close']));

    expect(names).toEqual(['close']);
    expect(buttons[0]?.dataset['shape']).toBe('round');
    expect(bar?.lastElementChild?.contains(buttons[0] ?? null)).toBe(true);
  });

  it('draws the buttons on the side and in the order the layout gives', () => {
    const { bar, names } = render(linux(['close', 'minimize'], []));

    expect(names).toEqual(['close', 'minimize']);
    expect(bar?.firstElementChild?.querySelectorAll('[data-window-button]').length).toBe(2);
  });

  it('draws caption tiles on Windows, the close tile on the error colour', () => {
    const { buttons, names } = render({ os: 'windows', left: ['close'], right: ['minimize', 'maximize'] });

    expect(names).toEqual(['close', 'minimize', 'maximize']);
    expect(buttons.every((button) => button.dataset['shape'] === 'caption')).toBe(true);
    expect(buttons[0]?.parentElement?.classList).toContain('contents');
    expect(buttons[0]?.parentElement?.className).toContain('--et-window-control-button-close-background');
  });

  it('reserves the traffic light space on macOS and draws no buttons', () => {
    const { element, names } = render({ os: 'macos', left: [], right: [] });

    expect(names).toEqual([]);
    expect(element.querySelector('.w-19\\.5')).not.toBeNull();
  });

  it('shows the update button only when an update is ready', () => {
    const idle = render({ ...linux([], ['close']), update: false });

    expect(idle.bar?.lastElementChild?.textContent).not.toContain('Update');

    TestBed.resetTestingModule();

    const ready = render({ ...linux([], ['close']), update: true });

    expect(ready.bar?.lastElementChild?.textContent).toContain('Update');
  });

  it('names the product and part in the search field', () => {
    const { element } = render({ os: 'windows', left: [], right: [], product: 'shop', part: 'Checkout Summary' });
    const search = element.querySelector('[aria-haspopup="dialog"]');

    expect(search?.textContent).toContain('shop');
    expect(search?.textContent).toContain('Checkout Summary');
    expect(search?.getAttribute('aria-label')).toBe('Suchen in shop, Checkout Summary');
  });

  it('fires the window outputs from the window buttons', () => {
    const { fixture, buttons } = render(linux(['close'], ['minimize', 'maximize']));
    const fired: string[] = [];
    const { componentInstance: bar } = fixture;

    bar.minimize.subscribe(() => fired.push('minimize'));
    bar.maximize.subscribe(() => fired.push('maximize'));
    bar.close.subscribe(() => fired.push('close'));
    buttons.forEach((button) => button.click());

    expect(fired).toEqual(['close', 'minimize', 'maximize']);
  });

  it('fires the update output with the click from the update button', () => {
    const { fixture, bar } = render({ ...linux([], []), update: true });
    const events: MouseEvent[] = [];

    fixture.componentInstance.updatePress.subscribe((event) => events.push(event));
    bar?.lastElementChild?.querySelector<HTMLElement>('button')?.click();

    expect(events).toHaveLength(1);
  });

  it('draws the push badge before Update, filled with the gate advice only on a red gate', () => {
    const red = render({
      ...linux([], ['close']),
      update: true,
      push: { unpushed: 158, age: '31,5 h', gate: 'red' },
    }).bar;
    const state = red?.lastElementChild?.firstElementChild as HTMLElement | null;

    expect(state?.matches('[data-push-state]')).toBe(true);
    expect(state?.textContent?.trim()).toBe('158 ungepusht · 31,5 h');
    expect(state?.title).toBe('Push-Gate rot - vor jedem Feature-Slice beheben');
    expect(state?.querySelector('et-badge')?.getAttribute('data-variant')).toBe('filled');

    TestBed.resetTestingModule();
    const open = render({ ...linux([], []), push: { unpushed: 1, age: '0 h', gate: 'unknown' } }).bar;

    expect(open?.querySelector<HTMLElement>('[data-push-state]')?.title).toBe('Push-Gate nicht gelaufen');
    expect(open?.querySelector('[data-push-state] et-badge')?.getAttribute('data-variant')).toBe('tonal');

    TestBed.resetTestingModule();
    expect(render(linux([], [])).bar?.querySelector('[data-push-state]')).toBeNull();
  });

  it('centres the push badge text on its cap height beside the icon', () => {
    const bar = render({ ...linux([], []), push: { unpushed: 3, age: '2 h', gate: 'green' } }).bar;
    const row = bar?.querySelector<HTMLElement>('[data-push-state] et-badge svg')?.parentElement;
    const text = row?.querySelector(':scope > span');

    expect(row?.className).toBe('flex items-center gap-1 whitespace-nowrap');
    expect(text?.className).toBe('[text-box:trim-both_cap_alphabetic]');
    expect(text?.textContent?.trim()).toBe('3 ungepusht · 2 h');
  });

  it('fires restart from the notice button and hides Update without an update', () => {
    const { fixture, bar } = render({ os: 'windows', left: [], right: ['close'], notice: true, update: false });
    const restarts: unknown[] = [];

    fixture.componentInstance.restartPress.subscribe(() => restarts.push(null));

    const actions = [...(bar?.lastElementChild?.querySelectorAll<HTMLElement>('button[et-button]') ?? [])];

    expect(actions.map((button) => button.textContent?.trim())).toEqual(['Neu starten']);

    actions[0]?.click();

    expect(restarts).toHaveLength(1);
  });

  it('draws no restart button without a notice', () => {
    const { bar } = render({ ...linux([], ['close']), update: true });

    expect(bar?.lastElementChild?.textContent).not.toContain('Neu starten');
  });

  it('describes the restart button with the notice text and draws no inline notice', async () => {
    const { fixture, bar } = render({ ...linux([], []), notice: true, noticeText: 'Agent-Regeln geändert' });

    await fixture.whenStable();

    const restart = bar?.lastElementChild?.querySelector<HTMLElement>('button[et-button]');
    const description = restart?.getAttribute('aria-describedby');

    expect(bar?.querySelector('[data-code-notice]')).toBeNull();
    expect(description && document.getElementById(description)?.textContent).toContain('Agent-Regeln geändert');
  });

  it('draws the notice text inline without a restart button when no notice is pending', () => {
    const text = 'CLI hat uncommittete Änderungen in drei Dateien, Studio läuft auf Stand abc1234';
    const { bar } = render({ os: 'macos', left: [], right: [], noticeText: text });

    expect(bar?.querySelector('[data-code-notice]')?.textContent?.trim()).toBe(text);
    expect(bar?.textContent).not.toContain('Neu starten');
  });

  describe('restart', () => {
    const restartButton = (element: HTMLElement) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        button.textContent?.includes('Neu starten'),
      );

    it('turns the restart button busy while pending and emits nothing more', () => {
      const { element } = render({
        ...linux([], ['close']),
        notice: true,
        noticeText: 'CLI geändert',
        restart: 'pending',
      });
      const button = restartButton(element);

      expect(button?.getAttribute('aria-disabled')).toBe('true');
      expect(button?.getAttribute('aria-busy')).toBe('true');
    });

    it('shows the failure toast once and emits dismiss', async () => {
      const { fixture, element } = render({
        ...linux([], ['close']),
        notice: true,
        noticeText: 'x',
        restart: 'failed',
      });
      const dismissed = vi.fn();

      fixture.componentInstance.dismiss.subscribe(dismissed);

      expect(restartButton(element)?.getAttribute('aria-busy')).toBeNull();
      expect(element.querySelector('ethlete-error-toast')?.textContent).toContain('Neustart fehlgeschlagen');

      element.querySelector<HTMLButtonElement>('ethlete-error-toast [etnotificationdismiss]')?.click();
      await vi.waitFor(() => expect(dismissed).toHaveBeenCalledTimes(1));

      expect(dismissed).toHaveBeenCalledTimes(1);
    });

    it('draws no toast when idle', () => {
      const { element } = render({ ...linux([], ['close']), notice: true, noticeText: 'x' });

      expect(element.querySelector('ethlete-error-toast')).toBeNull();
    });
  });
});
