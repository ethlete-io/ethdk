import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { InboxComment } from '../inbox/inbox-sample';

@Component({
  selector: 'ethlete-comment-row',
  templateUrl: './comment-row.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [TOOLTIP_IMPORTS, AutoSurfaceDirective, AgentLogoComponent],
  host: { class: 'block' },
})
export class CommentRowComponent {
  public comment = input.required<InboxComment>();
  public selected = input(false);

  public pick = output();

  protected readonly LABELS = STUDIO_LABELS.commentList;
}
