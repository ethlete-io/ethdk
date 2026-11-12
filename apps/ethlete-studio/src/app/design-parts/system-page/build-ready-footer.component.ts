import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import {
  BADGE_IMPORTS,
  BUTTON_IMPORTS,
  CHECK_ICON,
  ICON_IMPORTS,
  provideIcons,
  TOOLTIP_IMPORTS,
} from '@ethlete/components';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { DisclosureComponent } from '../disclosure/disclosure.component';

export type BuildBlockerKind = keyof typeof STUDIO_LABELS.buildReady.groups;

export type BuildBlocker = { kind: BuildBlockerKind; text: string; part?: string };

export type BuildReadyStatus =
  { state: 'ready' } | { state: 'blocked'; blockers: BuildBlocker[] } | { state: 'checking' };

export type AgentProgress =
  { state: 'working'; doing: string; detail: string } | { state: 'waiting' | 'interrupted' | 'failed'; detail: string };

type BlockerIcon = 'pencil' | 'warning' | 'grid' | 'error' | 'flow' | 'up-down';

const GROUPS: { kind: BuildBlockerKind; icon: BlockerIcon }[] = [
  { kind: 'direct-edit', icon: 'pencil' },
  { kind: 'open-point', icon: 'warning' },
  { kind: 'embedded', icon: 'grid' },
  { kind: 'problem', icon: 'error' },
  { kind: 'compare', icon: 'flow' },
  { kind: 'sdk-error', icon: 'error' },
  { kind: 'stale-record', icon: 'up-down' },
];

@Component({
  selector: 'ethlete-build-ready-footer',
  template: `
    @let current = status();
    <footer class="border-t border-(--et-surface-border-solid) px-space-3 py-space-2">
      <div class="flex items-center gap-space-2">
        @switch (current.state) {
          @case ('ready') {
            <span class="flex">
              <div class="flex flex-wrap items-center">
                <et-badge variant="tonal" size="sm"><i etIcon="et-check"></i>{{ LABELS.ready }}</et-badge>
              </div>
            </span>
          }
          @case ('checking') {
            <span class="flex">
              <div class="flex flex-wrap items-center">
                <et-badge variant="outline" size="sm">{{ LABELS.checking }}</et-badge>
              </div>
            </span>
          }
          @case ('blocked') {
            <span [etProvideColor]="warningTheme()" class="flex">
              <div class="flex flex-wrap items-center">
                <et-badge variant="tonal" size="sm">{{ LABELS.blocked(blockerCount()) }}</et-badge>
              </div>
            </span>
          }
        }
        @if (agent(); as progress) {
          @if (progress.state === 'failed') {
            <span [etProvideColor]="errorTheme()" [etTooltip]="progress.detail" class="flex">
              <div class="flex flex-wrap items-center">
                <et-badge variant="tonal" size="sm">{{ LABELS.agent.failed }}</et-badge>
              </div>
            </span>
          } @else {
            <span [etTooltip]="progress.detail" class="flex">
              <div class="flex flex-wrap items-center">
                <et-badge variant="outline" size="sm">
                  {{
                    progress.state === 'working' ? LABELS.agent.working(progress.doing) : LABELS.agent[progress.state]
                  }}
                </et-badge>
              </div>
            </span>
          }
        }
        <span class="ms-auto"></span>
        @if (current.state === 'blocked' && !blockersOpen()) {
          <ng-container *ngTemplateOutlet="reasons" />
        }
      </div>
      @if (current.state === 'blocked' && blockersOpen()) {
        <div class="-mx-space-2 mt-space-1">
          <ng-container *ngTemplateOutlet="reasons" />
        </div>
      }
    </footer>

    <ng-template #reasons>
      <ethlete-disclosure [(open)]="blockersOpen" [label]="LABELS.reasons" class="text-ui-sm">
        <ul class="m-0 list-none p-0 pb-space-1">
          @for (group of groups(); track group.kind) {
            <li>
              <h3 class="m-0 px-space-2 pt-space-1 text-ui-xs font-ui-strong text-et-surface-muted">
                {{ LABELS.groups[group.kind] }}
              </h3>
              <ul class="m-0 list-none p-0">
                @for (blocker of group.blockers; track $index) {
                  <li class="flex items-center gap-space-2 px-space-2 py-space-1">
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
                        @case ('pencil') {
                          <path d="M10.5 3 13 5.5 6 12.5H3.5V10z" />
                          <path d="m9 4.5 2.5 2.5" />
                        }
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
                        @case ('error') {
                          <circle cx="8" cy="8" r="5.5" />
                          <path d="m6 6 4 4m0-4-4 4" />
                        }
                        @case ('flow') {
                          <circle cx="4" cy="4" r="1.75" />
                          <circle cx="12" cy="12" r="1.75" />
                          <path d="M5.75 4H9.5a2.5 2.5 0 0 1 2.5 2.5v3.75" />
                        }
                        @case ('up-down') {
                          <path d="m5.5 6 2.5-2.5 2.5 2.5" />
                          <path d="m5.5 10 2.5 2.5 2.5-2.5" />
                        }
                      }
                    </svg>
                    <span class="min-w-0 flex-1 text-et-surface">{{ blocker.text }}</span>
                    @if (group.kind === 'direct-edit') {
                      <button
                        (click)="openEditSketch.emit(blocker)"
                        et-button
                        type="button"
                        variant="outline"
                        size="xs"
                      >
                        {{ LABELS.openEditSketch }}
                      </button>
                    }
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      </ethlete-disclosure>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BADGE_IMPORTS,
    BUTTON_IMPORTS,
    DisclosureComponent,
    ICON_IMPORTS,
    NgTemplateOutlet,
    ProvideColorDirective,
    TOOLTIP_IMPORTS,
  ],
  providers: [provideIcons(CHECK_ICON)],
  host: { class: 'block' },
})
export class BuildReadyFooterComponent {
  protected warningTheme = injectSemanticColorTheme('warning');
  protected errorTheme = injectSemanticColorTheme('error');
  public status = input.required<BuildReadyStatus>();
  public agent = input<AgentProgress | null>(null);
  public blockersOpen = model(false);

  public openEditSketch = output<BuildBlocker>();
  protected readonly LABELS = STUDIO_LABELS.buildReady;

  protected blockerCount = computed(() => {
    const status = this.status();

    return status.state === 'blocked' ? status.blockers.length : 0;
  });

  protected groups = computed(() => {
    const status = this.status();
    const blockers = status.state === 'blocked' ? status.blockers : [];

    return GROUPS.flatMap(({ kind, icon }) => {
      const ofKind = blockers.filter((blocker) => blocker.kind === kind);

      return ofKind.length > 0 ? [{ kind, icon, blockers: ofKind }] : [];
    });
  });
}
