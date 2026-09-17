import { Component, ViewEncapsulation } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { HostShellMissingError } from '../../host/invoke';
import { workspaceStatus$ } from '../../host/workspace';

@Component({
  selector: 'ethlete-home-view',
  template: `
    <div class="flex grow flex-col gap-4 p-8">
      <h1 class="text-h2">Ethlete Studio</h1>
      <p class="text-et-surface-muted">The workspace this host reads:</p>
      <pre class="rounded border border-et-surface-border bg-et-surface-bg p-4 text-mono">{{ status() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class HomeViewComponent {
  protected status = toSignal(
    workspaceStatus$().pipe(
      catchError((error: unknown) => of(error instanceof HostShellMissingError ? error.message : String(error))),
    ),
    { initialValue: 'Reading the workspace…' },
  );
}
