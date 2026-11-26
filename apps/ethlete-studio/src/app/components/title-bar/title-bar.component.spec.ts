import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectOverlayManager, OverlayRef } from '@ethlete/components';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { of } from 'rxjs';
import { WindowChrome } from '../../../host/window';
import { THEMES } from '../../../themes';
import { UpdateDialogComponent } from '../update-dialog/update-dialog.component';
import { TitleBarComponent } from './title-bar.component';

vi.mock('../../../host/window', () => ({ isWindowMaximized$: () => of(false) }));

type Props = Omit<WindowChrome, 'preferNoCsd'> & {
  update?: boolean;
  notice?: boolean;
  noticeText?: string | null;
  restart?: 'pending' | 'failed' | null;
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
  // Linux draws round window buttons, and a layout that lists only close leaves the close button on the right.
  it('draws only a round close button on the right for appmenu:close', () => {
    const { bar, buttons, names } = render(linux([], ['close']));

    expect(names).toEqual(['close']);
    expect(buttons[0]?.dataset['shape']).toBe('round');
    expect(bar?.lastElementChild?.contains(buttons[0] ?? null)).toBe(true);
  });

  // Linux window buttons follow the side and order of the gnome button layout.
  it('draws the buttons on the side and in the order the layout gives', () => {
    const { bar, names } = render(linux(['close', 'minimize'], []));

    expect(names).toEqual(['close', 'minimize']);
    expect(bar?.firstElementChild?.querySelectorAll('[data-window-button]').length).toBe(2);
  });

  // Windows draws square caption tiles with the close tile in the error colour.
  it('draws caption tiles on Windows, the close tile on the error colour', () => {
    const { buttons, names } = render({ os: 'windows', left: ['close'], right: ['minimize', 'maximize'] });

    expect(names).toEqual(['close', 'minimize', 'maximize']);
    expect(buttons.every((button) => button.dataset['shape'] === 'caption')).toBe(true);
    expect(buttons[0]?.parentElement?.classList).toContain('contents');
    expect(buttons[0]?.parentElement?.className).toContain('--et-window-control-button-close-background');
  });

  // macOS reserves space for the traffic lights and Studio draws no buttons of its own.
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

  it('opens the update dialog from the click on the update button', () => {
    const { fixture, bar } = render({ ...linux([], []), update: true });
    const open = vi
      .spyOn(
        TestBed.runInInjectionContext(() => injectOverlayManager()),
        'open',
      )
      .mockReturnValue({} as OverlayRef<object>);

    bar?.lastElementChild?.querySelector<HTMLElement>('button')?.click();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(UpdateDialogComponent);
    fixture.destroy();
  });

  // The human decided Studio does not show the git push state or the uncommitted count.
  it('shows no unpushed or uncommitted state', () => {
    const { element } = render({ ...linux([], ['close']), update: true, notice: true, noticeText: 'x' });

    expect(element.textContent).not.toMatch(/ungepusht|\d+ offen/);
    expect(element.querySelector('[data-push-state], [data-uncommitted-state]')).toBeNull();
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

  // The human decided Studio does not show the CLI copy's uncommitted state.
  it('draws no notice text without a pending restart', () => {
    const { bar } = render({ os: 'macos', left: [], right: [], noticeText: 'x' });

    expect(bar?.querySelector('[data-code-notice]')).toBeNull();
    expect(bar?.textContent).not.toContain('CLI hat uncommittete Änderungen');
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

  // The title bar shows no CI state.
  it('shows no CI state', () => {
    const { element } = render(linux([], ['close']));

    expect(element.textContent).not.toMatch(/\bCI\b/i);
    expect(element.querySelector('[data-ci-state]')).toBeNull();
  });
});
