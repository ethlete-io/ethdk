import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, SurfaceInteractiveDirective } from '@ethlete/core';
import { COMMENT_LIST_LABELS } from '../../i18n/comments-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { InboxComment } from '../inbox/inbox-sample';

const SELECTED_CLASS =
  'bg-et-tone-fill/20 hover:[background:linear-gradient(color-mix(in srgb, var(--et-tone-fill) 20%, transparent),color-mix(in srgb, var(--et-tone-fill) 20%, transparent)),color-mix(in_srgb,var(--et-surface-interaction)_9%,transparent)] active:[background:linear-gradient(color-mix(in srgb, var(--et-tone-fill) 20%, transparent),color-mix(in srgb, var(--et-tone-fill) 20%, transparent)),color-mix(in_srgb,var(--et-surface-interaction)_15%,transparent)]';

@Component({
  selector: 'ethlete-comment-row',
  templateUrl: './comment-row.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [TOOLTIP_IMPORTS, AutoSurfaceDirective, SurfaceInteractiveDirective, AgentLogoComponent],
  host: { class: 'block' },
})
export class CommentRowComponent {
  public thread = input.required<InboxComment>();
  public selected = input(false);

  public pick = output();

  protected readonly LABELS = COMMENT_LIST_LABELS;
  protected readonly SELECTED_CLASS = SELECTED_CLASS;
}
