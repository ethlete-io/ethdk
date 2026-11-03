import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type CommentSendPhase = 'busy' | 'error' | 'rejected';

export const draftKeyOf = (event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing'>) => {
  if (event.isComposing) return null;
  if (event.key === 'Escape') return 'cancel';

  return event.key === 'Enter' && !event.shiftKey ? 'send' : null;
};

@Component({
  selector: 'ethlete-comment-draft',
  template: `
    <et-form-field>
      <et-textarea
        [(value)]="text"
        [disabled]="busy()"
        [aria-label]="LABELS.comment"
        [placeholder]="LABELS.placeholder"
        (keydown)="handleKey($event)"
        rows="3"
      />
    </et-form-field>
    @if (phase() === 'error' || phase() === 'rejected') {
      <p
        [etProvideColor]="errorTheme()"
        class="m-0 flex items-center gap-space-1 text-ui-xs text-et-theme-ink"
        role="alert"
      >
        <svg
          class="flex-none text-et-theme"
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
          <circle cx="8" cy="8" r="5.5" />
          <path d="m6 6 4 4m0-4-4 4" />
        </svg>
        <span>{{ phase() === 'rejected' ? reason() : LABELS.notSent }}</span>
      </p>
    }
    <div class="flex justify-end gap-space-2">
      <button
        [disabled]="busy()"
        (click)="discard.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="xs"
      >
        {{ LABELS.cancel }}
      </button>
      <button
        [disabled]="!text()"
        [loading]="busy()"
        (click)="submit()"
        et-button
        type="button"
        variant="filled"
        size="xs"
      >
        {{ phase() === 'error' ? LABELS.sendAgain : LABELS.send }}
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, ProvideColorDirective],
  host: {
    class:
      'flex w-80 flex-col gap-space-2 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-space-3 shadow-lg',
  },
})
export class CommentDraftComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public text = model('');
  public phase = input<CommentSendPhase | null>(null);
  public reason = input('');

  public send = output<string>();
  public discard = output();

  protected readonly LABELS = STUDIO_LABELS.commentDraft;

  protected busy = computed(() => this.phase() === 'busy');

  protected submit() {
    if (this.busy() || !this.text().trim()) return;

    this.send.emit(this.text());
  }

  protected handleKey(event: KeyboardEvent) {
    const action = draftKeyOf(event);

    if (!action) return;

    event.preventDefault();
    event.stopPropagation();
    if (action === 'send') this.submit();
    else if (!this.busy()) this.discard.emit();
  }
}
