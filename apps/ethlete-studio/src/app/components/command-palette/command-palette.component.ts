import { Component, computed, input, output, signal, viewChild, ViewEncapsulation } from '@angular/core';
import {
  CommandPaletteDirective,
  CommandPaletteResult,
  CommandPaletteSearchDirective,
  KBD_IMPORTS,
  provideCommandPaletteRegistry,
  registerCommands,
} from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type PaletteKind = 'part' | 'page' | 'sketch' | 'command';

export type PaletteEntry = { kind: PaletteKind; key: string; label: string };

const LABELS = STUDIO_LABELS.commandPalette;

@Component({
  selector: 'ethlete-command-palette',
  template: `
    <div #palette="etCommandPalette" [(query)]="query" class="flex flex-col font-ui text-et-surface" etCommandPalette>
      <div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2 text-ui-sm">
        <span class="flex text-et-surface-muted">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.25" />
            <path d="M10.25 10.25 13.5 13.5" />
          </svg>
        </span>
        <input
          [placeholder]="LABELS.placeholder"
          [attr.aria-label]="LABELS.placeholder"
          (keydown.arrowdown)="navigated.set(true)"
          (keydown.arrowup)="navigated.set(true)"
          class="min-w-0 flex-1 bg-transparent text-et-surface outline-none placeholder:text-et-surface-muted"
          etCommandPaletteSearch
        />
        <et-kbd keys="esc" />
      </div>
      <div [id]="palette.listboxId" [attr.aria-label]="LABELS.label" class="max-h-64 overflow-auto" role="listbox">
        @for (group of palette.groups(); track group.label) {
          <div [attr.aria-label]="group.label" class="flex flex-col gap-0.5 p-space-1" role="group">
            <div class="px-space-2 pt-space-1 text-(length:--text-xs) text-et-surface-muted" aria-hidden="true">
              {{ group.label }}
            </div>
            @for (result of group.results; track result.command.id) {
              @let selected = isSelected(result);
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -- an option is reached through aria-activedescendant on the focused search field, which handles the keys -->
              <div
                [id]="palette.rowId(result.command)"
                [attr.aria-selected]="selected"
                [attr.data-selected]="selected ? '' : null"
                [class]="selected ? 'bg-et-theme/20' : ''"
                (pointermove)="point(result)"
                (click)="palette.run(result.command)"
                class="flex cursor-default items-center gap-space-2 rounded-control-sm px-space-2 py-space-1 text-ui-sm text-et-surface"
                role="option"
                data-et-control="row"
              >
                <span class="flex text-et-surface-muted">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="7" cy="7" r="4.25" />
                    <path d="M10.25 10.25 13.5 13.5" />
                  </svg>
                </span>
                <span class="min-w-0 flex-1 truncate">{{ result.command.label }}</span>
                <span class="text-(length:--text-xs) text-et-surface-muted">{{ result.command.description }}</span>
              </div>
            }
          </div>
        } @empty {
          @if (query()) {
            <div class="flex flex-col items-center gap-space-1 px-space-3 py-space-6 text-ui-sm" data-palette-none>
              <span class="font-ui-strong text-et-surface">{{ LABELS.none }}</span>
              <span class="text-et-surface-muted">{{ LABELS.noneFor(query()) }}</span>
            </div>
          }
        }
      </div>
      <div
        class="flex gap-space-3 border-t border-et-surface-border px-space-3 py-space-2 text-(length:--text-xs) text-et-surface-muted"
      >
        <span>{{ LABELS.select }}</span>
        <span>{{ LABELS.open }}</span>
        <span class="flex-1"></span>
        <span>{{ LABELS.close }}</span>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CommandPaletteDirective, CommandPaletteSearchDirective, KBD_IMPORTS],
  providers: [provideCommandPaletteRegistry()],
  host: { class: 'block', 'data-et-auto-surface': '' },
})
export class CommandPaletteComponent {
  public entries = input<PaletteEntry[]>([]);
  public recents = input<PaletteEntry[]>([]);

  public choose = output<PaletteEntry>();

  private behavior = viewChild.required(CommandPaletteDirective);
  private field = viewChild.required(CommandPaletteSearchDirective);

  protected readonly LABELS = LABELS;

  protected query = signal('');
  protected navigated = signal(false);

  private commands = computed(() => {
    const searching = this.query().trim() !== '';

    return (searching ? this.entries() : this.recents()).map((entry) => ({
      id: `${entry.kind}:${entry.key}`,
      label: entry.label,
      group: searching ? LABELS.groups[entry.kind] : LABELS.recent,
      description: LABELS.hints[entry.kind],
      run: () => this.choose.emit(entry),
    }));
  });

  constructor() {
    registerCommands(this.commands);
  }

  public focus() {
    this.field().focus();
  }

  protected isSelected(result: CommandPaletteResult) {
    return (this.navigated() || this.query() !== '') && this.behavior().activeCommandId() === result.command.id;
  }

  protected point(result: CommandPaletteResult) {
    this.navigated.set(true);
    this.behavior().setActive(result);
  }
}
