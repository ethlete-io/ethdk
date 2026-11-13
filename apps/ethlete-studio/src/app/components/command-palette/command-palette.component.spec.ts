import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OVERLAY_REF } from '@ethlete/components';
import { CommandPaletteComponent, PaletteEntry } from './command-palette.component';

const ENTRIES: PaletteEntry[] = [
  { kind: 'part', key: 'components/tree-row', label: 'tree-row' },
  { kind: 'part', key: 'components/toolbar-with-a-very-long-name', label: 'toolbar-with-a-very-long-name' },
  { kind: 'page', key: 'pages/checkout', label: 'checkout' },
  { kind: 'sketch', key: 'sketch:components/tree-row', label: 'tree-row@density' },
  { kind: 'command', key: 'restart', label: 'Design-Server neu starten' },
];

const textOf = (element: Element | null) =>
  [...(element?.querySelectorAll('span') ?? [])]
    .map((span) => span.textContent?.trim())
    .filter(Boolean)
    .join(' ');

const render = (recents: PaletteEntry[] = []) => {
  const overlayRef = { busy: signal(false), close: vi.fn() };

  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: OVERLAY_REF, useValue: overlayRef }],
  });

  const fixture = TestBed.createComponent(CommandPaletteComponent);
  const chosen: PaletteEntry[] = [];

  fixture.componentRef.setInput('entries', ENTRIES);
  fixture.componentRef.setInput('recents', recents);
  fixture.componentInstance.choose.subscribe((entry) => chosen.push(entry));
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const input = element.querySelector('input') as HTMLInputElement;
  const type = async (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const key = async (name: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  };
  const rows = () => [...element.querySelectorAll<HTMLElement>('[role="option"]')];
  const headings = () =>
    [...element.querySelectorAll('[role="group"]')].map((group) => group.getAttribute('aria-label'));
  const selected = () => rows().filter((row) => row.hasAttribute('data-selected'));

  return { fixture, element, input, type, key, rows, headings, selected, chosen, overlayRef };
};

describe('CommandPaletteComponent', () => {
  it('shows the recently opened entries under one heading while the field is empty, none selected', async () => {
    const { rows, headings, selected, input, fixture } = render([
      ENTRIES[2] as PaletteEntry,
      ENTRIES[0] as PaletteEntry,
    ]);

    await fixture.whenStable();

    expect(input.placeholder).toBe('Parts, Seiten, Skizzen und Befehle suchen');
    expect(headings()).toEqual(['Zuletzt geöffnet']);
    expect(rows().map((row) => textOf(row))).toEqual(['checkout Seite', 'tree-row Part']);
    expect(selected()).toEqual([]);
  });

  it('shows the start hint instead of a list while the field is empty and nothing was opened yet', async () => {
    const { rows, element, fixture } = render();

    await fixture.whenStable();

    const start = element.querySelector('[data-palette-start]');

    expect(rows()).toEqual([]);
    expect(element.querySelector('[data-palette-none]')).toBeNull();
    expect(start?.textContent).toContain('Noch nichts zuletzt geöffnet. Tippe einen Namen oder Befehl.');
    expect(start?.textContent).toContain('öffnet die Suche von überall.');
    expect(start?.querySelector('et-kbd')?.getAttribute('keys')).toBe('mod+k');
  });

  it('hides the start hint once something was opened or a query is typed', async () => {
    const withRecents = render([ENTRIES[0] as PaletteEntry]);

    await withRecents.fixture.whenStable();

    expect(withRecents.element.querySelector('[data-palette-start]')).toBeNull();

    TestBed.resetTestingModule();

    const typed = render();

    await typed.type('xyz');

    expect(typed.element.querySelector('[data-palette-start]')).toBeNull();
  });

  it('filters every entry by the query and groups the hits with their hint', async () => {
    const { type, rows, headings, selected } = render();

    await type('tree');

    expect(headings()).toEqual(expect.arrayContaining(['Parts', 'Skizzen']));
    expect(rows().map((row) => textOf(row))).toEqual(
      expect.arrayContaining(['tree-row Part', 'tree-row@density Skizze']),
    );
    expect(rows().some((row) => row.textContent?.includes('checkout'))).toBe(false);
    expect(selected()).toHaveLength(1);
  });

  it('names the query when nothing matches', async () => {
    const { type, rows, element } = render();

    await type('xyz');

    expect(rows()).toEqual([]);
    expect(textOf(element.querySelector('[data-palette-none]'))).toBe(
      'Nichts gefunden Für „xyz“ gibt es keinen Part, keine Seite und keine Skizze.',
    );
  });

  it('moves the selection with the arrow keys and opens the selected entry on Enter', async () => {
    const { type, key, selected, chosen, overlayRef } = render();

    await type('Design');
    expect(selected()[0]?.textContent).toContain('Design-Server neu starten');

    await type('e');
    const first = selected()[0]?.textContent;

    await key('ArrowDown');
    expect(selected()[0]?.textContent).not.toBe(first);

    await key('ArrowUp');
    expect(selected()[0]?.textContent).toBe(first);

    await key('Enter');
    expect(overlayRef.close).toHaveBeenCalledOnce();
    expect(chosen).toHaveLength(1);
    expect(first).toContain(chosen[0]?.label);
  });

  it('opens a row on click', async () => {
    const { type, rows, chosen } = render();

    await type('checkout');
    rows()[0]?.click();

    expect(chosen).toEqual([ENTRIES[2]]);
  });

  it('selects the first recent entry on ArrowDown', async () => {
    const { key, selected, chosen } = render([ENTRIES[3] as PaletteEntry, ENTRIES[1] as PaletteEntry]);

    await key('ArrowDown');
    expect(selected()[0]?.textContent).toContain('toolbar-with-a-very-long-name');

    await key('Enter');
    expect(chosen).toEqual([ENTRIES[1]]);
  });
});
