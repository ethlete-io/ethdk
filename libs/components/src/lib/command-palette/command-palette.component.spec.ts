import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { OverlayRef } from '../overlay';
import { CommandPaletteComponent } from './command-palette.component';
import { COMMAND_PALETTE_IMPORTS } from './command-palette.imports';
import { provideCommandPaletteRegistry, registerCommands } from './command-palette-registry';
import { injectCommandPalette } from './command-palette.overlay';
import { CommandPaletteCommand } from './command-palette.types';

@Component({
  selector: 'et-test-command-palette-host',
  template: `<et-command-palette />`,
  imports: [COMMAND_PALETTE_IMPORTS],
  providers: [provideCommandPaletteRegistry()],
})
class CommandPaletteHostComponent {
  public ran: string[] = [];

  constructor() {
    registerCommands([
      { id: 'row.add', label: 'Add row', group: 'Rows', run: () => this.ran.push('row.add') },
      { id: 'table.create', label: 'Create table', group: 'Tables', run: () => this.ran.push('table.create') },
      {
        id: 'table.export',
        label: 'Export as spreadsheet',
        group: 'Tables',
        keywords: ['csv'],
        run: () => this.ran.push('table.export'),
      },
      { id: 'loose', label: 'Ungrouped command', run: () => this.ran.push('loose') },
    ]);

    registerCommands(
      signal<CommandPaletteCommand[]>([
        {
          id: 'row.delete',
          label: 'Delete row',
          group: 'Rows',
          disabled: true,
          run: () => this.ran.push('row.delete'),
        },
      ]),
    );
  }
}

const create = () => {
  const fixture = TestBed.createComponent(CommandPaletteHostComponent);
  fixture.detectChanges();

  const host = fixture.nativeElement.querySelector('et-command-palette') as HTMLElement;
  const input = host.querySelector('input') as HTMLInputElement;

  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const press = (key: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const rows = () => [...host.querySelectorAll('et-command-palette-item')] as HTMLElement[];

  const labels = () =>
    rows().map((row) => row.querySelector('.et-command-palette-item-label')?.textContent?.replace(/\s+/g, ' ').trim());

  const activeLabel = () =>
    host
      .querySelector('.et-command-palette-item--active .et-command-palette-item-label')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();

  return { fixture, host, input, type, press, rows, labels, activeLabel };
};

describe('CommandPaletteComponent', () => {
  it('lists every registered command before anything is typed', () => {
    const { host, labels } = create();

    expect(host.classList.contains('et-command-palette')).toBe(true);
    expect(labels()).toEqual(['Ungrouped command', 'Add row', 'Delete row', 'Create table', 'Export as spreadsheet']);
  });

  it('renders a heading per group, and none for the ungrouped commands', () => {
    const { host } = create();
    const headings = [...host.querySelectorAll('.et-command-palette-group-label')].map((el) => el.textContent?.trim());

    expect(headings).toEqual(['Rows', 'Tables']);
  });

  it('filters and ranks as the reader types', () => {
    const { type, labels } = create();

    type('table');

    expect(labels()).toEqual(['Create table']);
  });

  it('marks the matched characters of a label', () => {
    const { type, host } = create();

    type('table');

    const marks = [...host.querySelectorAll('.et-command-palette-item-match')].map((el) => el.textContent);

    expect(marks).toEqual(['table']);
  });

  it('finds a command by a keyword its label does not contain', () => {
    const { type, labels } = create();

    type('csv');

    expect(labels()).toEqual(['Export as spreadsheet']);
  });

  it('shows the empty message when nothing matches', () => {
    const { type, host, rows } = create();

    type('zzzz');

    expect(rows()).toHaveLength(0);
    expect(host.querySelector('.et-command-palette-empty')?.textContent?.trim()).toBe('No matching command');
  });

  it('marks the first result active without anyone choosing it', () => {
    const { activeLabel } = create();

    expect(activeLabel()).toBe('Ungrouped command');
  });

  it('moves the active row with the arrow keys', () => {
    const { press, activeLabel } = create();

    press('ArrowDown');

    expect(activeLabel()).toBe('Add row');

    press('ArrowUp');

    expect(activeLabel()).toBe('Ungrouped command');
  });

  it('skips a disabled command when moving', () => {
    const { press, activeLabel } = create();

    press('ArrowDown');
    press('ArrowDown');

    // 'Delete row' sits between them in the list but is disabled.
    expect(activeLabel()).toBe('Create table');
  });

  it('wraps around at the end of the list', () => {
    const { press, activeLabel } = create();

    press('ArrowUp');

    expect(activeLabel()).toBe('Export as spreadsheet');
  });

  it('runs the active command on Enter', () => {
    const { fixture, press } = create();

    press('ArrowDown');
    press('Enter');

    expect(fixture.componentInstance.ran).toEqual(['row.add']);
  });

  it('runs a command when its row is clicked', () => {
    const { fixture, rows } = create();

    rows()[3]?.click();

    expect(fixture.componentInstance.ran).toEqual(['table.create']);
  });

  it('does not run a disabled command that is clicked', () => {
    const { fixture, rows } = create();

    rows()[2]?.click();

    expect(fixture.componentInstance.ran).toEqual([]);
  });

  it('points aria-activedescendant at the active row', () => {
    const { input, host, press } = create();

    press('ArrowDown');

    const activeRow = host.querySelector('.et-command-palette-item--active') as HTMLElement;

    expect(input.getAttribute('aria-activedescendant')).toBe(activeRow.id);
  });
});

describe('CommandPaletteComponent opened as an overlay', () => {
  let openedRef: OverlayRef<CommandPaletteComponent, unknown> | null = null;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    openedRef = null;
  });

  afterEach(() => {
    openedRef?.close();
  });

  const flushFrames = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const open = async () => {
    TestBed.runInInjectionContext(() =>
      registerCommands([
        { id: 'row.add', label: 'Add row', run: () => undefined },
        { id: 'table.create', label: 'Create table', run: () => undefined },
      ]),
    );

    const overlayRef = TestBed.runInInjectionContext(() => injectCommandPalette().open());
    let closedVia: string | null = null;

    overlayRef.afterClosedEvent().subscribe((event) => (closedVia = event.source ?? 'unknown'));

    openedRef = overlayRef;
    TestBed.tick();
    await flushFrames();
    await flushFrames();
    await flushFrames();

    const input = overlayRef.elements?.paneElement.querySelector('input') as HTMLInputElement;

    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      TestBed.tick();
    };

    const pressEscape = async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      TestBed.tick();
      await flushFrames();
      await flushFrames();
    };

    return { input, type, pressEscape, closedVia: () => closedVia };
  };

  it('clears the query on the first Escape and stays open', async () => {
    const { input, type, pressEscape, closedVia } = await open();

    type('table');
    await pressEscape();

    expect(input.value).toBe('');
    expect(closedVia()).toBeNull();
  });

  it('closes on Escape once the query is empty', async () => {
    const { type, pressEscape, closedVia } = await open();

    type('table');
    await pressEscape();

    expect(closedVia()).toBeNull();

    await pressEscape();

    expect(closedVia()).toBe('escape');
  });
});
