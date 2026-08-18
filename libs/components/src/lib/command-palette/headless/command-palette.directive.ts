import { Directive, InjectionToken, computed, inject, input, model, signal } from '@angular/core';
import { createComponentId } from '@ethlete/core';
import { OVERLAY_REF } from '../../overlay';
import { injectCommandPaletteRegistry } from '../command-palette-registry';
import { CommandPaletteCommand, CommandPaletteResult } from '../command-palette.types';
import { groupResults, rankCommands } from './internals/rank-commands';

export const COMMAND_PALETTE_TOKEN = new InjectionToken<CommandPaletteDirective>('ET_COMMAND_PALETTE_TOKEN');

/**
 * The palette's behavior: the query, the ranked results, which row is active, and running a command.
 * Holds no visual opinion - `et-command-palette` is the rendered one.
 *
 * Commands come from {@link injectCommandPaletteRegistry}, not from this element's content.
 */
@Directive({
  selector: '[etCommandPalette]',
  exportAs: 'etCommandPalette',
  providers: [{ provide: COMMAND_PALETTE_TOKEN, useExisting: CommandPaletteDirective }],
  host: {
    '(keydown)': 'handleKeydown($event)',
  },
})
export class CommandPaletteDirective {
  private registry = injectCommandPaletteRegistry();
  private overlayRef = inject(OVERLAY_REF, { optional: true });

  /** What the reader typed. Two-way, so a consumer can seed or clear it. */
  public query = model('');

  /** Whether choosing a command closes the palette. */
  public closeOnRun = input(true);

  private activeId = signal<string | null>(null);

  /** Every command the query matched, best first. */
  public results = computed(() => rankCommands(this.registry.commands(), this.query()));

  /** The same results under their headings, for rendering. */
  public groups = computed(() => groupResults(this.results()));

  /**
   * The results in the order they are rendered, which is the grouped order and not the ranked one. The
   * arrow keys must walk what the reader sees, or the highlight jumps between groups.
   */
  public orderedResults = computed(() => this.groups().flatMap((group) => group.results));

  /** Results a reader can actually reach with the arrow keys. */
  public enabledResults = computed(() => this.orderedResults().filter((result) => !result.command.disabled));

  /** Whether anything is registered at all, which reads differently from a query matching nothing. */
  public hasCommands = computed(() => this.registry.commands().length > 0);

  /**
   * Whether any listed command carries an icon. Rows reserve the icon column together, so their labels
   * line up instead of stepping in and out as the query changes which commands have one.
   */
  public hasIcons = computed(() => this.orderedResults().some((result) => !!result.command.icon));

  /**
   * The row Enter would run. Falls back to the first enabled result, so a query that filters the chosen
   * row away still has a row to run, and deleting back to it restores it.
   */
  public activeResult = computed<CommandPaletteResult | null>(() => {
    const enabled = this.enabledResults();
    const id = this.activeId();
    const active = id ? enabled.find((result) => result.command.id === id) : undefined;

    return active ?? enabled[0] ?? null;
  });

  /** Id of the element listing the results, so a search field can point `aria-controls` at it. */
  public listboxId = createComponentId('et-command-palette-list');

  /** Id of the command Enter would run, for a template marking the active row. */
  public activeCommandId = computed(() => this.activeResult()?.command.id ?? null);

  private rowIdPrefix = createComponentId('et-command-palette-row');

  // Ids are handed out by position rather than built from a command id, which is the app's string and may
  // hold whitespace an `id` attribute cannot.
  private rowIds = computed(
    () => new Map(this.orderedResults().map((result, index) => [result.command.id, `${this.rowIdPrefix}-${index}`])),
  );

  /** @internal */
  public activeDescendantId = computed(() => {
    const active = this.activeResult();

    return active ? this.rowId(active.command) : null;
  });

  /** @internal The id of a rendered row, for `aria-activedescendant`. */
  public rowId(command: CommandPaletteCommand) {
    return this.rowIds().get(command.id) ?? null;
  }

  public setActive(result: CommandPaletteResult | null) {
    this.activeId.set(result?.command.id ?? null);
  }

  /** Runs a command, and closes the palette first so the command may open an overlay of its own. */
  public run(command: CommandPaletteCommand) {
    if (command.disabled) {
      return;
    }

    if (this.closeOnRun()) {
      this.overlayRef?.close();
    }

    command.run();
  }

  public runActive() {
    const active = this.activeResult();

    if (active) {
      this.run(active.command);
    }
  }

  /** @internal Central keyboard handling for the host, the search field, and the rows. */
  public handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        break;

      case 'Home':
        // Home and End belong to the search field's own text editing until it is empty.
        if (this.query()) return;
        event.preventDefault();
        this.moveActiveTo(0);
        break;

      case 'End':
        if (this.query()) return;
        event.preventDefault();
        this.moveActiveTo(this.enabledResults().length - 1);
        break;

      case 'Enter':
        event.preventDefault();
        this.runActive();
        break;

      default:
        break;
    }
  }

  private moveActive(delta: number) {
    const enabled = this.enabledResults();

    if (!enabled.length) {
      return;
    }

    const current = this.activeResult();
    const index = current ? enabled.findIndex((result) => result.command.id === current.command.id) : -1;

    const next = (index + delta + enabled.length) % enabled.length;

    this.setActive(enabled[next] ?? null);
  }

  private moveActiveTo(index: number) {
    this.setActive(this.enabledResults()[index] ?? null);
  }
}
