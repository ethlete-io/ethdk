import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BUTTON_IMPORTS } from '@ethlete/components';
import {
  NumberedComment,
  ResolvedComment,
  SENDER_LABELS,
  addressedLabelOf,
  ageOf,
  commentGroupsOf,
  commentWhereOf,
  isAnswered,
  isQuestion,
  lastSenderOf,
  resolvedByOf,
} from './comment-pins';

@Component({
  selector: 'ethlete-comment-panel',
  template: `
    <header class="flex items-center gap-2 border-b border-surface-border px-4 py-3">
      <h2 class="m-0 flex-1 text-[1.4rem] font-semibold">Comments</h2>
      @if (resolved().length) {
        <button
          [attr.aria-pressed]="resolvedShown()"
          (click)="resolvedToggle.emit(!resolvedShown())"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="xs"
          data-comment-resolved-toggle
        >
          {{ resolvedShown() ? 'Hide resolved' : 'Show resolved (' + resolved().length + ')' }}
        </button>
      }
      <button
        (click)="dismiss.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="xs"
        aria-label="Close the comments"
      >
        ×
      </button>
    </header>
    <ng-template #entry let-comment>
      <button
        (click)="jump.emit(comment)"
        class="h-auto w-full items-start justify-start gap-3 py-2 text-left whitespace-normal"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="sm"
        data-comment-entry
      >
        <span
          class="mt-0.5 min-w-6 shrink-0 rounded-full bg-[var(--et-theme-color-primary-solid)] px-1.5 text-center text-[1.1rem] text-[var(--et-theme-color-on-primary-solid)]"
          >{{ comment.number }}</span
        >
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span [textContent]="comment.text" class="line-clamp-3 text-[1.3rem] whitespace-pre-wrap"></span>
          <span class="flex gap-2 text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]" data-comment-meta>
            <span class="min-w-0 truncate">{{ WHERE_OF(comment) }}</span>
            <span class="shrink-0">{{ SENDER_LABELS[LAST_SENDER_OF(comment)] }}</span>
            @if (comment.addressed; as addressed) {
              <span class="shrink-0 rounded-full border border-surface-border px-1.5" data-comment-addressed>{{
                ADDRESSED_LABEL_OF(addressed)
              }}</span>
            } @else if (IS_ANSWERED(comment)) {
              <span class="shrink-0" data-comment-answered>answered</span>
            }
            @if (comment.replies.length) {
              <span class="shrink-0">{{
                comment.replies.length === 1 ? '1 reply' : comment.replies.length + ' replies'
              }}</span>
            }
            <span class="shrink-0">{{ AGE_OF(comment.createdAt, now()) }}</span>
          </span>
        </span>
      </button>
    </ng-template>
    <div class="min-h-0 overflow-y-auto">
      @if (questions().length) {
        <section class="flex flex-col gap-0.5 p-2" aria-label="Questions for you" data-comment-questions-group>
          <h3 class="m-0 px-2 py-1 text-[1.1rem] font-semibold text-accent">Questions for you</h3>
          @for (comment of questions(); track comment.id) {
            <ng-container *ngTemplateOutlet="entry; context: { $implicit: comment }" />
          }
        </section>
      }
      @for (group of groups(); track group.part) {
        <section [attr.aria-label]="group.part" class="flex flex-col gap-0.5 p-2" data-comment-group>
          <h3
            [class.text-accent]="group.part === selected()"
            class="m-0 px-2 py-1 font-mono text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]"
          >
            {{ group.part }}
          </h3>
          @for (comment of group.comments; track comment.id) {
            <ng-container *ngTemplateOutlet="entry; context: { $implicit: comment }" />
          }
        </section>
      } @empty {
        @if (!questions().length) {
          <p class="m-0 p-4 text-small text-[var(--et-surface-color-subtle-solid)]">No open comments.</p>
        }
      }
      @if (resolvedShown() && resolved().length) {
        <section class="flex flex-col gap-2 p-2 opacity-60" aria-label="Resolved" data-comment-resolved-group>
          <h3 class="m-0 px-2 py-1 text-[1.1rem] font-semibold text-[var(--et-surface-color-subtle-solid)]">
            Resolved
          </h3>
          @for (comment of resolved(); track comment.id) {
            <article class="flex flex-col gap-0.5 px-2 py-1" data-comment-resolved>
              <span [textContent]="comment.text" class="line-clamp-3 text-[1.3rem] whitespace-pre-wrap"></span>
              @for (reply of comment.replies; track $index) {
                <span class="line-clamp-2 text-[1.2rem] whitespace-pre-wrap"
                  ><span class="font-semibold">{{ reply.author ?? SENDER_LABELS[reply.by] }}:</span>
                  {{ reply.text }}</span
                >
              }
              @if (comment.resolved.note ?? comment.addressed?.note; as note) {
                <span
                  [textContent]="note"
                  class="text-[1.2rem] whitespace-pre-wrap italic"
                  data-comment-resolved-note
                ></span>
              }
              <span class="flex gap-2 text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]" data-comment-meta>
                <span class="min-w-0 truncate">{{ WHERE_OF(comment) }}</span>
                <span class="shrink-0" data-comment-resolved-by>{{ RESOLVED_BY_OF(comment) }}</span>
                <time
                  [attr.datetime]="comment.resolved.resolvedAt"
                  [title]="comment.resolved.resolvedAt"
                  class="shrink-0"
                  >{{ AGE_OF(comment.resolved.resolvedAt, now()) }}</time
                >
              </span>
            </article>
          }
        </section>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, NgTemplateOutlet],
  host: {
    class: 'grid min-h-0 w-80 grid-rows-[auto_minmax(0,1fr)] border-l border-surface-border bg-surface',
  },
})
export class CommentPanelComponent {
  public comments = input.required<NumberedComment[]>();
  /** The resolved threads, listed read-only below the open ones while `resolvedShown`. */
  public resolved = input<ResolvedComment[]>([]);
  public resolvedShown = input(false);
  /** The part the canvas shows; its group comes first. */
  public selected = input<string | null>(null);

  public jump = output<NumberedComment>();
  public dismiss = output();
  public resolvedToggle = output<boolean>();

  protected questions = computed(() => this.comments().filter(isQuestion));

  protected groups = computed(() =>
    commentGroupsOf(
      this.comments().filter((comment) => !isQuestion(comment)),
      this.selected(),
    ),
  );

  protected now = computed(() => {
    this.comments();
    this.resolved();

    return Date.now();
  });

  protected readonly WHERE_OF = commentWhereOf;
  protected readonly AGE_OF = ageOf;
  protected readonly LAST_SENDER_OF = lastSenderOf;
  protected readonly IS_ANSWERED = isAnswered;
  protected readonly SENDER_LABELS = SENDER_LABELS;
  protected readonly RESOLVED_BY_OF = resolvedByOf;
  protected readonly ADDRESSED_LABEL_OF = addressedLabelOf;
}
