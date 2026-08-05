import { Component, input, ViewEncapsulation } from '@angular/core';
import { KbdPlatform } from '../kbd-keys';
import { KBD_IMPORTS } from '../kbd.imports';

@Component({
  selector: 'et-sb-kbd',
  template: `
    <div [style.max-inline-size.px]="440" class="flex flex-col gap-8 p-8 font-sans">
      <et-kbd [keys]="keys()" [platform]="platform()" />

      <p class="text-medium">
        Press <et-kbd [keys]="keys()" [platform]="platform()" /> to open the palette, then
        <et-kbd [platform]="platform()" keys="esc" /> to dismiss it.
      </p>

      <div class="flex flex-col gap-3">
        @for (shortcut of SHORTCUTS; track shortcut.keys) {
          <div class="flex items-center justify-between gap-4">
            <span class="text-small">{{ shortcut.label }}</span>
            <et-kbd [keys]="shortcut.keys" [platform]="platform()" />
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KBD_IMPORTS],
})
export class KbdStorybookComponent {
  public keys = input('mod+k');

  public platform = input<KbdPlatform>();

  protected readonly SHORTCUTS = [
    { label: 'Save', keys: 'mod+s' },
    { label: 'Undo', keys: 'mod+z' },
    { label: 'Redo', keys: 'mod+shift+z' },
    { label: 'Move up a level', keys: 'alt+arrowup' },
    { label: 'Next page', keys: 'pagedown' },
    { label: 'Zoom in', keys: 'mod+plus' },
  ];
}
