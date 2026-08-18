import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../button';
import { PLUS_ICON, TABLE_ICON, TRASH_ICON, provideIcons } from '../../icon';
import { KBD_IMPORTS } from '../../kbd';
import { COMMAND_PALETTE_IMPORTS } from '../command-palette.imports';
import { registerCommands } from '../command-palette-registry';
import { CommandPaletteCommand } from '../command-palette.types';
import { injectCommandPalette } from '../command-palette.overlay';

@Component({
  selector: 'et-sb-command-palette',
  template: `
    <div class="grid justify-items-start gap-4 p-8 font-sans" etCommandPaletteShortcut>
      <p class="text-medium">
        Press
        <et-kbd keys="mod+k" />
        , or use the button.
      </p>

      <button (click)="palette.open()" et-button size="sm" type="button" variant="outline">Open the palette</button>

      <p class="text-small opacity-70">Last run: {{ lastRun() ?? '-' }}</p>
      <p class="text-small opacity-70">Selected row: {{ selectedRow() ?? 'none' }}</p>

      <button (click)="toggleSelectedRow()" et-button size="sm" type="button" variant="outline">
        {{ selectedRow() ? 'Clear the row selection' : 'Select a row' }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...COMMAND_PALETTE_IMPORTS, ...BUTTON_IMPORTS, ...KBD_IMPORTS],
  providers: [provideIcons(PLUS_ICON, TABLE_ICON, TRASH_ICON)],
})
export class CommandPaletteStorybookComponent {
  protected palette = injectCommandPalette();

  protected lastRun = signal<string | null>(null);
  protected selectedRow = signal<string | null>(null);

  constructor() {
    registerCommands([
      {
        id: 'row.add',
        label: 'Add row',
        group: 'Rows',
        icon: 'et-plus',
        shortcut: 'mod+enter',
        priority: 10,
        run: () => this.lastRun.set('Add row'),
      },
      {
        id: 'row.duplicate',
        label: 'Duplicate the selected row',
        group: 'Rows',
        keywords: ['copy', 'clone'],
        run: () => this.lastRun.set('Duplicate the selected row'),
      },
      {
        id: 'table.create',
        label: 'Create table',
        group: 'Tables',
        icon: 'et-table',
        description: 'Starts an empty table in this workspace',
        run: () => this.lastRun.set('Create table'),
      },
      {
        id: 'table.export',
        label: 'Export table as CSV',
        group: 'Tables',
        keywords: ['download', 'spreadsheet'],
        run: () => this.lastRun.set('Export table as CSV'),
      },
      {
        id: 'user.add',
        label: 'Add user',
        group: 'Users',
        icon: 'et-plus',
        run: () => this.lastRun.set('Add user'),
      },
      {
        id: 'user.unset-serial',
        label: 'Unset serial',
        group: 'Users',
        run: () => this.lastRun.set('Unset serial'),
      },
      {
        id: 'settings.open',
        label: 'Open user settings',
        shortcut: 'mod+,',
        run: () => this.lastRun.set('Open user settings'),
      },
      {
        id: 'docs.search',
        label: 'Search the documentation',
        keywords: ['help', 'guide'],
        run: () => this.lastRun.set('Search the documentation'),
      },
    ]);

    // A signal source keeps this command's own state current with no second registration.
    registerCommands(
      computed<CommandPaletteCommand[]>(() => [
        {
          id: 'row.delete',
          label: 'Delete row',
          group: 'Rows',
          icon: 'et-trash',
          disabled: !this.selectedRow(),
          run: () => {
            this.lastRun.set('Delete row');
            this.selectedRow.set(null);
          },
        },
      ]),
    );
  }

  protected toggleSelectedRow() {
    this.selectedRow.update((current) => (current ? null : 'Row 3'));
  }
}
