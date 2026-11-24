import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BADGE_IMPORTS, BUTTON_IMPORTS } from '@ethlete/components';
import { SYSTEM_LABELS } from '../../i18n/system-labels';
import { EXCEPTIONS_LABELS } from '../../i18n/shell-labels';
import { BuildBlocker, BuildReadyFooterComponent, BuildReadyStatus } from './build-ready-footer.component';
import { OpenPointGroup, OpenPointTarget, PartException } from './system-page-sample';

const SHOWN_LINES = 3;

@Component({
  selector: 'ethlete-open-points-popover',
  template: `
    <div class="w-96 font-ui text-ui-sm">
      <header
        class="flex items-baseline gap-space-2 border-b border-(--et-surface-border-solid) px-space-3 pt-space-3 pb-space-2"
      >
        <span class="font-ui-strong text-(--et-surface-color-solid)">
          {{
            groups().length
              ? LABELS.openPoints
              : missingShots()
                ? LABELS.shotsMissing(missingShots())
                : LABELS.nothingOpen
          }}
        </span>
        <span class="ms-auto font-code text-ui-xs text-(--et-surface-color-muted-solid)">{{ part() }}</span>
      </header>
      @if (shown().length) {
        <ul [class.divide-y]="dividers()" class="m-0 list-none divide-(--et-surface-border-solid) p-0 py-space-1">
          @for (group of shown(); track group.icon) {
            <li>
              <ul [class.py-space-1]="dividers()" class="m-0 list-none p-0">
                @for (line of group.lines; track $index) {
                  <li>
                    @if (line.target; as target) {
                      <button
                        (click)="openPoint.emit(target)"
                        class="flex w-full cursor-pointer items-center gap-space-2 border-0 bg-transparent px-space-3 py-space-1 text-start [font:inherit] outline-none [transition:var(--transition-state)] hover:bg-et-surface-interaction/9 focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus-ring)] active:bg-et-surface-interaction/15"
                        type="button"
                        data-open-point-target
                      >
                        <ng-container
                          *ngTemplateOutlet="lineTemplate; context: { $implicit: line, icon: group.icon }"
                        />
                      </button>
                    } @else {
                      <div class="flex items-center gap-space-2 px-space-3 py-space-1">
                        <ng-container
                          *ngTemplateOutlet="lineTemplate; context: { $implicit: line, icon: group.icon }"
                        />
                      </div>
                    }
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
          <ul class="m-0 list-none p-0 divide-y divide-(--et-surface-border-solid)">
            @for (exception of exceptions(); track exception.rule) {
              <li class="flex flex-col gap-space-1 px-space-3 py-space-2">
                <span class="flex items-center gap-space-2">
                  <span class="min-w-0 flex-1 font-code text-ui-xs break-all text-et-surface">{{
                    exception.rule
                  }}</span>
                  <et-badge [variant]="exception.reopened ? 'tonal' : 'outline'" size="sm">
                    {{ exception.reopened ? EXCEPTION_LABELS.reopened : EXCEPTION_LABELS.pending }}
                  </et-badge>
                </span>
                <span class="flex items-center gap-space-2">
                  <span class="min-w-0 flex-1 text-et-surface-muted">{{ exception.reason }}</span>
                  <button
                    (click)="approveException.emit(exception.rule)"
                    et-button
                    type="button"
                    variant="outline"
                    size="xs"
                  >
                    {{ EXCEPTION_LABELS.approve }}
                  </button>
                </span>
              </li>
            }
          </ul>
        </section>
      }
      @if (buildReady(); as status) {
        <ethlete-build-ready-footer
          [(blockersOpen)]="blockersOpen"
          [status]="status"
          (openEditSketch)="openEditSketch.emit($event)"
        />
      }
    </div>
    <ng-template #lineTemplate let-line let-icon="icon">
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
        @switch (icon) {
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
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, BUTTON_IMPORTS, BuildReadyFooterComponent, NgTemplateOutlet],
})
export class OpenPointsPopoverComponent {
  public part = input.required<string>();
  public groups = input.required<OpenPointGroup[]>();
  public exceptions = input<PartException[]>([]);
  public missingShots = input(0);
  public dividers = input(true);
  public buildReady = input<BuildReadyStatus | null>(null);
  public blockersOpen = model(false);
  public openEditSketch = output<BuildBlocker>();
  public approveException = output<string>();
  public openPoint = output<OpenPointTarget>();

  protected readonly LABELS = SYSTEM_LABELS;
  protected readonly EXCEPTION_LABELS = EXCEPTIONS_LABELS;

  protected shown = computed(() =>
    this.groups().map(({ icon, lines }) => ({
      icon,
      lines: lines.slice(0, SHOWN_LINES),
      more: Math.max(0, lines.length - SHOWN_LINES),
    })),
  );
}
