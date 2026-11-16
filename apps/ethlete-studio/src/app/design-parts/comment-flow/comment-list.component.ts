import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { InboxComment } from '../inbox/inbox-sample';
import { CommentRowComponent } from './comment-row.component';

@Component({
  selector: 'ethlete-comment-list',
  template: `
    <section [attr.aria-label]="LABELS.title" class="flex flex-col gap-space-1">
      <div class="flex items-center gap-space-2 px-space-2 py-space-1">
        <span class="text-ui-sm font-ui-strong text-et-surface">{{ LABELS.title }}</span>
        <span class="text-ui-xs text-et-surface-muted">{{ LABELS.open(comments().length) }}</span>
      </div>
      @for (comment of comments(); track comment.id) {
        <ethlete-comment-row
          [comment]="comment"
          [selected]="comment.id === selectedId()"
          (pick)="pick.emit(comment.id)"
        />
      }
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CommentRowComponent],
  host: { class: 'mx-space-2 mt-space-3 block border-t border-et-surface-border pt-space-2', 'data-comment-list': '' },
})
export class CommentListComponent {
  public comments = input<InboxComment[]>([]);
  public selectedId = input<string | null>(null);

  public pick = output<string>();

  protected readonly LABELS = STUDIO_LABELS.commentList;
}
