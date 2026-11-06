import { Component, ViewEncapsulation, booleanAttribute, computed, input, isDevMode } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { appVersion$ } from '../host';
import { AlphaBadgeComponent } from './alpha-badge.component';

/** Which build this is, said where the app says its own name. */
@Component({
  selector: 'ethlete-build-stamp',
  template: `
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      @if (!withoutBadge()) {
        <ethlete-alpha-badge />
      }

      <span class="text-small text-et-surface-subtle" data-build-label>{{ label() }}</span>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AlphaBadgeComponent],
})
export class BuildStampComponent {
  public withoutBadge = input(false, { transform: booleanAttribute });

  private version = toSignal(appVersion$().pipe(catchError(() => of(null))), { initialValue: null });

  protected label = computed(() => {
    const version = this.version();
    const parts = [version ? `v${version}` : 'unknown version'];

    if (isDevMode()) parts.push('dev build');

    return parts.join(' · ');
  });
}
