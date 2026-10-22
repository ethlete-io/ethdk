import { Component, ViewEncapsulation } from '@angular/core';
import { KBD_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-kbd-default-example',
  template: `
    <et-kbd keys="mod+k" />

    <p>Press <et-kbd keys="mod+k" /> to open the palette, then <et-kbd keys="esc" /> to dismiss it.</p>

    @for (shortcut of SHORTCUTS; track shortcut.keys) {
      <div>
        <span>{{ shortcut.label }}</span>
        <et-kbd [keys]="shortcut.keys" />
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [KBD_IMPORTS],
})
export class KbdDefaultExampleComponent {
  protected readonly SHORTCUTS = [
    { label: 'Save', keys: 'mod+s' },
    { label: 'Undo', keys: 'mod+z' },
    { label: 'Redo', keys: 'mod+shift+z' },
    { label: 'Move up a level', keys: 'alt+arrowup' },
    { label: 'Next page', keys: 'pagedown' },
    { label: 'Zoom in', keys: 'mod+plus' },
  ];
}
