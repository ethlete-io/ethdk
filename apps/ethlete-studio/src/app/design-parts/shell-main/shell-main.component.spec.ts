import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { StudioCodeState } from '../../../host/studio-code';
import { THEMES } from '../../../themes';
import { injectCodeWatch } from '../../code-watch';

const code = vi.hoisted(() => ({ state: null as StudioCodeState | null, quit: vi.fn() }));

vi.mock('../../../host/studio-code', () => ({
  studioCodeState$: () => of(code.state),
  quitForRebuild$: () => {
    code.quit();

    return of(undefined);
  },
}));

vi.mock('../../../host/window', () => ({
  closeWindow$: () => EMPTY,
  minimizeWindow$: () => EMPTY,
  toggleMaximizeWindow$: () => EMPTY,
  isWindowMaximized$: () => of(false),
}));
import { ShellMainComponent, ShellSection } from './shell-main.component';

const setup = async (panel: 'open' | 'hidden') => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ShellMainComponent);
  const events: string[] = [];

  fixture.componentRef.setInput('panel', panel);
  fixture.componentInstance.collapse.subscribe(() => events.push('collapse'));
  fixture.componentInstance.sectionChange.subscribe((section: ShellSection) => events.push(`section:${section}`));
  await fixture.whenStable();

  const click = (label: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`nav button[aria-label="${label}"]`)?.click();

  return { events, click, fixture, host: fixture.nativeElement as HTMLElement };
};

describe('ShellMainComponent', () => {
  it('stacks the panel on its own layer above the isolated content', async () => {
    const { host } = await setup('open');
    const main = host.querySelector('main');
    const aside = host.querySelector('aside');

    expect(main?.classList).toContain('isolate');
    expect(aside?.classList).toContain('z-1');
    expect(aside?.classList).toContain('will-change-transform');
    expect(main?.nextElementSibling).toBe(aside);
  });

  describe('side panel width', () => {
    const pointer = (type: string, target: EventTarget, x: number) =>
      target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 10, pointerId: 1, button: 0, bubbles: true }));

    const resizeSetup = async (width?: number) => {
      const { host, fixture } = await setup('open');
      const widths: number[] = [];

      if (width !== undefined) fixture.componentRef.setInput('sideWidth', width);
      fixture.componentInstance.sideWidth.subscribe((next: number) => widths.push(next));
      await fixture.whenStable();

      const handle = host.querySelector<HTMLElement>('[role="separator"]');
      const root = host.firstElementChild as HTMLElement;

      return { fixture, handle, root, widths };
    };

    it('labels the handle with its range and current width', async () => {
      const { handle, root } = await resizeSetup(276);

      expect(handle?.getAttribute('aria-label')).toBe('Breite der Seitenleiste');
      expect(handle?.getAttribute('aria-valuemin')).toBe('200');
      expect(handle?.getAttribute('aria-valuemax')).toBe('400');
      expect(handle?.getAttribute('aria-valuenow')).toBe('276');
      expect(root.style.getPropertyValue('--st-side-width')).toBe('276px');
    });

    it('follows a drag inside the range and emits the width on release', async () => {
      const { fixture, handle, root, widths } = await resizeSetup();

      pointer('pointerdown', handle as HTMLElement, 500);
      pointer('pointermove', document, 564);
      await fixture.whenStable();

      expect(root.style.getPropertyValue('--st-side-width')).toBe('312px');
      expect(widths).toEqual([]);

      pointer('pointermove', document, 900);
      pointer('pointerup', document, 900);
      await fixture.whenStable();

      expect(widths).toEqual([400]);
      expect(root.style.getPropertyValue('--st-side-width')).toBe('400px');
    });

    it('goes back to the start width when the browser cancels the drag', async () => {
      const { fixture, handle, root, widths } = await resizeSetup();

      pointer('pointerdown', handle as HTMLElement, 500);
      pointer('pointermove', document, 300);
      pointer('pointercancel', document, 300);
      await fixture.whenStable();

      expect(widths).toEqual([]);
      expect(root.style.getPropertyValue('--st-side-width')).toBe('248px');
    });

    it('steps the width with the arrow keys', async () => {
      const { handle, widths } = await resizeSetup(204);

      handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

      expect(widths).toEqual([200, 208]);
    });
  });

  it('hides the open panel when the active section is clicked', async () => {
    const { events, click } = await setup('open');

    click('System');

    expect(events).toEqual(['collapse']);
  });

  it('shows the hidden panel again when the active section is clicked', async () => {
    const { events, click } = await setup('hidden');

    click('System');

    expect(events).toEqual(['section:System']);
  });

  it('switches to another section without hiding the panel', async () => {
    const { events, click } = await setup('open');

    click('Flows');

    expect(events).toEqual(['section:Flows']);
  });

  it('closes the project picker when the current project is chosen again', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(ShellMainComponent);

    fixture.componentRef.setInput('projectPicker', 'open');
    await fixture.whenStable();

    document.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.projectPicker()).toBe('closed');
  });

  it('draws the title bar across the full width with the shell product and the update button', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(ShellMainComponent);

    fixture.componentRef.setInput('product', 'timetrack');
    fixture.componentRef.setInput('chrome', { os: 'windows', left: [], right: ['close'] });
    fixture.componentRef.setInput('update', true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const bar = element.querySelector<HTMLElement>('ethlete-title-bar');

    expect(bar?.classList).toContain('col-span-full');
    expect(bar?.textContent).toContain('timetrack');
    expect(bar?.textContent).toContain('Update');
    expect(element.querySelectorAll('[data-window-button]').length).toBe(1);
  });

  it('leaves the title bar out without window chrome', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

    const fixture = TestBed.createComponent(ShellMainComponent);

    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('ethlete-title-bar')).toBeNull();
  });

  describe('code notice', () => {
    const OLD = 'a'.repeat(40);
    const NEW = 'b'.repeat(40);
    const running: StudioCodeState = {
      cli: { running: OLD, latest: OLD, dirty: false },
      frontend: { latest: OLD },
      host: { running: OLD, latest: OLD },
    };

    const renderWith = async (state: StudioCodeState) => {
      code.state = state;
      code.quit.mockClear();
      TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

      const fixture = TestBed.createComponent(ShellMainComponent);
      const restarts = vi.fn();

      fixture.componentRef.setInput('chrome', { os: 'linux', left: [], right: ['close'] });
      TestBed.runInInjectionContext(() => injectCodeWatch()).serverRestarts$.subscribe(restarts);
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;
      const restart = [...element.querySelectorAll<HTMLButtonElement>('ethlete-title-bar button')].find(
        (button) => button.textContent?.trim() === 'Neu starten',
      );

      const text = element.querySelector('[data-code-notice]')?.textContent?.trim();
      const describedBy = restart?.getAttribute('aria-describedby');
      const hint = describedBy ? document.getElementById(describedBy)?.textContent?.trim() : undefined;

      return { restart, restarts, text, hint };
    };

    it('draws no restart while the server runs the latest commit', async () => {
      const { restart } = await renderWith(running);

      expect(restart).toBeUndefined();
    });

    it('restarts the server after a cli commit', async () => {
      const { restart, restarts } = await renderWith({ ...running, cli: { ...running.cli, latest: NEW } });

      restart?.click();

      expect(restarts).toHaveBeenCalledTimes(1);
      expect(code.quit).not.toHaveBeenCalled();
    });

    it('quits for a rebuild after a host commit', async () => {
      const { restart, restarts } = await renderWith({ ...running, host: { running: OLD, latest: NEW } });

      restart?.click();

      expect(code.quit).toHaveBeenCalledTimes(1);
      expect(restarts).not.toHaveBeenCalled();
    });

    it('names the cause in the restart tooltip', async () => {
      const { text, hint } = await renderWith({ ...running, cli: { ...running.cli, latest: NEW } });

      expect(text).toBeUndefined();
      expect(hint).toBe('CLI geändert - neu starten');
    });

    it('draws only the hint while the cli has uncommitted changes', async () => {
      const { restart, text } = await renderWith({ ...running, cli: { ...running.cli, dirty: true } });

      expect(restart).toBeUndefined();
      expect(text).toBe('CLI hat uncommittete Änderungen, Studio läuft auf Stand aaaaaaa');
    });
  });
});
