import { Directive, inject, input } from '@angular/core';
import { injectPipManager } from '../../pip-manager';
import { StreamPipEntry } from '../../stream-manager.types';
import { PIP_CHROME_REF_TOKEN } from './pip-chrome-ref.token';
import { PIP_ENTRY_TOKEN } from './pip-entry.token';

@Directive({
  selector: '[etPipBack]',
  host: {
    class: 'et-stream-pip-chrome__back',
    type: 'button',
    'attr.aria-label': '"Focus"',
    '(click)': 'back($event)',
  },
})
export class PipBackDirective {
  private pipManager = injectPipManager();
  private chrome = inject(PIP_CHROME_REF_TOKEN, { optional: true });
  private tokenEntry = inject(PIP_ENTRY_TOKEN, { optional: true });

  entry = input<StreamPipEntry>();

  back(event: Event) {
    event.stopPropagation();
    const entry = this.resolveEntry();
    if (!entry) return;
    this.pipManager.notifyBackPressed(entry.playerId);
    entry.onBack?.();
  }

  private resolveEntry() {
    return this.entry() ?? this.tokenEntry?.() ?? this.chrome?.state.featuredPip() ?? null;
  }
}
