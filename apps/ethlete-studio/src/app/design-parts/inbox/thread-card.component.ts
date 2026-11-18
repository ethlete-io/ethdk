import {
  afterNextRender,
  Component,
  computed,
  input,
  model,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  KBD_IMPORTS,
  TEXTAREA_IMPORTS,
  TextareaComponent,
} from '@ethlete/components';
import { AutoSurfaceDirective, injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { AgentLogoComponent } from '../../icons/agent-logo.component';
import { CommentSendPhase } from '../system-page/comment-draft.component';
import { InboxMessage } from './inbox-sample';

@Component({
  selector: 'ethlete-thread-card',
  template: `
    <div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2">
      <span
        class="min-w-0 flex-1 overflow-hidden font-code text-ellipsis whitespace-nowrap text-ui-xs text-et-surface-muted"
        >{{ place() }}</span
      >
      <button (click)="resolveThread.emit()" et-button type="button" variant="outline" color="surface" size="xs">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          etIcon
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
        {{ LABELS.resolve }}
      </button>
      <button
        [attr.aria-label]="LABELS.close"
        (click)="dismiss.emit()"
        et-button
        type="button"
        variant="transparent"
        color="surface"
        size="xs"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
          aria-hidden="true"
          etIcon
        >
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </div>
    <ol class="m-0 flex max-h-96 list-none flex-col gap-space-3 overflow-auto p-space-3">
      @for (message of messages(); track $index) {
        <li class="flex gap-space-2">
          <span
            class="flex size-5 flex-none items-center justify-center rounded-full bg-et-surface-bg font-ui-strong text-(length:--text-xs) text-et-surface"
            etAutoSurface
          >
            @if (message.agent; as agent) {
              <svg [agent]="agent" class="size-3" ethlete-agent-logo></svg>
            } @else {
              {{ message.initials }}
            }
          </span>
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
              <span class="font-ui-medium text-et-surface">{{ message.author }}</span>
              <span class="flex-1 text-et-surface-muted">{{ message.when }}</span>
            </div>
            <p class="m-0 text-ui-sm text-et-surface">{{ message.text }}</p>
            @if (message.own) {
              <div class="-ml-space-2 flex">
                <button
                  (click)="withdrawComment.emit($index)"
                  et-button
                  type="button"
                  variant="transparent"
                  color="surface"
                  size="xs"
                >
                  {{ LABELS.withdraw }}
                </button>
              </div>
            }
          </div>
        </li>
      }
    </ol>
    <div class="flex flex-col gap-space-2 border-t border-et-surface-border p-space-3">
      <et-form-field>
        <et-textarea
          [(value)]="text"
          [disabled]="busy()"
          [aria-label]="LABELS.reply"
          [placeholder]="LABELS.placeholder"
          (keydown.enter)="sendOnEnter($event)"
          rows="2"
        />
      </et-form-field>
      @if (phase() === 'error' || phase() === 'rejected') {
        <p
          [etProvideColor]="errorTheme()"
          class="m-0 flex items-center gap-space-1 text-ui-xs text-et-theme-ink"
          role="alert"
        >
          <svg
            class="flex-none text-et-theme"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="5.5" />
            <path d="m6 6 4 4m0-4-4 4" />
          </svg>
          <span>{{ phase() === 'rejected' ? reason() : SEND_LABELS.notSent }}</span>
        </p>
      }
      <div class="flex items-center justify-between gap-space-2">
        <span class="flex items-center gap-space-1 text-ui-xs text-et-surface-muted"
          ><et-kbd keys="esc" /> {{ LABELS.escCloses }}</span
        >
        <button
          [disabled]="!text()"
          [loading]="busy()"
          (click)="submit()"
          et-button
          type="button"
          variant="filled"
          size="xs"
        >
          {{ phase() === 'error' ? SEND_LABELS.sendAgain : LABELS.send }}
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    KBD_IMPORTS,
    TEXTAREA_IMPORTS,
    ProvideColorDirective,
    AutoSurfaceDirective,
    AgentLogoComponent,
  ],
  hostDirectives: [AutoSurfaceDirective],
  host: {
    role: 'dialog',
    '[attr.aria-label]': 'LABELS.dialog',
    '(keydown.escape)': 'escape($event)',
    class:
      'relative z-20 flex w-80 flex-col rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) shadow-lg',
  },
})
export class ThreadCardComponent {
  protected errorTheme = injectSemanticColorTheme('error');

  public place = input('');
  public messages = input<InboxMessage[]>([]);
  public text = model('');
  public phase = input<CommentSendPhase | null>(null);
  public reason = input('');

  public replyComment = output<string>();
  public resolveThread = output();
  public withdrawComment = output<number>();
  public dismiss = output();

  private field = viewChild(TextareaComponent);

  protected readonly LABELS = STUDIO_LABELS.commentThread;
  protected readonly SEND_LABELS = STUDIO_LABELS.commentDraft;

  protected busy = computed(() => this.phase() === 'busy');

  constructor() {
    afterNextRender(() => {
      if (!this.busy()) this.field()?.focus();
    });
  }

  protected submit() {
    if (this.busy() || !this.text().trim()) return;

    this.replyComment.emit(this.text());
  }

  protected sendOnEnter(event: Event) {
    const key = event as KeyboardEvent;

    if (key.shiftKey || key.isComposing) return;

    event.preventDefault();
    this.submit();
  }

  protected escape(event: Event) {
    event.stopPropagation();
    this.dismiss.emit();
  }
}
