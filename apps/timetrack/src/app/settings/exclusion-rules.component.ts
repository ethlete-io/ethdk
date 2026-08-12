import { Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';
import {
  BUTTON_IMPORTS,
  CHOICE_FIELD_IMPORTS,
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  SWITCH_IMPORTS,
} from '@ethlete/components';
import { DEFAULT_EXCLUSION_RULES, TimetrackExclusionRule, exclusionRuleError } from '@ethlete/timetrack';

const KIND_LABEL: Record<TimetrackExclusionRule['kind'], string> = {
  'app-id': 'app id',
  'title-pattern': 'title matches',
};

/**
 * The deny list, and the only place it can be edited.
 *
 * A rule whose pattern does not compile is shown with the reason rather than hidden: it matches nothing,
 * so a user who cannot see the typo believes they are protected when they are not.
 */
@Component({
  selector: 'ethlete-exclusion-rules',
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-h4">What is never collected</h3>
        <p class="text-small text-et-surface-muted">
          Rules are applied before anything is stored, so a denied window title never reaches the database.
        </p>
      </div>

      <et-choice-field>
        <et-switch [checked]="keepDefaults()" (checkedChange)="keepDefaultsChange.emit($event)" />
        <et-label>Keep the {{ DEFAULT_RULE_COUNT }} shipped rules</et-label>
        <et-hint>Password managers, private browsing and online banking.</et-hint>
      </et-choice-field>

      @for (entry of listed(); track entry.key) {
        <div class="flex flex-wrap items-center gap-3 rounded-md border border-et-surface-border p-3">
          <span class="w-24 shrink-0 text-small text-et-surface-muted">{{ entry.kind }}</span>
          <span class="grow break-all text-mono text-small">{{ entry.value }}</span>

          @if (entry.error) {
            <span class="text-small text-et-warning-ink">{{ entry.error }}</span>
          }

          <button
            [attr.aria-label]="'Remove the rule for ' + entry.value"
            (click)="remove.emit(entry.rule)"
            et-button
            variant="transparent"
            size="sm"
          >
            Remove
          </button>
        </div>
      } @empty {
        <p class="text-small text-et-surface-subtle">No rules of your own yet.</p>
      }

      <div class="flex flex-wrap items-center gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-input [(value)]="appId" aria-label="An app id to deny" placeholder="org.keepassxc.KeePassXC" />
        </et-form-field>

        <button [disabled]="!appId().trim()" (click)="addAppId()" et-button variant="outline" size="sm">
          Deny an app
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <et-form-field class="min-w-50 grow" appearance="underline" size="sm">
          <et-input [(value)]="pattern" aria-label="A window title pattern to deny" placeholder="therapy|dentist" />
        </et-form-field>

        <button [disabled]="!canAddPattern()" (click)="addPattern()" et-button variant="outline" size="sm">
          Deny a title
        </button>
      </div>

      @if (patternError(); as error) {
        <p class="text-small text-et-warning-ink">{{ error }}</p>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, CHOICE_FIELD_IMPORTS, FORM_FIELD_IMPORTS, INPUT_IMPORTS, SWITCH_IMPORTS],
})
export class ExclusionRulesComponent {
  public rules = input.required<readonly TimetrackExclusionRule[]>();
  public keepDefaults = input(true);

  public add = output<TimetrackExclusionRule>();
  public remove = output<TimetrackExclusionRule>();
  public keepDefaultsChange = output<boolean>();

  protected readonly DEFAULT_RULE_COUNT = DEFAULT_EXCLUSION_RULES.length;

  protected appId = signal('');
  protected pattern = signal('');

  protected listed = computed(() =>
    this.rules().map((rule) => ({
      rule,
      key: rule.kind === 'app-id' ? `app-id:${rule.appId}` : `title-pattern:${rule.pattern}`,
      kind: KIND_LABEL[rule.kind],
      value: rule.kind === 'app-id' ? rule.appId : rule.pattern,
      error: exclusionRuleError(rule),
    })),
  );

  protected patternError = computed(() => {
    const pattern = this.pattern().trim();

    return pattern ? exclusionRuleError({ kind: 'title-pattern', pattern }) : null;
  });

  protected canAddPattern = computed(() => !!this.pattern().trim() && !this.patternError());

  protected addAppId() {
    this.add.emit({ kind: 'app-id', appId: this.appId().trim() });
    this.appId.set('');
  }

  protected addPattern() {
    this.add.emit({ kind: 'title-pattern', pattern: this.pattern().trim() });
    this.pattern.set('');
  }
}
