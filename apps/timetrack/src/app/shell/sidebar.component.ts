import { Component, ViewEncapsulation, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { createOverlayOpener } from '@ethlete/components';
import { injectApprovalQueue } from '../agent/approval-queue';
import { APPROVAL_QUEUE_OVERLAY } from '../agent/approval-queue.component';
import { injectAutoMode } from '../day-review/auto-mode';
import { injectPeers } from '../peers';
import { PAIRED_MACHINES_OVERLAY } from '../peers/paired-machines-overlay.component';
import { SHELL_VIEWS } from './views';

@Component({
  selector: 'ethlete-sidebar',
  template: `
    <nav class="flex flex-col gap-1" aria-label="Views">
      @for (view of VIEWS; track view.path) {
        <a
          [routerLink]="view.path"
          class="flex flex-col gap-0.5 rounded-md px-3 py-2 no-underline transition-colors hover:bg-et-surface-border/40"
          routerLinkActive="bg-et-brand/10 text-et-brand-ink"
        >
          <span class="text-base">{{ view.label }}</span>
          <span class="text-small text-et-surface-subtle">{{ view.hint }}</span>
        </a>
      }
    </nav>

    @if (autoMode.enabled()) {
      <button
        (click)="approvals.open()"
        class="mt-4 flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-left text-small transition-colors hover:bg-et-surface-border/40"
        type="button"
        data-auto-mode-status
      >
        <span
          [class.animate-pulse]="!!autoMode.running()"
          class="size-2 shrink-0 self-start rounded-full bg-et-brand mt-1.5"
          aria-hidden="true"
        ></span>
        <span class="flex min-w-0 flex-col">
          <span>
            Auto mode · {{ autoMode.running() ? 'working' : 'on' }}
            @if (queue.waiting().length; as count) {
              · {{ count }} waiting
            }
          </span>

          @if (autoMode.running(); as running) {
            <span [title]="running.label" class="truncate text-et-surface-muted" data-auto-mode-running>
              {{ running.label }}
              @if (autoMode.queuedCount() > 1) {
                · {{ autoMode.queuedCount() - 1 }} more queued
              }
            </span>
          }
        </span>
      </button>
    }

    @if (peers.paired().length) {
      <button
        [class.mt-4]="!autoMode.enabled()"
        [title]="peersTitle()"
        (click)="pairedMachines.open()"
        class="flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2 text-left text-small transition-colors hover:bg-et-surface-border/40"
        type="button"
        data-peers-status
      >
        <span
          [class.bg-et-brand]="peers.connected().length"
          [class.bg-et-surface-border]="!peers.connected().length"
          class="size-2 shrink-0 rounded-full"
          aria-hidden="true"
        ></span>
        <span>Timetrack · {{ peers.connected().length }} connected</span>
      </button>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, RouterLinkActive],
})
export class SidebarComponent {
  protected autoMode = injectAutoMode();
  protected queue = injectApprovalQueue();
  protected peers = injectPeers();
  protected readonly VIEWS = SHELL_VIEWS;
  protected approvals = createOverlayOpener(APPROVAL_QUEUE_OVERLAY);
  protected pairedMachines = createOverlayOpener(PAIRED_MACHINES_OVERLAY);

  protected peersTitle = computed(() => {
    const connected = this.peers.connected().map((machine) => machine.label);

    return connected.length ? `Connected: ${connected.join(', ')}` : 'No paired machine answered in the last 3 minutes';
  });
}
