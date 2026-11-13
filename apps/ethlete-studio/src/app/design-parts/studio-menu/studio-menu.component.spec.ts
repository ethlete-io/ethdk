import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { DesignServerAction, DesignServerStatus, StudioMenuComponent } from './studio-menu.component';

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

  it('draws the appearance submenu with Dunkel checked and the schemes the app lacks disabled', async () => {
    const { row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    await openSubmenu('Erscheinungsbild');

    expect(row('Dunkel')?.getAttribute('aria-checked')).toBe('true');
    expect(row('Hell')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('Wie System')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('draws the help submenu with its shortcuts and every entry disabled', async () => {
    const { row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    await openSubmenu('Hilfe & Einstellungen');

    expect(row('Einstellungen…Ctrl ,')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('Tastenkürzel…Ctrl /')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('Hilfe')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('Über Studio…')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the help submenu from its model and reports a hover-open back', async () => {
    const { fixture, row, openSubmenu } = await openMenu({ project: 'a', projects: ['a'] });

    fixture.componentRef.setInput('help', true);
    await fixture.whenStable();

    expect(row('Über Studio…')).toBeDefined();

    await openSubmenu('Erscheinungsbild');

    expect(fixture.componentInstance.appearance()).toBe(true);
  });
});
