import { Component, ViewEncapsulation, computed, isDevMode } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { appVersion$ } from '../host';

/** Which build this is, said where the app says its own name. */
@Component({
  selector: 'ethlete-build-stamp',
  template: `
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        class="text-small -rotate-2 rounded-sm bg-et-warning px-1.5 py-0.5 font-bold tracking-wide text-et-on-warning uppercase shadow-sm"
        data-alpha-patch
      >
        Early alpha
      </span>

      <span class="text-small text-et-surface-subtle" data-build-label>{{ label() }}</span>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class BuildStampComponent {
  private version = toSignal(appVersion$().pipe(catchError(() => of(null))), { initialValue: null });

  protected label = computed(() => {
    const version = this.version();
    const parts = [version ? `v${version}` : 'unknown version'];

    if (isDevMode()) parts.push('dev build');

    return parts.join(' · ');
  });
}
