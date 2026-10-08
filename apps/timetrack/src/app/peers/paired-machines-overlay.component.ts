import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import {
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  OVERLAY_CONTENT_IMPORTS,
  OverlayMainDirective,
  defineOverlay,
  dialogOverlayStrategy,
} from '@ethlete/components';
import { PairedMachinesComponent } from '../settings/paired-machines.component';
import { describeClockOffset, formatLastSeen } from './peer-status';
import { injectPeers } from './peers';

@Component({
  selector: 'ethlete-paired-machines-overlay',
  template: `
    <div etOverlayHeader>
      <h2 class="text-h4" etOverlayTitle>Paired machines</h2>
    </div>

    <et-overlay-body>
      <div class="flex flex-col gap-4" data-paired-machines-modal>
        @for (row of rows(); track row.machineId) {
          <div class="flex flex-col gap-2 rounded-md border border-et-surface-border p-3" data-paired-machine>
            <div class="flex flex-wrap items-end gap-3">
              <et-form-field class="w-56" appearance="underline" size="sm" data-machine-name>
                <et-label>Name</et-label>
                <et-input [value]="row.draft" (valueChange)="type(row.machineId, $event)" />
              </et-form-field>

              <button
                [disabled]="!row.changed || peers.busy()"
                (click)="rename(row.machineId, row.draft)"
                et-button
                variant="outline"
                size="sm"
                data-machine-rename
              >
                Rename
              </button>

              <button
                [attr.aria-label]="'Forget ' + row.label"
                [disabled]="peers.busy()"
                (click)="peers.forget(row.machineId)"
                class="ml-auto"
                et-button
                variant="transparent"
                size="sm"
                data-machine-forget
              >
                Forget
              </button>
            </div>

            <div class="flex flex-wrap gap-x-4 text-small text-et-surface-subtle">
              <span data-paired-last-seen>Last seen {{ row.lastSeen }}</span>
              <span data-paired-last-sync>{{ row.lastSync }}</span>

              @if (row.offset; as offset) {
                <span
                  [class.text-et-warning-ink]="offset.severity === 'warning'"
                  [class.text-et-error]="offset.severity === 'error'"
                  [attr.data-clock-offset]="offset.severity"
                >
                  {{ offset.text }}
                </span>
              }
            </div>
          </div>
        } @empty {
          <p class="text-small text-et-surface-subtle">No machine is paired.</p>
        }

        <ethlete-paired-machines listed="false" />
      </div>
    </et-overlay-body>

    <div class="flex justify-end" etOverlayFooter>
      <button et-button etOverlayClose variant="outline">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, OVERLAY_CONTENT_IMPORTS, PairedMachinesComponent],
  hostDirectives: [OverlayMainDirective],
})
export class PairedMachinesOverlayComponent {
  protected peers = injectPeers();
  private drafts = signal<Record<string, string>>({});

  protected rows = computed(() => {
    const nowMs = this.peers.readAtMs();
    const drafts = this.drafts();

    return this.peers.paired().map((machine) => {
      const draft = drafts[machine.machineId] ?? machine.label;

      return {
        machineId: machine.machineId,
        label: machine.label,
        draft,
        changed: draft.trim() !== machine.label,
        lastSeen: formatLastSeen(machine.lastSeenMs, nowMs),
        lastSync: machine.lastPullMs === null ? 'Never synced' : `Synced ${formatLastSeen(machine.lastPullMs, nowMs)}`,
        offset: describeClockOffset(machine),
      };
    });
  });

  protected type(machineId: string, typed: string) {
    this.drafts.update((drafts) => ({ ...drafts, [machineId]: typed }));
  }

  protected rename(machineId: string, name: string) {
    this.peers.rename(machineId, name);
    this.drafts.update(({ [machineId]: _, ...rest }) => rest);
  }
}

export const PAIRED_MACHINES_OVERLAY = /* @__PURE__ */ defineOverlay({
  component: PairedMachinesOverlayComponent,
  strategies: dialogOverlayStrategy({ width: 'min(640px, 90%)', maxWidth: '90%' }),
});
