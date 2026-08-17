import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SpinnerComponent } from '@ethlete/components';
import {
  AttributionRule,
  AttributionTarget,
  InferredAttribution,
  ReasoningRequest,
  UnnamedContext,
  describeAttributionRule,
  formatDurationMs,
} from '@ethlete/timetrack';
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
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex grow flex-col gap-1">
          <h3 class="text-h4">Not yet named</h3>
          <p class="text-small text-et-surface-muted">
            Naming one of these logs it against that issue here and on every later day it appears in.
          </p>
        </div>

        @if (canAsk()) {
          <button [disabled]="isAsking()" (click)="ask.emit()" et-button variant="outline" size="sm">
            @if (isAsking()) {
              <et-spinner size="sm" />
            }
            {{ hasAsked() ? 'Ask again' : 'Ask for suggestions' }}
          </button>
        }
      </div>

      @if (payload(); as request) {
        @if (canAsk()) {
          <details class="rounded-md border border-et-surface-border p-3">
            <summary class="cursor-pointer text-small text-et-surface-muted">
              What gets sent — {{ request.contexts.length }} context(s), {{ request.candidates.length }} candidate(s)
            </summary>
            <pre class="mt-2 overflow-x-auto text-mono text-small">{{ printed() }}</pre>
          </details>
        }
      }

      @for (entry of listed(); track entry.id) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="w-28 shrink-0 text-mono text-small text-et-surface-muted">{{ entry.clock }}</span>
          <span class="w-14 shrink-0 text-small">{{ entry.duration }}</span>

          <span class="flex min-w-50 grow flex-col">
            <span class="text-small">{{ entry.label }}</span>
            @if (entry.answered) {
              <span class="text-small text-et-surface-muted">{{ entry.answered }}</span>
            } @else if (entry.suggestion; as suggestion) {
              <span class="text-small text-et-surface-muted">
                Suggested {{ suggestion.issueKey }} — {{ suggestion.reason }}
              </span>
            }
          </span>

          @if (entry.answered) {
            <button (click)="askAgain(entry.id)" et-button variant="outline" size="sm">Ask me again</button>
          } @else {
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

            <button (click)="createTicket.emit(entry.context)" et-button variant="transparent" size="sm">
              Create a ticket
            </button>

            <button (click)="donate(entry.id)" et-button variant="transparent" size="sm">No tickets here</button>

            @if (entry.path; as path) {
              <button (click)="markPrivate.emit(path)" et-button variant="transparent" size="sm">Not work</button>
            }
          }
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SpinnerComponent],
})
export class UnnamedWorkComponent {
  public contexts = input.required<readonly UnnamedContext[]>();
  /** What the reasoning provider proposed, by context id. Empty until the user asks for it. */
  public suggestions = input<ReadonlyMap<string, InferredAttribution>>(new Map());
  /** Exactly what a run would send, shown here so it can be read before it leaves the machine. */
  public payload = input<ReasoningRequest | null>(null);
  /** The standing rule already covering a context, by context id. */
  public rules = input<ReadonlyMap<string, AttributionRule>>(new Map());
  public canAsk = input(false);
  public isAsking = input(false);
  public hasAsked = input(false);

  public name = output<ContextNaming>();
  public ask = output<void>();
  /** For work no issue covers at all: the answer is a new ticket rather than a key to type. */
  public createTicket = output<UnnamedContext>();
  /**
   * The repository path a context sits in, to be marked private. Only a context that has one can be:
   * a browser and a chat client are named by the exclusion rules, which read an app rather than a path.
   */
  public markPrivate = output<string>();
  /** The id of a rule the user takes back, so this context is asked about again. */
  public forget = output<string>();

  private drafts = signal<Record<string, string>>({});

  protected listed = computed(() => {
    const suggestions = this.suggestions();
    const rules = this.rules();

    return this.contexts().map((context) => ({
      id: context.id,
      context,
      clock: `${formatClockTime(context.from)} – ${formatClockTime(context.to)}`,
      duration: formatDurationMs(context.observedMs),
      label: describeAttributionRule(context.suggestion),
      path: context.suggestion.repoPath,
      suggestion: suggestions.get(context.id),
      answered: answeredBy(rules.get(context.id)),
    }));
  });

  protected printed = computed(() => JSON.stringify(this.payload(), null, 2));

  /** A suggestion fills the field rather than being applied, so saving the rule stays a decision. */
  protected draftFor(id: string) {
    return this.drafts()[id] ?? this.suggestions().get(id)?.issueKey ?? '';
  }

  protected setDraft(id: string, issueKey: string) {
    this.drafts.update((all) => ({ ...all, [id]: issueKey }));
  }

  protected submit(id: string) {
    const issueKey = this.draftFor(id).trim();

    if (issueKey) this.emitNaming(id, { kind: 'issue', issueKey });
  }

  /**
   * For a project nobody files tickets against. Its time then joins whatever else was open around it,
   * rather than becoming a row with no issue to put it on.
   */
  protected donate(id: string) {
    this.emitNaming(id, { kind: 'donate' });
  }

  protected askAgain(id: string) {
    const rule = this.rules().get(id);

    if (rule) this.forget.emit(rule.id);
  }

  private emitNaming(id: string, target: AttributionTarget) {
    const entry = this.listed().find((candidate) => candidate.id === id);

    if (!entry) return;

    this.drafts.update((all) => ({ ...all, [id]: '' }));
    this.name.emit({ context: entry.context, target });
  }
}

/**
 * Why a context the user has already answered for is still on the list.
 *
 * A donating context needs attributed work in the same day to hand its time to, and a day that has
 * none leaves it exactly where it was. Saying so is the difference between a rule that is waiting for
 * something and a button that did nothing.
 */
const answeredBy = (rule: AttributionRule | undefined) => {
  if (!rule) return null;

  return rule.target.kind === 'issue'
    ? `Always logged on ${rule.target.issueKey}, but no time reached it on this day`
    : 'Files no issues — its time joins the work beside it, and this day has none to join';
};
