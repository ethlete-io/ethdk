import {
  Component,
  Directive,
  Injector,
  ViewEncapsulation,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Appointment, BUTTON_IMPORTS, injectSchedulerEditSurfaceHost } from '@ethlete/components';
import { ProvideColorDirective } from '@ethlete/core';
import { AgentApproval, describeApproval } from '@ethlete/timetrack';
import { injectApprovalQueue } from '../../agent/approval-queue';
import { injectJiraCatalog } from '../../jira';
import { approvalDescriptionOf, approvalIssueKeysOf, approvalLinesOf, injectBandApprovals } from '../band-approvals';
import { rowEntryOf } from './row-appointment';

/** What a waiting approval would change on this row, with the presses that decide it. */
@Component({
  selector: 'ethlete-edit-approval',
  template: `
    @for (item of items(); track item.id) {
      <div
        [attr.data-row-approval]="item.id"
        class="flex flex-col gap-2 rounded-md border border-dashed border-et-brand-ink px-3 py-2"
      >
        <span class="text-small font-medium text-et-brand-ink">Auto mode suggests</span>
        <span class="text-small">{{ describe(item) }}</span>

        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
          @for (line of linesOf(item); track line.label) {
            <dt class="text-et-surface-muted">{{ line.label }}</dt>
            <dd class="min-w-0 break-words">{{ line.value }}</dd>
          }
        </dl>

        @if (DESCRIPTION_OF(item); as description) {
          <p class="text-small whitespace-pre-wrap text-et-surface-muted">{{ description }}</p>
        }

        <div class="flex items-center justify-end gap-3">
          @if (item.state === 'running') {
            <span class="text-small text-et-surface-muted">Carrying it out…</span>
          } @else {
            <button (click)="queue.reject(item.id)" et-text-button etProvideColor="danger">Reject</button>
            <button (click)="queue.approve(item.id)" et-button size="sm">Approve</button>
          }
        </div>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ProvideColorDirective],
})
export class EditApprovalComponent {
  protected queue = injectApprovalQueue();
  private placed = injectBandApprovals();

  private catalog = injectJiraCatalog();
  public draft = input.required<WritableSignal<Appointment>>();
  protected readonly DESCRIPTION_OF = approvalDescriptionOf;

  protected items = computed(() => {
    const id = rowEntryOf(this.draft()())?.row.id;

    return id ? this.placed.forRow(id) : [];
  });

  constructor() {
    effect(() => {
      const keys = this.items().flatMap(approvalIssueKeysOf);

      if (keys.length) untracked(() => this.catalog.askForIssueKeys(keys));
    });
  }

  protected linesOf(item: AgentApproval) {
    return approvalLinesOf(item, (key) => this.catalog.issueForKey(key)?.summary || undefined);
  }

  protected describe(item: AgentApproval) {
    return describeApproval(item.request);
  }
}

@Directive({ selector: '[ethleteEditApproval]' })
export class EditApprovalDirective {
  private host = injectSchedulerEditSurfaceHost('ethleteEditApproval');

  constructor() {
    this.host.registerEditField({ component: EditApprovalComponent, injector: inject(Injector), order: 0 });
  }
}
