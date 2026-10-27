import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { NumberedComment, ageOf, commentGroupsOf, commentWhereOf } from './comment-pins';

@Component({
  selector: 'ethlete-comment-panel',
  template: `
    <header class="flex items-center gap-2 border-b border-[var(--et-surface-border-solid)] px-4 py-3">
      <h2 class="m-0 flex-1 text-[1.4rem] font-semibold">Comments</h2>
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
    <div class="min-h-0 overflow-y-auto">
      @for (group of groups(); track group.part) {
        <section [attr.aria-label]="group.part" class="flex flex-col gap-0.5 p-2" data-comment-group>
          <h3
            [class.text-[var(--et-theme-color-primary-solid)]]="group.part === selected()"
            class="m-0 px-2 py-1 font-mono text-[1.1rem] text-[var(--et-surface-color-subtle-solid)]"
          >
            {{ group.part }}
          </h3>
          @for (comment of group.comments; track comment.id) {
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
                  <span class="shrink-0">{{ AGE_OF(comment.createdAt, now()) }}</span>
                </span>
              </span>
            </button>
          }
        </section>
      } @empty {
        <p class="m-0 p-4 text-small text-[var(--et-surface-color-subtle-solid)]">No open comments.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
  host: {
    class:
      'grid min-h-0 w-80 grid-rows-[auto_minmax(0,1fr)] border-l border-[var(--et-surface-border-solid)] bg-[var(--et-surface-background-solid)]',
  },
})
export class CommentPanelComponent {
  public comments = input.required<NumberedComment[]>();
  /** The part the canvas shows; its group comes first. */
  public selected = input<string | null>(null);

  public jump = output<NumberedComment>();
  public dismiss = output();

  protected groups = computed(() => commentGroupsOf(this.comments(), this.selected()));

  protected now = computed(() => {
    this.comments();

    return Date.now();
  });

  protected readonly WHERE_OF = commentWhereOf;
  protected readonly AGE_OF = ageOf;
}
