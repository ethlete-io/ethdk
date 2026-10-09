import { Component, ViewEncapsulation, computed } from '@angular/core';
import { FORM_FIELD_IMPORTS, INPUT_IMPORTS, SELECT_IMPORTS, SWITCH_IMPORTS } from '@ethlete/components';
import { REASONING_LANGUAGES, withStoredOption } from './select-options';
import { ActionClassesComponent } from './action-classes.component';
import { ExplainComponent } from './explain.component';
import { MaskedNamesComponent } from './masked-names.component';
import { injectTimetrackSettings } from './settings';

const SUGGESTIONS_WHY = `For work no branch name, rule or merge request could name an issue for, the review
can ask the agent CLI you already have signed in.

It runs with every tool disabled and sees only what the review shows you before you ask: repository and
branch names, durations, commit subjects, and the issues the rest of the day already reached. Never a
window title, never a file path. A suggestion never syncs on its own.`;

const AUTO_MODE_WHY = `With auto mode on, the agent CLI runs without a press on each new unnamed band and each open
stand-in of today, never on a past day. It sends the same masked payload the Ask AI press shows, and
keeps it with the answer.

An existing issue it finds names the band as auto, and resetting the row takes it back. A new ticket it
drafts waits in the approval queue. It never overwrites a field you set, never remembers a meeting or a
call name, and never writes to Tempo.`;

const ACTION_CLASSES_WHY = `Each pick can only make an action stricter than it starts. Auto mode can be made
to ask before it names a band or files a ticket, or to never do it. A write a CLI asks for always
waits for your approval; set it to one by one and "Approve all" leaves it out.`;

@Component({
  selector: 'ethlete-settings-suggestions-view',
  template: `
    <div class="flex max-w-3xl flex-col gap-3 py-6">
      <div class="flex items-center gap-2">
        <h3 class="text-h4">Suggestions</h3>
        <et-switch [checked]="store.settings().reasoning.enabled" (checkedChange)="setReasoningEnabled($event)" />
        <ethlete-explain [text]="SUGGESTIONS_WHY" label="suggestions" />
      </div>

      <div class="flex items-center gap-2">
        <span>Auto mode</span>
        <et-switch
          [checked]="store.settings().reasoning.autoMode"
          [disabled]="!store.settings().reasoning.enabled"
          (checkedChange)="setReasoningAutoMode($event)"
          aria-label="Auto mode"
        />
        <ethlete-explain [text]="AUTO_MODE_WHY" label="auto mode" />
      </div>

      <div class="flex items-center gap-2">
        <h4 class="text-base">What waits for you</h4>
        <ethlete-explain [text]="ACTION_CLASSES_WHY" label="what waits for you" />
      </div>

      <ethlete-action-classes [classes]="store.settings().actionClasses" (classChange)="store.setActionClass($event)" />

      <div class="flex flex-wrap items-start gap-3">
        <et-form-field class="w-40" appearance="underline" size="sm">
          <et-label>Model</et-label>
          <et-input
            [value]="store.settings().reasoning.model"
            (valueChange)="setReasoningModel($event)"
            placeholder="the CLI decides"
          />
        </et-form-field>

        <et-form-field class="w-40" appearance="underline" size="sm">
          <et-label>Language</et-label>
          <et-select
            [value]="store.settings().reasoning.language"
            (valueChange)="setReasoningLanguage($event)"
            placeholder="the evidence decides"
            data-reasoning-language
          >
            @for (option of reasoningLanguages(); track option.value) {
              <et-select-option [value]="option.value" [label]="option.label" />
            }
          </et-select>
        </et-form-field>
      </div>

      <span class="text-small text-et-surface-muted">
        Every ticket, every parent and every suggestion is written in this language. Leave it empty and each answer
        follows the language of the work it was given.
      </span>

      <ethlete-masked-names
        [names]="store.settings().reasoning.maskedNames"
        [projects]="store.settings().favoriteProjects"
        (add)="store.addMaskedName($event)"
        (remove)="store.removeMaskedName($event)"
      />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ActionClassesComponent,
    ExplainComponent,
    FORM_FIELD_IMPORTS,
    INPUT_IMPORTS,
    MaskedNamesComponent,
    SELECT_IMPORTS,
    SWITCH_IMPORTS,
  ],
})
export class SettingsSuggestionsViewComponent {
  protected store = injectTimetrackSettings();

  protected readonly SUGGESTIONS_WHY = SUGGESTIONS_WHY;
  protected readonly AUTO_MODE_WHY = AUTO_MODE_WHY;
  protected readonly ACTION_CLASSES_WHY = ACTION_CLASSES_WHY;

  protected reasoningLanguages = computed(() =>
    withStoredOption(REASONING_LANGUAGES, this.store.settings().reasoning.language),
  );

  protected setReasoningEnabled(enabled: boolean) {
    this.store.setReasoning({ ...this.store.settings().reasoning, enabled });
  }

  protected setReasoningAutoMode(autoMode: boolean) {
    this.store.setReasoning({ ...this.store.settings().reasoning, autoMode });
  }

  protected setReasoningModel(model: string) {
    this.store.setReasoning({ ...this.store.settings().reasoning, model: model.trim() });
  }

  protected setReasoningLanguage(language: unknown) {
    if (typeof language !== 'string') return;

    this.store.setReasoning({ ...this.store.settings().reasoning, language });
  }
}
