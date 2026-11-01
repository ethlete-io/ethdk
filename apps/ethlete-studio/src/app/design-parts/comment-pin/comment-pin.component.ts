import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, ViewEncapsulation } from '@angular/core';
import { AutoSurfaceDirective, SurfaceInteractiveDirective } from '@ethlete/core';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { AgentLogoName } from '../../icons/agent-logos';

export type CommentPinAgent = AgentLogoName;

const SHAPE = 'rounded-[50%_50%_50%_0]';

const PIN_BASE = `group/pin relative inline-flex size-5.5 cursor-pointer items-center justify-center ${SHAPE} border-0 p-0 font-ui-strong text-ui-xs leading-none focus-visible:outline-2 focus-visible:outline-focus-ring`;

const PIN_REST = `${PIN_BASE} bg-et-surface-bg text-text-muted ring-1 ring-et-surface-border hover:text-text hover:ring-text-muted focus-visible:outline-offset-2 active:text-text`;

const SELECTED_RINGS =
  'shadow-[0_0_0_4px_rgb(var(--et-theme-color-primary-rgb)/0.2)] ring-2 text-et-on-theme focus-visible:outline-offset-[5px]';

const PIN_SELECTED_AGENT = `${PIN_BASE} bg-et-surface-bg ring-et-theme ${SELECTED_RINGS}`;

const PIN_SELECTED = `${PIN_BASE} bg-et-theme ring-et-surface-bg ${SELECTED_RINGS} hover:bg-et-theme-hover active:bg-et-theme-active`;

const PIN_RESOLVED_BASE = `${PIN_BASE} bg-et-surface-bg text-text-muted hover:text-text active:text-text`;

const PIN_RESOLVED = `${PIN_RESOLVED_BASE} ring-1 ring-et-surface-border hover:ring-text-muted focus-visible:outline-offset-2`;

const PIN_RESOLVED_SELECTED = `${PIN_RESOLVED_BASE} ring-2 ring-text-muted focus-visible:outline-offset-[5px]`;

const FACE = `flex size-full items-center justify-center ${SHAPE}`;

const FACE_INTERACTIVE = `${FACE} group-hover/pin:bg-et-surface-interaction/9 group-active/pin:bg-et-surface-interaction/15`;

@Component({
  selector: 'ethlete-comment-pin',
  templateUrl: './comment-pin.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, AutoSurfaceDirective, SurfaceInteractiveDirective, AgentLogoComponent],
  host: { class: 'inline-flex p-space-2 font-ui' },
})
export class CommentPinComponent {
  public author = input('');
  public initials = input('');
  public agent = input<CommentPinAgent | undefined>(undefined);
  public count = input(1);
  public selected = input(false);
  public resolved = input(false);

  public pinToggle = output();

  protected label = computed(
    () =>
      `Comment by ${this.author()}${this.count() > 1 ? `, ${this.count()} messages` : ''}${this.resolved() ? ', resolved' : ''}`,
  );

  protected filled = computed(() => this.selected() && !this.agent() && !this.resolved());

  protected pinClass = computed(() => {
    if (this.resolved()) return this.selected() ? PIN_RESOLVED_SELECTED : PIN_RESOLVED;
    if (!this.selected()) return PIN_REST;

    return this.agent() ? PIN_SELECTED_AGENT : PIN_SELECTED;
  });

  protected faceClass = computed(() => (this.filled() ? FACE : FACE_INTERACTIVE));
}
