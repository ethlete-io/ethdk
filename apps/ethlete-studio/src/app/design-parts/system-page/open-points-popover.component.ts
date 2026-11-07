import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import {
  AgentProgress,
  BuildBlocker,
  BuildReadyFooterComponent,
  BuildReadyStatus,
} from './build-ready-footer.component';
import { OpenPointGroup, PartException } from './system-page-sample';

const SHOWN_LINES = 3;

@Component({
  selector: 'ethlete-open-points-popover',
  template: `
    <div class="w-96 font-ui text-ui-sm">
      <header
        class="flex items-baseline gap-space-2 border-b border-(--et-surface-border-solid) px-space-3 pt-space-3 pb-space-2"
      >
        <span class="font-ui-strong text-(--et-surface-color-solid)">
          {{ groups().length ? LABELS.openPoints : LABELS.nothingOpen }}
        </span>
        <span class="ms-auto font-code text-ui-xs text-(--et-surface-color-muted-solid)">{{ part() }}</span>
      </header>
      @if (shown().length) {
        <ul class="m-0 list-none divide-y divide-(--et-surface-border-solid) p-0 py-space-1">
          @for (group of shown(); track group.icon) {
            <li>
              <ul class="m-0 list-none p-0 py-space-1">
                @for (line of group.lines; track $index) {
                  <li class="flex items-center gap-space-2 px-space-3 py-space-1">
                    <svg
                      class="flex-none text-(--et-surface-color-muted-solid)"
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
                      @switch (group.icon) {
                        @case ('grid') {
                          <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
                          <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
                          <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
                          <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
                        }
                        @case ('warning') {
                          <path d="M8 2.5 14 13H2z" />
                          <path d="M8 6.5v3" />
                          <path d="M8 11.25v.01" />
                        }
                        @case ('comment') {
                          <path d="M3 4.5h10v6H7.5L5 12.5v-2H3z" />
                        }
                        @case ('error') {
                          <circle cx="8" cy="8" r="5.5" />
                          <path d="m6 6 4 4m0-4-4 4" />
                        }
                        @case ('flow') {
                          <circle cx="4" cy="4" r="1.75" />
                          <circle cx="12" cy="12" r="1.75" />
                          <path d="M5.75 4H9.5a2.5 2.5 0 0 1 2.5 2.5v3.75" />
                        }
                      }
                    </svg>
                    <span class="min-w-0 flex-1 truncate text-(--et-surface-color-solid)">{{ line.text }}</span>
                    <span class="font-code text-ui-xs text-(--et-surface-color-muted-solid)">{{ line.detail }}</span>
                  </li>
                }
                @if (group.more > 0) {
                  <li class="py-space-1 ps-9 pe-space-3 text-(--et-surface-color-muted-solid)">
                    {{ LABELS.more(group.more) }}
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      } @else {
        <div class="flex items-center gap-space-2 px-space-3 py-space-4">
          <svg
            class="flex-none text-et-theme-ink"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m3.5 8.5 3 3 6-7" />
          </svg>
          <span class="text-(--et-surface-color-muted-solid)">{{ LABELS.allDone }}</span>
        </div>
      }
      @if (exceptions().length) {
        <section class="border-t border-(--et-surface-border-solid) py-space-1">
          <h3
            class="m-0 flex items-center gap-space-2 px-space-3 py-space-1 text-ui-xs font-ui-strong text-et-surface-muted"
          >
            {{ EXCEPTION_LABELS.toggle }}<span class="font-code font-normal">{{ exceptions().length }}</span>
          </h3>
          <ul class="m-0 list-none p-0">
            @for (exception of exceptions(); track exception.rule) {
              <li class="flex items-start gap-space-3 px-space-3 py-space-2">
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="font-code text-ui-xs break-all text-et-surface">{{ exception.rule }}</span>
                  <span class="text-et-surface-muted">{{ exception.reason }}</span>
                  <span class="text-ui-xs text-et-surface-muted">
                    {{ exception.reopened ? EXCEPTION_LABELS.reopened : EXCEPTION_LABELS.pending }}
                  </span>
                </span>
                <button
                  (click)="approveException.emit(exception.rule)"
                  et-button
                  type="button"
                  variant="filled"
                  size="xs"
                >
                  {{ EXCEPTION_LABELS.approve }}
                </button>
              </li>
            }
          </ul>
        </section>
      }
      @if (buildReady(); as status) {
        <ethlete-build-ready-footer
          [(blockersOpen)]="blockersOpen"
          [status]="status"
          [agent]="agent()"
          (openEditSketch)="openEditSketch.emit($event)"
        />
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, BuildReadyFooterComponent],
})
export class OpenPointsPopoverComponent {
  public part = input.required<string>();
  public groups = input.required<OpenPointGroup[]>();
  public exceptions = input<PartException[]>([]);
  public buildReady = input<BuildReadyStatus | null>(null);
  public agent = input<AgentProgress | null>(null);
  public blockersOpen = model(false);
  public openEditSketch = output<BuildBlocker>();
  public approveException = output<string>();

  protected readonly LABELS = STUDIO_LABELS.system;
  protected readonly EXCEPTION_LABELS = STUDIO_LABELS.exceptions;

  protected shown = computed(() =>
    this.groups().map(({ icon, lines }) => ({
      icon,
      lines: lines.slice(0, SHOWN_LINES),
      more: Math.max(0, lines.length - SHOWN_LINES),
    })),
  );
}
