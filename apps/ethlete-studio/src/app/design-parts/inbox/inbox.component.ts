import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, TemplateRef, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, SWITCH_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { CanvasFramesComponent } from '../canvas-frames/canvas-frames.component';
import { CommentDraftComponent } from '../system-page/comment-draft.component';
import { FRAME_CLASS, FRAME_HEAD_CLASS } from '../system-page/system-page.component';
import { INBOX_SAMPLE, InboxComment } from './inbox-sample';

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
    AutoSurfaceDirective,
    ProvideColorDirective,
    NgTemplateOutlet,
    ShellPageComponent,
    CanvasFramesComponent,
    AgentLogoComponent,
    CommentDraftComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class InboxComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public comments = input<InboxComment[]>(INBOX_SAMPLE);
  public activePart = input('button');
  public selectedId = input<string | null>('c1');
  public showResolved = model(false);
  public openOn = input<InboxOpenOn>('all');
  public draft = input(false);
  public draftText = input<string>();
  public entry = input(false);
  public load = input<InboxLoad>('loaded');
  public canvas = input<TemplateRef<unknown> | null>(null);

  public shellAction = output<ShellAction>();
  public send = output<string>();
  public draftTextChange = output<string>();
  public discard = output();
  public pick = output<string>();
  public retry = output();

  protected readonly LABELS = STUDIO_LABELS.commentDraft;
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
  protected shownDraftText = computed(() => this.draftText() ?? '');
  protected editorOpen = computed(() => this.draft() || this.entry());
}
