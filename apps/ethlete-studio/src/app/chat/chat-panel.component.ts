import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import {
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  TEXTAREA_IMPORTS,
  TextareaDirective,
} from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { ChatBlock, parseChatMarkdown } from './chat-markdown';
import { injectChatStore } from './chat-store';
import { chipOf, injectViewContext } from './view-context';

@Component({
  selector: 'ethlete-chat-panel',
  template: `
    @if (store.open()) {
      <aside class="flex h-full w-2xl flex-col gap-3 border-l border-surface-border bg-surface p-3" data-chat-panel>
        <div class="flex items-center justify-between gap-2">
          <span class="text-h4">Chat</span>
          <div class="flex gap-1">
            <button
              [disabled]="store.entries().length === 0"
              (click)="store.newChat()"
              et-button
              type="button"
              variant="transparent"
              color="surface"
              size="xs"
              data-chat-new
            >
              New chat
            </button>
            <button
              (click)="store.toggle()"
              et-button
              type="button"
              variant="transparent"
              color="surface"
              size="xs"
              title="Hide the chat"
              data-chat-toggle
            >
              Hide
            </button>
          </div>
        </div>

        @if (store.clis().length === 0) {
          <p class="m-0 text-small text-text-muted">No agent CLI answered on this machine. {{ store.trouble() }}</p>
        } @else {
          <div class="grid grid-cols-2 gap-2">
            <et-form-field appearance="box">
              <et-label>Agent</et-label>
              <et-select [value]="store.cli()?.id ?? ''" (valueChange)="pickCli($event)" data-chat-cli>
                @for (found of store.clis(); track found.id) {
                  <et-select-option [value]="found.id" [label]="found.label">
                    {{ found.label }} <span class="text-text-muted">{{ found.version }}</span>
                  </et-select-option>
                }
              </et-select>
            </et-form-field>
            <et-form-field appearance="box">
              <et-label>Model</et-label>
              <et-select [value]="store.model()" (valueChange)="store.pickModel(stringOf($event))" data-chat-model>
                <et-select-option value="" label="CLI default">CLI default</et-select-option>
                @for (name of store.cli()?.suggestedModels ?? []; track name) {
                  <et-select-option [value]="name" [label]="name">{{ name }}</et-select-option>
                }
              </et-select>
            </et-form-field>
          </div>
        }

        <ol #list class="m-0 flex min-h-0 grow list-none flex-col gap-2 overflow-auto p-0" data-chat-messages>
          @for (entry of store.entries(); track $index; let index = $index) {
            @switch (entry.kind) {
              @case ('prompt') {
                <li
                  class="flex flex-col gap-1 self-end rounded-md bg-surface-raised px-3 py-2 text-text"
                  data-chat-entry="prompt"
                >
                  @if (entry.context) {
                    <span class="text-small text-text-muted" data-chat-entry-context>{{ entry.context }}</span>
                  }
                  <span class="whitespace-pre-wrap" data-chat-entry-text>{{ entry.text }}</span>
                </li>
              }
              @case ('message') {
                <li class="flex flex-col gap-2" data-chat-entry="message">
                  @for (block of blocks()[index] ?? []; track $index) {
                    @switch (block.kind) {
                      @case ('code') {
                        <pre
                          [attr.data-language]="block.language || null"
                          class="m-0 overflow-x-auto rounded-md bg-surface-raised p-2 font-mono text-mono text-text"
                          data-chat-code-block
                        ><code>{{ block.text }}</code></pre>
                      }
                      @case ('list') {
                        @if (block.ordered) {
                          <ol [attr.start]="block.start" class="m-0 flex list-decimal flex-col gap-1 pl-5">
                            @for (item of block.items; track $index) {
                              <li class="whitespace-pre-wrap">
                                <ng-container
                                  [ngTemplateOutlet]="inlines"
                                  [ngTemplateOutletContext]="{ $implicit: item }"
                                />
                              </li>
                            }
                          </ol>
                        } @else {
                          <ul class="m-0 flex list-disc flex-col gap-1 pl-5">
                            @for (item of block.items; track $index) {
                              <li class="whitespace-pre-wrap">
                                <ng-container
                                  [ngTemplateOutlet]="inlines"
                                  [ngTemplateOutletContext]="{ $implicit: item }"
                                />
                              </li>
                            }
                          </ul>
                        }
                      }
                      @case ('paragraph') {
                        <p class="m-0 whitespace-pre-wrap">
                          <ng-container
                            [ngTemplateOutlet]="inlines"
                            [ngTemplateOutletContext]="{ $implicit: block.inlines }"
                          />
                        </p>
                      }
                    }
                  }
                </li>
              }
              @case ('action') {
                <li class="font-mono text-mono break-words text-text-muted" data-chat-entry="action">
                  {{ entry.action }} {{ entry.detail }}
                </li>
              }
              @case ('failed') {
                <li
                  [etProvideColor]="errorTheme()"
                  class="text-small text-(--et-theme-color-primary-solid)"
                  data-chat-entry="failed"
                >
                  {{ entry.message }}
                </li>
              }
              @case ('finished') {
                <li class="text-small text-text-muted" data-chat-entry="finished">
                  {{ entry.ok ? 'Finished' : 'Stopped' }} {{ entry.summary }}
                </li>
              }
            }
          }
        </ol>

        <ng-template #inlines let-items>
          @for (part of items; track $index) {
            @switch (part.kind) {
              @case ('code') {
                <code class="rounded-sm bg-surface-raised px-1 font-mono text-mono">{{ part.text }}</code>
              }
              @case ('bold') {
                <strong>{{ part.text }}</strong>
              }
              @default {
                {{ part.text }}
              }
            }
          }
        </ng-template>

        @if (chip(); as chip) {
          <div
            class="flex items-center gap-1 self-start rounded-md bg-surface-raised py-0.5 pl-2 text-small text-text-muted"
            data-chat-context
          >
            <span class="truncate" title="Sent with the next message">{{ chip }}</span>
            <button
              (click)="viewContext.remove()"
              et-button
              type="button"
              variant="transparent"
              color="surface"
              size="xs"
              aria-label="Remove the view context"
              data-chat-context-remove
            >
              ×
            </button>
          </div>
        }
        <et-form-field appearance="box">
          <et-textarea
            [(value)]="prompt"
            (keydown)="handleKey($event)"
            aria-label="Message"
            placeholder="Enter sends, Shift+Enter breaks the line"
            rows="3"
            data-chat-prompt
          />
        </et-form-field>
        <div class="flex justify-end gap-2">
          @if (store.running()) {
            <button
              (click)="store.stop()"
              et-button
              type="button"
              variant="outline"
              color="surface"
              size="sm"
              data-chat-stop
            >
              Stop
            </button>
          }
          <button
            [disabled]="!canSend()"
            (click)="send()"
            et-button
            type="button"
            variant="filled"
            size="sm"
            data-chat-send
          >
            Send
          </button>
        </div>
      </aside>
    } @else {
      <div class="flex h-full flex-col border-l border-surface-border bg-surface p-1">
        <button
          (click)="store.toggle()"
          et-button
          type="button"
          variant="transparent"
          color="surface"
          size="xs"
          title="Show the chat"
          data-chat-toggle
        >
          Chat
        </button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    BUTTON_IMPORTS,
    FORM_FIELD_IMPORTS,
    SELECT_IMPORTS,
    TEXTAREA_IMPORTS,
    ProvideColorDirective,
  ],
  host: { class: 'flex min-h-0 shrink-0' },
})
export class ChatPanelComponent {
  protected store = injectChatStore();
  protected viewContext = injectViewContext();
  protected errorTheme = injectSemanticColorTheme('error');
  public list = viewChild<ElementRef<HTMLElement>>('list');
  private promptField = viewChild(TextareaDirective);
  protected chip = computed(() => {
    const context = this.viewContext.shown();

    return context ? chipOf(context) : null;
  });
  protected prompt = signal('');
  protected blocks = computed<ChatBlock[][]>(() =>
    this.store.entries().map((entry) => (entry.kind === 'message' ? parseChatMarkdown(entry.text) : [])),
  );

  constructor() {
    afterRenderEffect(() => {
      const list = this.list()?.nativeElement;

      if (list && this.store.entries().length) list.scrollTop = list.scrollHeight;
    });
  }

  protected canSend() {
    return !this.store.running() && !!this.store.cli() && this.prompt().trim() !== '';
  }

  protected stringOf(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  protected pickCli(id: unknown) {
    const found = this.store.clis().find((cli) => cli.id === id);

    if (found) this.store.pick(found);
  }

  protected handleKey(event: KeyboardEvent) {
    if (event.isComposing || event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    this.send();
  }

  protected send() {
    if (!this.store.send(this.prompt())) return;

    // A value typed or pasted into the empty field without a change detection in between leaves the
    // two-way binding's last bound value at '', so resetting `prompt` alone never reaches the field.
    this.prompt.set('');
    this.promptField()?.value.set('');
  }
}
