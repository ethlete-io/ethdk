import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, TemplateRef, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, SWITCH_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { CanvasFramesComponent } from '../canvas-frames/canvas-frames.component';
import { FRAME_CLASS, FRAME_HEAD_CLASS } from '../system-page/system-page.component';
import { INBOX_SAMPLE, INBOX_SAMPLE_PART, InboxComment } from './inbox-sample';
import { CommentThread, ThreadCardComponent } from '../comment-flow/thread-card.component';
import { CommentRowComponent } from '../comment-flow/comment-row.component';

export type InboxOpenOn = 'all' | 'active' | 'others' | 'none';

export type InboxLoad = 'loaded' | 'loading' | 'error';

@Component({
  selector: 'ethlete-inbox',
  templateUrl: './inbox.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    SWITCH_IMPORTS,
    TOOLTIP_IMPORTS,
    ProvideColorDirective,
    NgTemplateOutlet,
    ShellPageComponent,
    CanvasFramesComponent,
    CommentRowComponent,
    ThreadCardComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class InboxComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public comments = input<InboxComment[]>(INBOX_SAMPLE);
  public activePart = input(INBOX_SAMPLE_PART);
  public selectedId = input<string | null>('c1');
  public showResolved = model(false);
  public openOn = input<InboxOpenOn>('all');
  public load = input<InboxLoad>('loaded');
  public canvas = input<TemplateRef<unknown> | null>(null);
  public thread = input<CommentThread | null>(null);
  public replyText = model('');
  public shellAction = output<ShellAction>();

  public pick = output<string>();
  public retry = output();
  public replyComment = output<string>();
  public resolveThread = output();
  public withdrawComment = output<number>();
  public closeThread = output();
  protected readonly LABELS = STUDIO_LABELS.inbox;

  protected readonly FRAME_CLASS = FRAME_CLASS;
  protected readonly FRAME_HEAD_CLASS = FRAME_HEAD_CLASS;

  public inScope = computed(() => {
    const openOn = this.openOn();
    const active = this.activePart();

    return this.comments().filter(
      (c) =>
        c.resolved ||
        openOn === 'all' ||
        (openOn === 'active' && c.part === active) ||
        (openOn === 'others' && c.part !== active),
    );
  });
  protected visible = computed(() => this.inScope().filter((c) => this.showResolved() || !c.resolved));
  protected openCount = computed(() => this.inScope().filter((c) => !c.resolved).length);
  protected onActivePart = computed(() => this.visible().filter((c) => c.part === this.activePart()));
  protected onOtherParts = computed(() => this.visible().filter((c) => c.part !== this.activePart()));
}
