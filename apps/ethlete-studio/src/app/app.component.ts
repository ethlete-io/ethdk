import { Component, ViewEncapsulation, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { injectCodeWatch } from './code-watch';
import { CODE_LABELS } from './i18n/shell-labels';

@Component({
  selector: 'ethlete-root',
  template: `
    <div class="flex min-w-0 grow flex-col bg-(--et-surface-background)">
      <router-outlet />
    </div>
    @if (reloading()) {
      <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-space-2 bg-et-surface-background font-ui text-et-surface-text transition-opacity duration-300 starting:opacity-0"
        role="status"
        data-studio-reloading
      >
        <p class="text-ui-lg">{{ CODE_LABELS.reloading }}</p>
        <p class="text-ui-sm text-et-surface-text-muted">{{ CODE_LABELS.reloadingHint }}</p>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet],
  host: { class: 'flex h-dvh overflow-hidden' },
})
export class AppComponent {
  private codeWatch = injectCodeWatch();
  protected readonly CODE_LABELS = CODE_LABELS;

  protected reloading = computed(() => this.codeWatch.restart() === 'reloading');
}
