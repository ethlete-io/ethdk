import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, KBD_IMPORTS } from '@ethlete/components';
import { WindowChrome } from '../../../host/window';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-title-search',
  template: `
    <button
      [attr.aria-label]="LABELS.search(product(), part())"
      class="w-2xl justify-start px-space-2 text-et-surface-muted [--et-button-gap:var(--space-2)] hover:text-et-surface focus-visible:text-et-surface active:text-et-surface"
      et-button
      stretchContents
      type="button"
      variant="tonal"
      color="surface"
      size="xs"
      aria-haspopup="dialog"
    >
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
      <span class="flex flex-1 justify-center gap-1 truncate font-ui">
        <span>{{ product() }}</span>
        <span aria-hidden="true">/</span>
        <span class="font-ui-strong text-et-surface">{{ part() }}</span>
      </span>
      <et-kbd [platform]="platform()" class="[&_.et-kbd-key]:text-current" keys="mod+k" />
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, KBD_IMPORTS],
  host: { class: 'contents' },
})
export class TitleSearchComponent {
  public product = input('');
  public part = input('');
  public os = input<WindowChrome['os']>();

  protected readonly LABELS = STUDIO_LABELS.titleBar;

  protected platform = computed(() => (this.os() === 'macos' ? 'apple' : 'other'));
}
