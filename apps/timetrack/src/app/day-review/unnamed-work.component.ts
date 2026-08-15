import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS } from '@ethlete/components';
import { AttributionTarget, UnnamedContext, describeAttributionRule, formatDurationMs } from '@ethlete/timetrack';
import { formatClockTime } from './format';

export type ContextNaming = { context: UnnamedContext; target: AttributionTarget };

/**
 * The day's work that no rule could name an issue for, one line per context rather than per block.
 *
 * A repository whose branches carry no issue key produces most of a day this way, and it fragments into
 * a dozen blocks that are all the same work — asking about each of them separately is how a reviewer
 * stops reviewing. Naming one here writes a standing rule, so the answer also covers every later day.
 */
@Component({
  selector: 'ethlete-unnamed-work',
  template: `
    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-1">
        <h3 class="text-h4">Not yet named</h3>
        <p class="text-small text-et-surface-muted">
          Naming one of these logs it against that issue here and on every later day it appears in.
        </p>
      </div>

      @for (entry of listed(); track entry.id) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ entry.clock }}</span>
          <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>
          <span class="min-w-50 grow text-small">{{ entry.label }}</span>

          <et-form-field class="w-30 shrink-0" appearance="underline" size="sm">
            <et-input
              [value]="draftFor(entry.id)"
              [aria-label]="'Issue for ' + entry.label"
              (valueChange)="setDraft(entry.id, $event)"
              (keydown.enter)="submit(entry.id)"
              placeholder="Issue"
            />
          </et-form-field>

          <button [disabled]="!draftFor(entry.id)" (click)="submit(entry.id)" et-button variant="outline" size="sm">
            Always log here
          </button>

          <button (click)="donate(entry.id)" et-button variant="transparent" size="sm">No tickets here</button>
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS],
})
export class UnnamedWorkComponent {
  public contexts = input.required<readonly UnnamedContext[]>();

  public name = output<ContextNaming>();

  private drafts = signal<Record<string, string>>({});

  protected listed = computed(() =>
    this.contexts().map((context) => ({
      id: context.id,
      context,
      clock: `${formatClockTime(context.from)} – ${formatClockTime(context.to)}`,
      duration: formatDurationMs(context.observedMs),
      label: describeAttributionRule(context.suggestion),
    })),
  );

  protected draftFor(id: string) {
    return this.drafts()[id] ?? '';
  }

  protected setDraft(id: string, issueKey: string) {
    this.drafts.update((all) => ({ ...all, [id]: issueKey }));
  }

  protected submit(id: string) {
    const issueKey = this.draftFor(id).trim();

    if (issueKey) this.emit(id, { kind: 'issue', issueKey });
  }

  /**
   * For a project nobody files tickets against. Its time then joins whatever else was open around it,
   * rather than becoming a row with no issue to put it on.
   */
  protected donate(id: string) {
    this.emit(id, { kind: 'donate' });
  }

  private emit(id: string, target: AttributionTarget) {
    const entry = this.listed().find((candidate) => candidate.id === id);

    if (!entry) return;

    this.drafts.update((all) => ({ ...all, [id]: '' }));
    this.name.emit({ context: entry.context, target });
  }
}
