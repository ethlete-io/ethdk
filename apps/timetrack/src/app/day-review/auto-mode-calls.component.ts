import { Component, ViewEncapsulation, input } from '@angular/core';
import { ModelCall, formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './format';

const printedReply = (stdout: string) => {
  try {
    return JSON.stringify(JSON.parse(stdout), null, 2);
  } catch {
    return stdout;
  }
};

@Component({
  selector: 'ethlete-auto-mode-calls',
  template: `
    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      @for (call of calls(); track call.id) {
        <li [attr.data-model-call]="call.id">
          <details class="rounded-md border border-et-surface-border p-3">
            <summary class="cursor-pointer text-small">{{ summaryOf(call) }}</summary>

            <h5 class="mb-1 mt-3 text-small text-et-surface-muted">Command</h5>
            <pre class="overflow-x-auto text-mono text-small">{{ commandOf(call) }}</pre>

            @if (call.stdin) {
              <h5 class="mb-1 mt-3 text-small text-et-surface-muted">Sent</h5>
              <pre class="overflow-x-auto whitespace-pre-wrap text-mono text-small" data-model-call-sent>{{
                call.stdin
              }}</pre>
            }

            @if (call.stdout) {
              <h5 class="mb-1 mt-3 text-small text-et-surface-muted">Reply</h5>
              <pre class="overflow-x-auto whitespace-pre-wrap text-mono text-small" data-model-call-reply>{{
                replyOf(call)
              }}</pre>
            }

            @if (call.stderr) {
              <h5 class="mb-1 mt-3 text-small text-et-surface-muted">Error output</h5>
              <pre class="overflow-x-auto whitespace-pre-wrap text-mono text-small">{{ call.stderr }}</pre>
            }

            @if (call.error) {
              <p class="mt-3 text-small text-et-error">{{ call.error }}</p>
            }
          </details>
        </li>
      }
    </ul>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class AutoModeCallsComponent {
  public calls = input.required<readonly ModelCall[]>();

  protected summaryOf(call: ModelCall) {
    const state =
      call.endedAtMs === undefined
        ? 'running'
        : `${call.error ? 'failed' : `exit ${call.code ?? '?'}`} after ${this.tookOf(call.endedAtMs - call.startedAtMs)}`;

    return `${formatClockTime(new Date(call.startedAtMs))} · ${call.ask} · ${state}`;
  }

  protected commandOf(call: ModelCall) {
    return [call.command, ...call.args].join(' ');
  }

  protected replyOf(call: ModelCall) {
    return printedReply(call.stdout ?? '');
  }

  private tookOf(ms: number) {
    return ms < 60_000 ? `${Math.round(ms / 1000)}s` : formatDurationMs(ms);
  }
}
