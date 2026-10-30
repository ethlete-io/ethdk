import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { CommentReply } from '../../host/design';
import { SENDER_LABELS, addressedByOf, addressedLabelOf, ageOf, draftKeyOf } from './comment-pins';
import { injectCommentStore } from './comment-store';

@Component({
  selector: 'ethlete-comment-thread',
  template: `
    @if (comment(); as comment) {
      <ol class="m-0 flex max-h-80 w-full list-none flex-col gap-3 overflow-y-auto p-0" data-comment-thread>
        @for (entry of entries(); track $index) {
          <li [attr.data-comment-by]="entry.by" class="flex flex-col gap-0.5">
            <span class="flex gap-2 text-[1.1rem] text-(--et-surface-color-subtle-solid)">
              <span [class.text-accent]="entry.by === 'agent'" class="font-semibold">{{
                entry.author ? SENDER_LABELS[entry.by] + ' · ' + entry.author : SENDER_LABELS[entry.by]
              }}</span>
              <time [attr.datetime]="entry.createdAt" [title]="entry.createdAt">{{
                AGE_OF(entry.createdAt, now())
              }}</time>
            </span>
            <p [textContent]="entry.text" class="m-0 whitespace-pre-wrap"></p>
          </li>
        }
      </ol>
      @if (comment.addressed; as addressed) {
        <span
          [title]="addressed.note ?? ''"
          class="rounded-full border border-surface-border px-2 text-[1.1rem]"
          data-comment-addressed
          >{{ ADDRESSED_LABEL_OF(addressed) }} · {{ ADDRESSED_BY_OF(addressed) }}</span
        >
      }
      <et-form-field class="w-full" appearance="box">
        <et-textarea
          [(value)]="text"
          (keydown)="handleKey($event)"
          aria-label="Reply"
          placeholder="Reply - Enter sends, Shift+Enter breaks the line"
          rows="2"
          data-comment-reply
        />
      </et-form-field>
      @if (store.error(); as message) {
        <p [etProvideColor]="errorTheme()" class="m-0 text-small text-(--et-theme-color-primary-solid)">
          {{ message }}
        </p>
      }
      <div class="flex w-full justify-between gap-2">
        <button
          (click)="store.withdraw(comment.id)"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="xs"
          data-comment-withdraw
        >
          Withdraw
        </button>
        <span class="flex gap-2">
          <button
            [disabled]="store.busy()"
            (click)="store.resolve(comment.id)"
            et-button
            type="button"
            variant="outline"
            color="surface"
            size="xs"
            data-comment-resolve
          >
            Resolve
          </button>
          <button
            [disabled]="store.busy() || text().trim() === ''"
            (click)="send()"
            et-button
            type="button"
            variant="filled"
            size="xs"
          >
            Reply
          </button>
        </span>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, ProvideColorDirective],
  host: { class: 'flex w-full flex-col items-start gap-2' },
})
export class CommentThreadComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected store = injectCommentStore();

  public commentId = input.required<string>();

  protected comment = computed(() => this.store.comments().find((comment) => comment.id === this.commentId()) ?? null);

  protected entries = computed((): CommentReply[] => {
    const comment = this.comment();

    return comment ? [{ by: 'user', text: comment.text, createdAt: comment.createdAt }, ...comment.replies] : [];
  });

  protected text = linkedSignal({ source: this.store.repliesSent, computation: () => '' });

  protected now = computed(() => {
    this.comment();

    return Date.now();
  });

  protected readonly AGE_OF = ageOf;
  protected readonly SENDER_LABELS = SENDER_LABELS;
  protected readonly ADDRESSED_LABEL_OF = addressedLabelOf;
  protected readonly ADDRESSED_BY_OF = addressedByOf;

  protected send() {
    this.store.reply(this.commentId(), this.text());
  }

  protected handleKey(event: KeyboardEvent) {
    if (draftKeyOf(event) !== 'send') return;

    event.preventDefault();
    event.stopPropagation();
    this.send();
  }
}
