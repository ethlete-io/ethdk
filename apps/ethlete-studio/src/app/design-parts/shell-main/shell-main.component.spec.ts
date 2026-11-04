import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EMPTY, of } from 'rxjs';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';

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

  return { events, click, host: fixture.nativeElement as HTMLElement };
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
});
