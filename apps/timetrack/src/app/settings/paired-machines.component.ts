import { Component, ViewEncapsulation, computed, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  BANNER_IMPORTS,
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SpinnerComponent,
} from '@ethlete/components';
import { formatTimeOfDay } from '@ethlete/timetrack';
import { catchError, merge, of, switchMap, timer } from 'rxjs';
import { PairTarget, injectHostPorts } from '../../host';
import { describeClockOffset, formatLastSeen, injectPeers, parseAddress } from '../peers';
import { ExplainComponent } from './explain.component';

const WHY = `Paired machines are your other computers running Timetrack, each set up with its own credentials.
A pairing is proven by a 6-digit code typed on the second machine; after that the two only accept each other's
certificate. Each machine greets the others once a minute and measures how far their clocks differ.`;

const DISCOVERY_POLL_MS = 5_000;

@Component({
  selector: 'ethlete-paired-machines',
  template: `
    <div class="flex flex-col gap-3" data-paired-machines>
      <div class="flex items-center gap-2">
        <h3 class="text-h4">Paired machines</h3>
        <ethlete-explain [text]="WHY" label="paired machines" />
        @if (peers.busy()) {
          <et-spinner size="sm" />
        }
      </div>

      @for (row of rows(); track row.machineId) {
        <div class="flex flex-wrap items-center gap-3" data-paired-machine>
          <span class="text-base">{{ row.label }}</span>
          <span class="text-small text-et-surface-subtle" data-paired-last-seen>Last seen {{ row.lastSeen }}</span>

          @if (row.offset; as offset) {
            <span
              [class.text-et-surface-subtle]="offset.severity === 'ok'"
              [class.text-et-warning-ink]="offset.severity === 'warning'"
              [class.text-et-error]="offset.severity === 'error'"
              [attr.data-clock-offset]="offset.severity"
              class="text-small"
            >
              {{ offset.text }}
            </span>
          }

          <button
            [attr.aria-label]="'Forget ' + row.label"
            [disabled]="peers.busy()"
            (click)="peers.forget(row.machineId)"
            et-button
            variant="transparent"
            size="sm"
          >
            Forget
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">No machine is paired.</p>
      }

      <h4 class="text-base">Pair a machine</h4>

      <p class="text-small text-et-surface-muted">
        Show a code on one machine. On the other, pick that machine or enter its address, then type the code.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <button [disabled]="peers.busy()" (click)="peers.showCode()" et-button variant="outline" size="sm">
          Show code
        </button>

        @if (peers.offer(); as offer) {
          <span class="text-h4 tabular-nums" data-pair-offer-code>{{ offer.code }}</span>
          <span class="text-small text-et-surface-subtle">Valid until {{ offerUntil() }}</span>
          <button (click)="peers.hideCode()" et-button variant="transparent" size="sm">Hide</button>
        }
      </div>

      <div class="flex flex-wrap items-center gap-2" data-discovered-machines>
        @for (machine of unpaired(); track machine.machineId) {
          <button
            [variant]="picked() === machine.machineId ? 'filled' : 'outline'"
            (click)="pick(machine.machineId)"
            et-button
            size="sm"
            data-discovered-machine
          >
            {{ machine.label }}
          </button>
        } @empty {
          <span class="text-small text-et-surface-subtle">
            No other Timetrack is visible on this network. Enter its address instead.
          </span>
        }
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <et-form-field class="w-56" appearance="underline" size="sm" data-pair-address>
          <et-label>Address</et-label>
          <et-input [value]="address()" (valueChange)="typeAddress($event)" placeholder="192.168.1.20:52741" />
        </et-form-field>

        <et-form-field class="w-30" appearance="underline" size="sm" data-pair-code>
          <et-label>Code</et-label>
          <et-input [(value)]="code" placeholder="123456" />
        </et-form-field>

        <button [disabled]="!canPair()" (click)="pair()" et-button variant="filled" size="sm">Pair</button>
      </div>

      @if (peers.failure(); as failure) {
        <et-banner [heading]="failure.heading" [description]="failure.message" type="error" data-pair-failure />
      }

      @if (peers.justPaired(); as label) {
        <p class="text-small" data-pair-done>Paired with {{ label }}.</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BANNER_IMPORTS, BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SpinnerComponent, ExplainComponent],
})
export class PairedMachinesComponent {
  protected peers = injectPeers();
  private ports = injectHostPorts();

  protected readonly WHY = WHY;

  protected picked = signal<string | null>(null);
  protected address = signal('');
  protected code = signal('');

  private discovered = toSignal(
    merge(timer(0, DISCOVERY_POLL_MS), toObservable(this.peers.paired)).pipe(
      switchMap(() => this.ports.peers.discovered$().pipe(catchError(() => of([])))),
    ),
    { initialValue: [] },
  );

  protected unpaired = computed(() => this.discovered().filter((machine) => !machine.paired));

  protected rows = computed(() => {
    const nowMs = this.peers.readAtMs();

    return this.peers.paired().map((machine) => ({
      machineId: machine.machineId,
      label: machine.label,
      lastSeen: formatLastSeen(machine.lastSeenMs, nowMs),
      offset: describeClockOffset(machine),
    }));
  });

  protected offerUntil = computed(() => {
    const offer = this.peers.offer();

    return offer ? formatTimeOfDay(new Date(offer.expiresAtMs)) : '';
  });

  private target = computed<PairTarget | null>(() => {
    const picked = this.picked();

    if (picked) return { kind: 'discovered', machineId: picked };

    return parseAddress(this.address());
  });

  protected canPair = computed(() => !!this.target() && /^\d{6}$/.test(this.code().trim()) && !this.peers.busy());

  protected pick(machineId: string) {
    this.picked.set(this.picked() === machineId ? null : machineId);
    this.address.set('');
  }

  protected typeAddress(typed: string) {
    this.address.set(typed);
    this.picked.set(null);
  }

  protected pair() {
    const target = this.target();

    if (!target) return;

    this.peers.pair(target, this.code().trim());
    this.code.set('');
  }
}
