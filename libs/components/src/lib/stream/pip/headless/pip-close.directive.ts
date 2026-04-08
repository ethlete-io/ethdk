import { Directive, inject, input } from '@angular/core';
import { injectPipManager } from '../../pip-manager';
import { StreamPipEntry } from '../../stream-manager.types';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';
import { PIP_ENTRY_TOKEN } from './pip-entry.token';
import { PipWindowComponent } from '../pip-window.component';

@Directive({
  selector: '[etPipClose]',
  host: {
    class: 'et-stream-pip-chrome__close',
    type: 'button',
    'attr.aria-label': '"Close"',
    '(click)': 'close($event)',
  },
})
export class PipCloseDirective {
  private pipManager = injectPipManager();
  private chrome = inject(PIP_CHROME_REF_TOKEN, { optional: true });
  private pipWindow = inject(PipWindowComponent, { optional: true });
  private tokenEntry = inject(PIP_ENTRY_TOKEN, { optional: true });

  entry = input<StreamPipEntry>();

  private resolveEntry(): StreamPipEntry | null {
    return this.entry() ?? this.tokenEntry?.() ?? null;
  }

  close(event: Event): void {
    event.stopPropagation();
    const e = this.resolveEntry();
    if (e) {
      this.pipManager.pipDeactivate(e.playerId);
    } else if (this.chrome) {
      this.chrome.state.close(event, this.pipWindow ?? undefined);
    }
  }
}
