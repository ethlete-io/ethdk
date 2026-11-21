import { provideZonelessChangeDetection, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectOverlayManager } from '@ethlete/components';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { of } from 'rxjs';
import { THEMES } from '../../../themes';
import { AboutDialogComponent } from '../about-dialog/about-dialog.component';
import { ShortcutsDialogComponent } from '../shortcuts-dialog/shortcuts-dialog.component';
import { DesignServerAction, DesignServerStatus, StudioMenuComponent } from './studio-menu.component';

const openMenu = async (options: {
  project: string;
  projects: string[];
  server?: DesignServerStatus;
  busy?: boolean;
}) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(StudioMenuComponent);
  const events: string[] = [];

  const manager = TestBed.runInInjectionContext(() => injectOverlayManager());
  const open = manager.open.bind(manager);

  vi.spyOn(manager, 'open').mockImplementation(((component: Type<object>, config?: object) => {
    if (component !== ShortcutsDialogComponent && component !== AboutDialogComponent) return open(component, config);

    events.push(`opens:${component.name}`);
    return { afterClosed: () => of(undefined), close: () => undefined };
  }) as typeof manager.open);

  fixture.componentRef.setInput('project', options.project);
  fixture.componentRef.setInput('projects', options.projects);
  fixture.componentRef.setInput('server', options.server ?? 'running');
  fixture.componentRef.setInput('busy', options.busy ?? false);
  fixture.componentRef.setInput('open', true);
  fixture.componentInstance.projectChange.subscribe((name: string) => events.push(`project:${name}`));
  fixture.componentInstance.openProject.subscribe(() => events.push('openProject'));
  fixture.componentInstance.serverAction.subscribe((action: DesignServerAction) => events.push(`server:${action}`));
  fixture.componentInstance.reload.subscribe(() => events.push('reload'));
  fixture.componentInstance.scanProjects.subscribe(() => events.push('scanProjects'));
  fixture.componentInstance.removeProject.subscribe(() => events.push('removeProject'));
  fixture.componentInstance.openInventory.subscribe(() => events.push('openInventory'));
  fixture.componentInstance.openHelp.subscribe(() => events.push('openHelp'));
  await fixture.whenStable();

  const rows = () =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"], .et-menu-group-label')].map(
      (row) => row.textContent?.trim().replace(/\s+/g, ' '),
    );
  const row = (text: string) =>
    [...document.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')].find(
      (candidate) => candidate.textContent?.trim().replace(/\s+/g, ' ') === text,
    );
  return { fixture, events, rows, row };
};

describe('StudioMenuComponent', () => {
  it('lists the projects, the server actions and the help rows in design order', async () => {
    const { rows } = await openMenu({ project: 'b', projects: ['a', 'b', 'c', 'd'] });

    expect(rows()).toEqual([
      'Projekt',
      'a',
      'b',
      'c',
      'd',
      'Projekt öffnen…',
      'Checkouts suchen…',
      'Projekt entfernen',
      'Inventory',
      'Design-Server · läuft',
      'Neu laden',
      'Design-Server neu starten',
      'Design-Server stoppen',
      'Tastenkürzel',
      'Hilfe',
      'Über Studio',
    ]);
  });

  it('names a stale server and offers the restart first', async () => {
    const { rows } = await openMenu({ project: 'a', projects: ['a'], server: 'stale' });

    expect(rows().slice(-7)).toEqual([
      'Design-Server · veraltet',
      'Design-Server neu starten',
      'Neu laden',
      'Design-Server stoppen',
      'Tastenkürzel',
      'Hilfe',
      'Über Studio',
    ]);
  });

  it('names a stopped server and offers no reload', async () => {
    const { rows } = await openMenu({ project: 'a', projects: ['a'], server: 'stopped' });

    expect(rows()).toContain('Design-Server · gestoppt');
    expect(rows()).not.toContain('Neu laden');
  });

  it('emits the reload and the scan, and keeps the reload enabled while an action runs', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a'], busy: true });

    expect(row('Neu laden')?.getAttribute('aria-disabled')).not.toBe('true');
    expect(row('Checkouts suchen…')?.getAttribute('aria-disabled')).toBe('true');
    row('Neu laden')?.click();
    await fixture.whenStable();

    expect(events).toEqual(['reload']);

    fixture.componentRef.setInput('busy', false);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    row('Checkouts suchen…')?.click();

    expect(events).toEqual(['reload', 'scanProjects']);
  });

  it('disables the removal for the last project', async () => {
    const { row } = await openMenu({ project: 'a', projects: ['a'] });

    expect(row('Projekt entfernen')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('disables the removal while an action runs', async () => {
    const { row } = await openMenu({ project: 'a', projects: ['a', 'b'], busy: true });

    expect(row('Projekt entfernen')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('emits the removal of the open project', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a', 'b'] });

    row('Projekt entfernen')?.click();
    await fixture.whenStable();

    expect(events).toEqual(['removeProject']);
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

  it('hides the rows without a target: no submenu, no Einstellungen', async () => {
    const { rows } = await openMenu({ project: 'a', projects: ['a'] });

    expect(rows()).not.toContain('Einstellungen');
    expect(rows()).not.toContain('Erscheinungsbild');
    expect(document.querySelectorAll('[aria-haspopup="menu"][role="menuitem"]')).toHaveLength(0);
    expect(document.querySelectorAll('et-menu-separator')).toHaveLength(3);
  });

  it('emits openInventory from the Inventory row, also while an action runs', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a'], busy: true });

    expect(row('Inventory')?.getAttribute('aria-disabled')).not.toBe('true');
    row('Inventory')?.click();
    await fixture.whenStable();

    expect(events).toEqual(['openInventory']);
  });

  it('opens the dialogs and emits help, also while an action runs', async () => {
    const { fixture, events, row } = await openMenu({ project: 'a', projects: ['a'], busy: true });

    for (const label of ['Tastenkürzel', 'Hilfe', 'Über Studio']) {
      fixture.componentInstance.open.set(true);
      await fixture.whenStable();
      expect(row(label)?.getAttribute('aria-disabled')).not.toBe('true');
      row(label)?.click();
      await fixture.whenStable();
    }

    await vi.waitFor(() =>
      expect(events).toEqual(['opens:ShortcutsDialogComponent', 'openHelp', 'opens:AboutDialogComponent']),
    );
  });

  it('closes with Escape', async () => {
    const { fixture } = await openMenu({ project: 'a', projects: ['a'] });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('keeps the mark with blinking eyes in the busy tile and disables every action row', async () => {
    const { fixture, events, row } = await openMenu({ project: 'b', projects: ['a', 'b', 'c'], busy: true });
    const root = (fixture.nativeElement as HTMLElement).querySelector('[etMenu]');
    const trigger = root?.querySelector('button');

    row('a')?.click();
    row('Projekt öffnen…')?.click();
    row('Design-Server neu starten')?.click();
    await fixture.whenStable();

    expect(root?.getAttribute('aria-busy')).toBe('true');
    expect(trigger?.querySelector('et-spinner')).toBeNull();
    expect(trigger?.querySelector('svg[viewBox="0 0 32 32"] rect')).not.toBeNull();
    expect(trigger?.querySelectorAll('path.motion-safe\\:animate-studio-blink')).toHaveLength(2);
    expect(row('a')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('b')?.getAttribute('aria-disabled')).not.toBe('true');
    expect(row('Projekt öffnen…')?.getAttribute('aria-disabled')).toBe('true');
    expect(row('Design-Server stoppen')?.getAttribute('aria-disabled')).toBe('true');
    expect(events).toEqual([]);
  });

  it('shows the mark and no busy flag while idle', async () => {
    const { fixture } = await openMenu({ project: 'a', projects: ['a'] });
    const root = (fixture.nativeElement as HTMLElement).querySelector('[etMenu]');
    const trigger = root?.querySelector('button');

    expect(root?.hasAttribute('aria-busy')).toBe(false);
    expect(trigger?.querySelector('et-spinner')).toBeNull();
    expect(trigger?.querySelectorAll('svg path')).toHaveLength(1);
    expect(trigger?.querySelector('svg path')?.getAttribute('fill-rule')).toBe('evenodd');
    expect(trigger?.querySelector('.motion-safe\\:animate-studio-blink')).toBeNull();
  });
});
