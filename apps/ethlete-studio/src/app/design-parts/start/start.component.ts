import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

@Component({
  selector: 'ethlete-start',
  template: `
    <header class="flex items-center gap-space-3 p-space-4">
      <svg width="24" height="24" viewBox="0 0 32 32" role="img" aria-label="Ethlete Studio">
        <g color="#051211">
          <rect width="32" height="32" rx="8" fill="#25aea7" />
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M11.5 5.5H24.1C26 5.5 27 6.9 26.4 8.7L22.8 20.9C22.5 22 21.8 22.9 20.8 23.4L8 28L9 21.6L5.9 17.4C5.2 16.5 5.2 15.2 5.9 14.2L9.4 6.8C9.8 6 10.6 5.5 11.5 5.5ZM12.8 11.5C12 11.3 11.2 11.8 11 12.6L10.2 15.7C10 16.5 10.5 17.3 11.3 17.5C12.1 17.7 12.9 17.2 13.1 16.4L13.9 13.3C14.1 12.5 13.6 11.7 12.8 11.5ZM20.1 10.6C19.3 10.4 18.5 10.9 18.3 11.7L17.5 14.8C17.3 15.6 17.8 16.4 18.6 16.6C19.4 16.8 20.2 16.3 20.4 15.5L21.2 12.4C21.4 11.6 20.9 10.8 20.1 10.6Z"
          />
        </g>
      </svg>
      <span class="text-et-surface font-ui-strong text-ui-md">{{ labels.title }}</span>
      @if (repo(); as name) {
        <span class="text-et-surface-muted text-ui-sm">{{ name }}</span>
        <button (click)="otherRepo.emit()" et-button type="button" variant="transparent" color="surface" size="sm">
          {{ labels.otherRepo }}
        </button>
      }
    </header>
    <div class="flex-1 flex items-center justify-center">
      <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">
        @if (repo(); as name) {
          <div class="flex items-center gap-space-2" aria-hidden="true">
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
            <span class="block size-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>
          </div>
          <p class="m-0 text-et-surface font-ui-strong text-ui-md">{{ labels.noProducts }}</p>
          <p class="m-0 text-et-surface-muted">{{ labels.productExplainer }}</p>
          <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-bg text-et-surface text-ui-sm">
            {{ labels.prompt(name) }}
          </p>
          <button (click)="copyPrompt.emit()" et-button type="button" variant="outline" size="sm">
            {{ labels.copyPrompt }}
          </button>
          <p class="m-0 text-et-surface-muted">
            {{ labels.orTerminal }} <code>{{ labels.command }}</code>
          </p>
        } @else {
          <span
            class="block w-24 h-16 rounded-sm outline outline-et-surface-border bg-et-surface-bg"
            aria-hidden="true"
          ></span>
          <p class="m-0 text-et-surface font-ui-strong text-ui-md">{{ labels.noRepo }}</p>
          <p class="m-0 text-et-surface-muted">{{ labels.repoExplainer }}</p>
          <button (click)="openRepo.emit()" et-button type="button" variant="filled">{{ labels.openRepo }}</button>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  host: { class: 'flex h-full min-h-225 w-full flex-col bg-et-surface-bg' },
})
export class StartComponent {
  public repo = input<string | undefined>();
  public openRepo = output();
  public otherRepo = output();
  public copyPrompt = output();

  protected labels = STUDIO_LABELS.start;
}
