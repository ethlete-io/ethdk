import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { CHEVRON_ICON, IconDirective, provideIcons } from '../icon';
import { AppointmentTreeNode, countDescendants } from './headless';

/**
 * The sub-appointment chain piece of an appointment badge, stamped by `etSchedulerBadgeChainCount`.
 * Renders a chevron and the total descendant count (every depth, not just direct children); hidden
 * for an appointment with no children.
 *
 * @internal
 */
@Component({
  selector: 'et-scheduler-badge-chain-count',
  template: `
    @if (count(); as count) {
      <span class="et-scheduler-appointment-chain-count">
        <i class="et-scheduler-appointment-chain-count-icon" aria-hidden="true" etIcon="et-chevron"></i>
        {{ count }}
      </span>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  providers: [provideIcons(CHEVRON_ICON)],
})
export class SchedulerBadgeChainCountComponent {
  public node = input.required<AppointmentTreeNode>();

  protected count = computed(() => {
    const count = countDescendants(this.node());

    return count > 0 ? count : null;
  });
}
