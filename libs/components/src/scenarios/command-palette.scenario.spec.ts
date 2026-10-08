import { Component, computed, getDebugNode, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, injectLocale, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import {
  COMMAND_PALETTE_ERROR_CODES,
  COMMAND_PALETTE_IMPORTS,
  COMMAND_PALETTE_LABELS,
  COMMAND_PALETTE_OVERLAY,
  COMMAND_PALETTE_REGISTRY,
  COMMAND_PALETTE_TOKEN,
  CommandPaletteCommand,
  CommandPaletteComponent,
  CommandPaletteDirective,
  CommandPaletteItemComponent,
  CommandPaletteSearchDirective,
  CommandPaletteShortcutDirective,
  commandPaletteLabelsForLocale,
  createOverlayOpener,
  DEFAULT_COMMAND_PALETTE_LABELS,
  GERMAN_COMMAND_PALETTE_LABELS,
  createCommandPaletteOpener,
  injectCommandPaletteLabels,
  injectCommandPaletteRegistry,
  injectOverlayManager,
  KBD_PLATFORM,
  provideCommandPaletteLabels,
  provideCommandPaletteRegistry,
  provideOverlay,
  registerCommands,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'primary', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 30 30') },
];

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const settle = (s: Scenario) => {
  s.tick();
  s.frame(3);
  s.tick(400);
  s.frame(3);
};

const search = () => query<HTMLInputElement>('et-command-palette input');

const type = (s: Scenario, value: string, input = search()) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('et-command-palette-item'));

const rowLabels = () => rows().map((row) => text(row.querySelector('.et-command-palette-item-label')));

const activeRow = () => text(query('.et-command-palette-item--active .et-command-palette-item-label'));

const chord = (s: Scenario, key: string, init: KeyboardEventInit = { ctrlKey: true }) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
  settle(s);
};

const paletteOpen = () => !!document.querySelector('et-command-palette');

@Component({
  selector: 'et-scenario-rows-feature',
  template: `<p>Rows</p>`,
})
class RowsFeatureComponent {
  ran = inject(ShellComponent).ran;

  constructor() {
    registerCommands([
      { id: 'row.add', label: 'Add row', group: 'Rows', shortcut: 'mod+enter', run: () => this.ran.push('row.add') },
    ]);
  }
}

@Component({
  selector: 'et-scenario-palette-shell',
  imports: [COMMAND_PALETTE_IMPORTS, RowsFeatureComponent],
  template: `
    <main etCommandPaletteShortcut>
      <button (click)="open()" class="open" type="button">Commands</button>
      @if (rows()) {
        <et-scenario-rows-feature />
      }
    </main>
  `,
})
class ShellComponent {
  palette = createCommandPaletteOpener();
  rows = signal(false);
  hasSelection = signal(false);
  ran: string[] = [];

  registration = registerCommands(
    computed<CommandPaletteCommand[]>(() => [
      {
        id: 'team.create',
        label: 'Create team',
        group: 'Teams',
        description: 'Adds team-a to the league',
        run: () => this.ran.push('team.create'),
      },
      {
        id: 'team.delete',
        label: 'Delete team',
        group: 'Teams',
        disabled: !this.hasSelection(),
        run: () => this.ran.push('team.delete'),
      },
      {
        id: 'team.export',
        label: 'Export teams',
        group: 'Teams',
        keywords: ['csv', 'spreadsheet'],
        run: () => this.ran.push('team.export'),
      },
      { id: 'help', label: 'Open help', run: () => this.ran.push('help') },
    ]),
  );

  open() {
    this.palette.open();
  }
}

@Component({
  selector: 'et-scenario-token-probe',
  template: `{{ palette.query() }}`,
})
class TokenProbeComponent {
  palette = inject(COMMAND_PALETTE_TOKEN);
}

@Component({
  selector: 'et-scenario-inline-palette',
  imports: [CommandPaletteDirective, CommandPaletteSearchDirective, TokenProbeComponent],
  providers: [provideCommandPaletteRegistry()],
  template: `
    <section #palette="etCommandPalette" [(query)]="term" [closeOnRun]="closeOnRun" etCommandPalette>
      <input class="own-search" etCommandPaletteSearch />
      <ul [id]="palette.listboxId" role="listbox">
        @for (result of palette.orderedResults(); track result.command.id) {
          <li
            [id]="palette.rowId(result.command)"
            [attr.aria-selected]="palette.activeCommandId() === result.command.id"
            role="option"
          >
            <button (click)="palette.run(result.command)" type="button">{{ result.command.label }}</button>
          </li>
        }
      </ul>
      <et-scenario-token-probe />
    </section>
  `,
})
class InlinePaletteComponent {
  term = signal('');
  closeOnRun = false;
  ran: string[] = [];
  registry = injectCommandPaletteRegistry();
  sameRegistry = inject(COMMAND_PALETTE_REGISTRY) === this.registry;

  constructor() {
    registerCommands([
      { id: 'match.start', label: 'Start match', run: () => this.ran.push('match.start') },
      { id: 'match.pause', label: 'Pause match', run: () => this.ran.push('match.pause') },
    ]);
  }
}

@Component({
  selector: 'et-scenario-stray-search',
  imports: [CommandPaletteSearchDirective],
  template: `<input etCommandPaletteSearch />`,
})
class StraySearchComponent {}

@Component({
  selector: 'et-scenario-modifier-shortcut',
  imports: [CommandPaletteShortcutDirective],
  template: `<div etCommandPaletteShortcut="mod+shift"></div>`,
})
class ModifierShortcutComponent {}

@Component({
  selector: 'et-scenario-labels-probe',
  template: `{{ labels().placeholder }}`,
})
class LabelsProbeComponent {
  labels = injectCommandPaletteLabels();
  source = inject(COMMAND_PALETTE_LABELS);
}

describe('command palette scenarios', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(COLOR_THEMES),
      { provide: KBD_PLATFORM, useValue: 'other' },
    ],
  });

  it('opens on the shortcut, ranks what the reader types, walks enabled rows and runs one with Enter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance;

    s.tick();
    chord(s, 'k');

    expect(paletteOpen()).toBe(true);
    expect(query('.et-command-palette-panel').contains(query('et-command-palette'))).toBe(true);

    const input = search();

    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-label')).toBe(DEFAULT_COMMAND_PALETTE_LABELS.searchLabel);
    expect(input.placeholder).toBe(DEFAULT_COMMAND_PALETTE_LABELS.placeholder);
    expect(input.getAttribute('aria-expanded')).toBe('true');

    const listbox = query('[role="listbox"]');

    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(rowLabels()).toEqual(['Open help', 'Create team', 'Delete team', 'Export teams']);
    expect(text(query('.et-command-palette-group-label'))).toBe('Teams');
    expect(listbox.querySelectorAll('[role="group"]')[1]?.getAttribute('aria-labelledby')).toBe(
      query('.et-command-palette-group-label').id,
    );
    expect(rows().map((row) => row.getAttribute('role'))).toEqual(Array(4).fill('option'));
    expect(getDebugNode(rows()[0])?.componentInstance).toBeInstanceOf(CommandPaletteItemComponent);
    expect(rows()[2]?.getAttribute('aria-disabled')).toBe('true');
    expect(text(rows()[1]?.querySelector('.et-command-palette-item-description'))).toBe('Adds team-a to the league');
    expect(activeRow()).toBe('Open help');
    expect(input.getAttribute('aria-activedescendant')).toBe(rows()[0]?.id);

    s.keydown('ArrowDown', input);
    s.keydown('ArrowDown', input);
    expect(activeRow()).toBe('Export teams');
    expect(input.getAttribute('aria-activedescendant')).toBe(rows()[3]?.id);
    expect(rows()[3]?.getAttribute('aria-selected')).toBe('true');

    s.keydown('ArrowDown', input);
    expect(activeRow()).toBe('Open help');

    s.keydown('ArrowUp', input);
    expect(activeRow()).toBe('Export teams');

    s.keydown('Home', input);
    expect(activeRow()).toBe('Open help');

    s.keydown('End', input);
    expect(activeRow()).toBe('Export teams');

    type(s, 'csv');
    expect(rowLabels()).toEqual(['Export teams']);

    type(s, 'crt');
    expect(rowLabels()).toEqual(['Create team']);
    expect(
      Array.from(rows()[0]?.querySelectorAll('mark') ?? [])
        .map(text)
        .join(''),
    ).toBe('Crt');

    type(s, 'zzzz');
    expect(rows()).toHaveLength(0);
    expect(text(query('.et-command-palette-empty'))).toBe(DEFAULT_COMMAND_PALETTE_LABELS.empty);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.hasAttribute('aria-controls')).toBe(false);

    s.keydown('Escape', input);
    settle(s);
    expect(paletteOpen()).toBe(true);
    expect(input.value).toBe('');
    expect(rows()).toHaveLength(4);

    type(s, 'export');
    s.keydown('Enter', input);
    settle(s);

    expect(shell.ran).toEqual(['team.export']);
    expect(paletteOpen()).toBe(false);

    chord(s, 'k');
    expect(paletteOpen()).toBe(true);
    expect(search().value).toBe('');

    chord(s, 'k');
    expect(paletteOpen()).toBe(false);

    chord(s, 'k', { metaKey: true });
    expect(paletteOpen()).toBe(false);

    fixture.destroy();
    settle(s);
  });

  it('opens from a button, runs a row by pointer, and follows commands that come, go and change state', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);
    const shell = fixture.componentInstance;

    s.tick();
    query('.open').click();
    settle(s);

    expect(paletteOpen()).toBe(true);
    expect(s.run(() => injectOverlayManager().openOverlays())[0]?.componentInstance()).toBeInstanceOf(
      CommandPaletteComponent,
    );

    const disabled = rows()[2] as HTMLElement;

    disabled.click();
    s.tick();
    expect(shell.ran).toEqual([]);
    expect(paletteOpen()).toBe(true);

    rows()[3]?.dispatchEvent(new MouseEvent('mousemove'));
    s.tick();
    expect(activeRow()).toBe('Export teams');

    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    rows()[3]?.dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);

    shell.hasSelection.set(true);
    shell.rows.set(true);
    s.tick();

    expect(rowLabels()).toEqual(['Open help', 'Create team', 'Delete team', 'Export teams', 'Add row']);
    expect(rows()[2]?.hasAttribute('aria-disabled')).toBe(false);
    expect(rows()[4]?.querySelector('et-kbd')).not.toBeNull();

    rows()[2]?.click();
    settle(s);

    expect(shell.ran).toEqual(['team.delete']);
    expect(paletteOpen()).toBe(false);

    shell.rows.set(false);
    s.tick();
    query('.open').click();
    settle(s);

    expect(rowLabels()).toEqual(['Open help', 'Create team', 'Delete team', 'Export teams']);

    shell.registration.destroy();
    shell.registration.destroy();
    s.tick();

    expect(rows()).toHaveLength(0);
    expect(text(query('.et-command-palette-empty'))).toBe(DEFAULT_COMMAND_PALETTE_LABELS.noCommands);

    s.keydown('Escape', search());
    settle(s);
    expect(paletteOpen()).toBe(false);

    fixture.destroy();
    settle(s);
  });

  it('opens the palette overlay definition with an opener of the app’s own', () => {
    const s = scenario();
    const registry = s.run(() => injectCommandPaletteRegistry());
    const ran: string[] = [];

    registry.register([{ id: 'reload', label: 'Reload standings', run: () => ran.push('reload') }]);

    const opener = s.run(() => createOverlayOpener(COMMAND_PALETTE_OVERLAY, { panelClass: 'app-palette' }));

    opener.open();
    settle(s);

    const panel = query('.et-command-palette-panel');

    expect(panel.classList).toContain('app-palette');
    expect(panel.querySelector('et-command-palette-item')).not.toBeNull();

    s.keydown('Enter', search());
    settle(s);

    expect(ran).toEqual(['reload']);
    expect(paletteOpen()).toBe(false);

    registry.clear();
    expect(registry.commands()).toEqual([]);
  });

  it('drives a headless palette of its own markup with a two-way query and without closing on run', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(InlinePaletteComponent);
    const page = fixture.componentInstance;

    s.tick();

    const input = query<HTMLInputElement>('.own-search');
    const options = () => Array.from(document.querySelectorAll('li[role="option"]'));

    expect(page.sameRegistry).toBe(true);
    expect(page.registry.commands().map((command) => command.id)).toEqual(['match.start', 'match.pause']);
    expect(input.getAttribute('aria-controls')).toBe(query('ul').id);
    expect(options().map(text)).toEqual(['Start match', 'Pause match']);

    type(s, 'pause', input);
    expect(page.term()).toBe('pause');
    expect(text(query('et-scenario-token-probe'))).toBe('pause');
    expect(options().map(text)).toEqual(['Pause match']);
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0]?.id);

    page.term.set('');
    s.tick();
    expect(input.value).toBe('');

    s.keydown('ArrowDown', input);
    expect(text(query('li[aria-selected="true"]'))).toBe('Pause match');
    s.keydown('Enter', input);
    query('li:first-child button').click();
    s.tick();

    expect(page.ran).toEqual(['match.pause', 'match.start']);
    expect(document.querySelector('.own-search')).not.toBeNull();
  });

  it('reports a search field outside a palette and a shortcut of modifiers only', () => {
    const s = scenario();

    TestBed.createComponent(StraySearchComponent);
    s.tick(1);
    s.expectError(String(COMMAND_PALETTE_ERROR_CODES.SEARCH_OUTSIDE_PALETTE));

    const context = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

    expect((s.errors.splice(context, 1)[0]?.error as { element?: HTMLElement }).element?.tagName).toBe('INPUT');

    TestBed.createComponent(ModifierShortcutComponent);
    s.tick(1);
    s.expectError(String(COMMAND_PALETTE_ERROR_CODES.SHORTCUT_WITHOUT_KEY));
  });

  it('switches its own strings with the locale', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShellComponent);

    expect(commandPaletteLabelsForLocale('de-AT')).toBe(GERMAN_COMMAND_PALETTE_LABELS);
    expect(commandPaletteLabelsForLocale('fr')).toBe(DEFAULT_COMMAND_PALETTE_LABELS);

    s.run(() => injectLocale().currentLocale.set('de'));
    s.tick();
    query('.open').click();
    settle(s);

    expect(search().placeholder).toBe(GERMAN_COMMAND_PALETTE_LABELS.placeholder);
    expect(search().getAttribute('aria-label')).toBe(GERMAN_COMMAND_PALETTE_LABELS.searchLabel);

    type(s, 'zzzz');
    expect(text(query('.et-command-palette-empty'))).toBe(GERMAN_COMMAND_PALETTE_LABELS.empty);

    fixture.destroy();
    settle(s);
  });
});

describe('command palette scenarios with app labels', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideCommandPaletteLabels({ placeholder: 'Rechercher une commande…' }),
    ],
  });

  it('overrides one string and keeps the locale’s others', () => {
    const s = scenario();
    const probe = TestBed.createComponent(LabelsProbeComponent);

    s.tick();

    expect(text(probe.nativeElement)).toBe('Rechercher une commande…');
    expect(probe.componentInstance.source).toEqual({ placeholder: 'Rechercher une commande…' });

    s.run(() => createCommandPaletteOpener()).open();
    settle(s);

    expect(search().placeholder).toBe('Rechercher une commande…');
    expect(search().getAttribute('aria-label')).toBe(DEFAULT_COMMAND_PALETTE_LABELS.searchLabel);

    s.keydown('Escape', search());
    settle(s);
    expect(paletteOpen()).toBe(false);
  });
});
