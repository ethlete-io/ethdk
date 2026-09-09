import { Component, ViewEncapsulation, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { TimetrackCallRules } from '@ethlete/timetrack';

/**
 * Which calls on this machine were work.
 *
 * Deliberately not an exclusion rule: a call is a presence sample, so denying one before the store
 * would turn the hours in an open voice room into absence rather than into unclassified time. These
 * decide at read time instead, and a call neither list names is simply not counted.
 */
@Component({
  selector: 'ethlete-call-rules',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-h4">Which calls were work</h3>
        <p class="text-small text-et-surface-muted">
          A call is recognised by which application holds the microphone, so every meeting tool counts at once and no
          token is needed. Whether a call was work is yours to say: an open voice room and a client meeting look
          identical, and an application's own mute is invisible. A call no rule names is not counted.
        </p>
      </div>

      <p class="text-small text-et-surface-subtle">
        Each line is a regular expression, matched against the window title the call was named from and against the
        application itself. <code class="text-mono">Braune Digital</code> matches a channel;
        <code class="text-mono">tinyspeck</code>
        matches every Slack call.
      </p>

      <div class="flex flex-col gap-2" data-counts-as-work>
        <h4 class="text-base">Counted as work</h4>

        @for (pattern of rules().countsAsWork; track pattern) {
          <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
            <span class="grow break-all text-mono text-small">{{ pattern }}</span>

            <button
              [attr.aria-label]="'Stop counting calls matching ' + pattern"
              (click)="removeCountsAsWork.emit(pattern)"
              et-button
              variant="transparent"
              size="sm"
            >
              Remove
            </button>
          </div>
        } @empty {
          <p class="text-small text-et-surface-subtle">No call is counted yet.</p>
        }

        <div class="flex flex-wrap items-center gap-3">
          <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
            <et-input [(value)]="counted" aria-label="A call that counts as work" placeholder="Braune Digital" />
          </et-form-field>

          <button [disabled]="!counted().trim()" (click)="addCounted()" et-button variant="outline" size="sm">
            Add
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2" data-never-counts-as-work>
        <h4 class="text-base">Never counted, whatever else matches</h4>

        @for (pattern of rules().neverCountsAsWork; track pattern) {
          <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
            <span class="grow break-all text-mono text-small">{{ pattern }}</span>

            <button
              [attr.aria-label]="'Stop refusing calls matching ' + pattern"
              (click)="removeNeverCountsAsWork.emit(pattern)"
              et-button
              variant="transparent"
              size="sm"
            >
              Remove
            </button>
          </div>
        } @empty {
          <p class="text-small text-et-surface-subtle">Nothing is refused outright.</p>
        }

        <div class="flex flex-wrap items-center gap-3">
          <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
            <et-input [(value)]="denied" aria-label="A call that is never work" placeholder="#.*-general" />
          </et-form-field>

          <button [disabled]="!denied().trim()" (click)="addDenied()" et-button variant="outline" size="sm">Add</button>
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class CallRulesComponent {
  public rules = input.required<TimetrackCallRules>();

  public addCountsAsWork = output<string>();
  public removeCountsAsWork = output<string>();
  public addNeverCountsAsWork = output<string>();
  public removeNeverCountsAsWork = output<string>();

  protected counted = signal('');
  protected denied = signal('');

  protected addCounted() {
    this.addCountsAsWork.emit(this.counted().trim());
    this.counted.set('');
  }

  protected addDenied() {
    this.addNeverCountsAsWork.emit(this.denied().trim());
    this.denied.set('');
  }
}
