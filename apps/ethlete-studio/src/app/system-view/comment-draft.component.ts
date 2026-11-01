import { Component, ViewEncapsulation, afterRenderEffect, linkedSignal, viewChild } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, TextareaComponent } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { draftKeyOf } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { STUDIO_LABELS } from '../i18n/studio-labels';

@Component({
  selector: 'ethlete-comment-draft',
  template: `
    <div
      class="flex w-80 flex-col gap-2 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-3 shadow-lg"
    >
      <et-form-field appearance="box">
        <et-textarea
          [(value)]="text"
          [attr.aria-label]="LABELS.comment"
          [placeholder]="LABELS.placeholder"
          (keydown)="handleKey($event)"
          rows="3"
        />
      </et-form-field>
      @if (store.error(); as message) {
        <p [etProvideColor]="errorTheme()" class="m-0 text-small text-(--et-theme-color-primary-solid)">
          {{ message }}
        </p>
      }
      <div class="flex justify-end gap-2">
        <button (click)="store.cancel()" et-button type="button" variant="transparent" color="surface" size="xs">
          {{ LABELS.cancel }}
        </button>
        <button
          [disabled]="store.busy() || text().trim() === ''"
          (click)="store.send(text())"
          et-button
          type="button"
          variant="filled"
          size="xs"
        >
          {{ LABELS.send }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, ProvideColorDirective],
})
export class CommentDraftComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected store = injectCommentStore();
  private field = viewChild.required(TextareaComponent);
  protected readonly LABELS = STUDIO_LABELS.commentDraft;

  protected text = linkedSignal({ source: this.store.draft, computation: () => '' });

  constructor() {
    afterRenderEffect(() => {
      if (this.store.draft()) this.field().focus();
    });
  }

  protected handleKey(event: KeyboardEvent) {
    const action = draftKeyOf(event);

    if (!action) return;

    event.preventDefault();
    event.stopPropagation();
    if (action === 'send') this.store.send(this.text());
    else this.store.cancel();
  }
}
