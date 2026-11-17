import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, SurfaceInteractiveDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { InboxComment } from '../inbox/inbox-sample';

const SELECTED_CLASS =
  'bg-et-theme/20 hover:[background:linear-gradient(rgb(var(--et-theme-color-primary-rgb)/0.2),rgb(var(--et-theme-color-primary-rgb)/0.2)),color-mix(in_srgb,var(--et-surface-interaction-solid)_9%,transparent)] active:[background:linear-gradient(rgb(var(--et-theme-color-primary-rgb)/0.2),rgb(var(--et-theme-color-primary-rgb)/0.2)),color-mix(in_srgb,var(--et-surface-interaction-solid)_15%,transparent)]';

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

  protected readonly LABELS = STUDIO_LABELS.commentList;
  protected readonly SELECTED_CLASS = SELECTED_CLASS;
}
