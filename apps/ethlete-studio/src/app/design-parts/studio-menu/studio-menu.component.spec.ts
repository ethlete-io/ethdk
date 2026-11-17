import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { Appearance, DesignServerAction, DesignServerStatus, StudioMenuComponent } from './studio-menu.component';

const openMenu = async (options: { project: string; projects: string[]; server?: DesignServerStatus }) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(StudioMenuComponent);
  const events: string[] = [];

  fixture.componentRef.setInput('project', options.project);
  fixture.componentRef.setInput('projects', options.projects);
  fixture.componentRef.setInput('server', options.server ?? 'running');
  fixture.componentRef.setInput('open', true);
  fixture.componentInstance.projectChange.subscribe((name: string) => events.push(`project:${name}`));
  fixture.componentInstance.openProject.subscribe(() => events.push('openProject'));
  fixture.componentInstance.serverAction.subscribe((action: DesignServerAction) => events.push(`server:${action}`));
  fixture.componentInstance.appearanceChange.subscribe((appearance: Appearance) =>
    events.push(`appearance:${appearance}`),
  );
  fixture.componentInstance.openSettings.subscribe(() => events.push('settings'));
  fixture.componentInstance.openShortcuts.subscribe(() => events.push('shortcuts'));
  fixture.componentInstance.openHelp.subscribe(() => events.push('help'));
  fixture.componentInstance.openAbout.subscribe(() => events.push('about'));
  await fixture.whenStable();

  const rows = () =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"], .et-menu-group-label')].map(
      (row) => row.textContent?.trim().replace(/\s+/g, ' '),
    );
  const row = (text: string) =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')].find(
      (candidate) => candidate.textContent?.trim().replace(/\s+/g, ' ') === text,
    );
  const openSubmenu = async (text: string) => {
    row(text)?.click();
    await fixture.whenStable();
  };

  return { fixture, events, rows, row, openSubmenu };
};

describe('StudioMenuComponent', () => {
  it('lists the projects, the server actions and the two submenus in design order', async () => {
    const { rows } = await openMenu({ project: 'b', projects: ['a', 'b', 'c', 'd'] });

    expect(rows()).toEqual([
      'Projekt',
      'a',
      'b',
      'c',
      'd',
      'Projekt öffnen…',
      'Design-Server',
      'Design-Server neu starten',
      'Design-Server stoppen',
      'Erscheinungsbild',
      'Hilfe & Einstellungen',
    ]);
  });

  it('checks the open project', async () => {
    const { row } = await openMenu({ project: 'b', projects: ['a', 'b'] });

    expect(row('b')?.getAttribute('aria-checked')).toBe('true');
    expect(row('a')?.getAttribute('aria-checked')).toBe('false');
  });

  it('offers only the start while the server is stopped', async () => {
    const { row } = await openMenu({ project: 'a', projects: ['a'], server: 'stopped' });

    expect(row('Design-Server starten')).toBeDefined();
    expect(row('Design-Server stoppen')).toBeUndefined();
  });

  it('emits another project, open project and a server action', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a', 'b'] });

    row('b')?.click();
    await fixture.whenStable();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    row('Projekt öffnen…')?.click();
    row('Design-Server stoppen')?.click();

    expect(events).toEqual(['project:b', 'openProject', 'server:stop']);
  });

  it('emits nothing when the open project is chosen again', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a', 'b'] });

    row('a')?.click();
    await fixture.whenStable();

    expect(events).toEqual([]);
  });

  it('draws the appearance submenu with Dunkel checked and emits each chosen scheme', async () => {
    const { fixture, events, row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    await openSubmenu('Erscheinungsbild');

    expect(row('Dunkel')?.getAttribute('aria-checked')).toBe('true');

    for (const label of ['Hell', 'Dunkel', 'Wie System']) {
      row(label)?.click();
      await fixture.whenStable();
    }

    expect(events).toEqual(['appearance:light', 'appearance:dark', 'appearance:system']);
  });

  it('draws the help submenu with its shortcuts and emits each entry', async () => {
    const { fixture, events, row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    for (const label of ['Einstellungen…Ctrl ,', 'Tastenkürzel…Ctrl /', 'Hilfe', 'Über Studio…']) {
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
      await openSubmenu('Hilfe & Einstellungen');
      row(label)?.click();
      await fixture.whenStable();
    }

    expect(events).toEqual(['settings', 'shortcuts', 'help', 'about']);
  });

  it('closes both submenus with the menu', async () => {
    const { fixture } = await openMenu({ project: 'a', projects: ['a'] });

    fixture.componentRef.setInput('appearanceOpen', true);
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.appearanceOpen()).toBe(false);
  });

  it('opens the help submenu from its model and reports a hover-open back', async () => {
    const { fixture, row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    fixture.componentRef.setInput('helpOpen', true);
    await fixture.whenStable();

    expect(row('Über Studio…')).toBeDefined();

    await openSubmenu('Erscheinungsbild');

    expect(fixture.componentInstance.appearanceOpen()).toBe(true);
  });
});
