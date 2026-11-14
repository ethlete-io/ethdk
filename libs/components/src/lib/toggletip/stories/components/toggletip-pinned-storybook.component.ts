import { Component, ViewEncapsulation, signal } from '@angular/core';
import { BUTTON_IMPORTS } from '../../../button';
import { TOGGLETIP_IMPORTS } from '../../toggletip.imports';

@Component({
  selector: 'et-sb-toggletip-pinned',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans" style="min-height: 24rem; padding-top: 10rem;">
      <div class="flex items-center gap-4">
        <button
          [(etToggletipOpen)]="hintOpen"
          (click)="saves.set(saves() + 1)"
          etToggletip="New: save your lineup here."
          et-button
          type="button"
        >
          Save lineup
        </button>

        <span data-save-count>Saved {{ saves() }} times</span>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, TOGGLETIP_IMPORTS],
})
export class ToggletipPinnedStorybookComponent {
  protected hintOpen = signal(true);
  protected saves = signal(0);
}
