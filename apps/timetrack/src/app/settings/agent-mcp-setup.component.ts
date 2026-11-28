import { Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { catchError, from, map, of, tap } from 'rxjs';
import { injectHostPorts } from '../../host/ports';
import { agentMcpLines } from './agent-mcp-lines';

@Component({
  selector: 'ethlete-agent-mcp-setup',
  template: `
    <div class="flex flex-col gap-1" data-agent-mcp-setup>
      <h4 class="text-base">Connect an agent</h4>
      <span class="text-small text-et-surface-text-muted">
        Run one line. The agent then reads through this app and can only queue writes for your approval.
      </span>
      @if (!lines().length) {
        <span class="text-small text-et-surface-text-muted">This build ships no agent adapter.</span>
      }
      @for (line of lines(); track line.client) {
        <div class="flex items-center gap-2">
          <span class="w-24 shrink-0 text-small text-et-surface-text-muted">{{ line.client }}</span>
          <code [title]="line.command" class="min-w-0 flex-1 break-all text-small">{{ line.command }}</code>
          <button (click)="copy(line.client, line.command)" et-button size="sm" variant="outline" type="button">
            {{ copied() === line.client ? 'Copied' : 'Copy' }}
          </button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS],
})
export class AgentMcpSetupComponent {
  private destroyRef = inject(DestroyRef);
  private ports = injectHostPorts();

  protected lines = toSignal(
    this.ports.reporter.agentMcp$().pipe(
      map((path) => (path ? agentMcpLines(path) : [])),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );
  protected copied = signal<string | null>(null);

  protected copy(client: string, command: string) {
    from(navigator.clipboard.writeText(command))
      .pipe(
        map(() => client),
        catchError(() => of(null)),
        tap((done) => this.copied.set(done)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
