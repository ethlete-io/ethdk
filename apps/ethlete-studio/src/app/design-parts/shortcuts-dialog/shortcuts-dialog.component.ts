import { Component, output, ViewEncapsulation } from '@angular/core';
import {
  BUTTON_IMPORTS,
  ICON_IMPORTS,
  KBD_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  provideIcons,
  TIMES_ICON,
} from '@ethlete/components';
import { SHORTCUTS_DIALOG_LABELS } from '../../i18n/shell-labels';

const LABELS = SHORTCUTS_DIALOG_LABELS;

export const SHORTCUTS_KEY = 'mod+/';

export const SHORTCUT_GROUPS = [
  {
    label: LABELS.general,
    rows: [
      { label: LABELS.palette, keys: 'mod+k' },
      { label: LABELS.shortcuts, keys: SHORTCUTS_KEY },
    ],
  },
  {
    label: LABELS.canvas,
    rows: [
      { label: LABELS.fitAll, keys: 'shift+1' },
      { label: LABELS.fitFocused, keys: 'shift+2' },
      { label: LABELS.actualSize, keys: 'shift+0' },
      { label: LABELS.pan, keys: 'space' },
      { label: LABELS.deselect, keys: 'esc' },
    ],
  },
];

@Component({
  selector: 'ethlete-shortcuts-dialog',
  template: `
    <div class="flex items-center justify-between gap-space-3" etOverlayHeader>
      <h2 class="m-0 text-[1.8rem] font-semibold" et-overlay-title>{{ LABELS.title }}</h2>
      <button
        [attr.aria-label]="LABELS.close"
        (click)="close.emit()"
        et-icon-button
        type="button"
        variant="transparent"
        size="sm"
      >
        <i etIcon="et-times"></i>
      </button>
    </div>
    <div class="flex flex-col gap-space-4" et-overlay-body>
      @for (group of GROUPS; track group.label) {
        <section class="flex flex-col gap-space-1">
          <h3 class="m-0 text-ui-xs font-ui-strong text-et-surface-muted">{{ group.label }}</h3>
          <dl class="m-0 flex flex-col">
            @for (row of group.rows; track row.label) {
              <div class="flex items-center justify-between gap-space-3 py-space-1 text-ui-sm">
                <dt class="text-et-surface">{{ row.label }}</dt>
                <dd class="m-0"><et-kbd [keys]="row.keys" /></dd>
              </div>
            }
          </dl>
        </section>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KBD_IMPORTS, BUTTON_IMPORTS, ICON_IMPORTS, OVERLAY_CONTENT_IMPORTS],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [OverlayMainDirective],
})
export class ShortcutsDialogComponent {
  // eslint-disable-next-line @angular-eslint/no-output-native -- the design declares emit:close
  public close = output();

  protected readonly LABELS = LABELS;
  protected readonly GROUPS = SHORTCUT_GROUPS;
}
