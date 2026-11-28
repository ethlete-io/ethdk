import { Component, DestroyRef, ViewEncapsulation, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { catchError, from, map, of, tap } from 'rxjs';

@Component({
  selector: 'ethlete-agent-mcp-setup',
  template: `
    <div class="flex flex-col gap-1" data-agent-mcp-setup>
      <h4 class="text-base">Connect an agent</h4>
      <span class="text-small text-et-surface-text-muted">
        Run one line with the path to your SDK checkout. The agent then reads through this app and can only queue writes
        for your approval.
      </span>
      @for (line of LINES; track line.client) {
        <div class="flex items-center gap-2">
          <span class="w-24 shrink-0 text-small text-et-surface-text-muted">{{ line.client }}</span>
          <code [title]="line.command" class="min-w-0 flex-1 truncate text-small">{{ line.command }}</code>
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

  protected readonly LINES = LINES;
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

const ADAPTER = 'node /path/to/ethlete-sdk/libs/timetrack/src/lib/agent-mcp/timetrack-mcp.mts';

const LINES = [
  { client: 'Claude Code', command: `claude mcp add --scope user --transport stdio timetrack -- ${ADAPTER}` },
  { client: 'Codex', command: `codex mcp add timetrack -- ${ADAPTER}` },
];
