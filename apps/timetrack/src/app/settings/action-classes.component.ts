import { Component, ViewEncapsulation, computed, input, output } from '@angular/core';
import { FORM_FIELD_IMPORTS, SELECT_IMPORTS } from '@ethlete/components';
import {
  ActionClasses,
  CLASSED_ACTIONS,
  ClassedAction,
  OP_CLASS_ORDER,
  OpClass,
  actionClassChoices,
  actionClassOf,
  tableClassOf,
} from '@ethlete/timetrack';

const ACTION_LABELS: Partial<Record<ClassedAction, string>> = {
  'autoMode.apply': 'Auto mode names a band or resolves a stand-in',
  'autoMode.create': 'Auto mode files a ticket it drafted',
  'jira.create': 'A CLI files a Jira issue',
  'worklog.add': 'A CLI adds a worklog row',
  'day.edits': 'A CLI edits the rows of a day',
  'standIn.rename': 'A CLI renames a stand-in',
  'standIn.split': 'A CLI splits a stand-in',
  'agentSessions.resync': 'A CLI reads the agent sessions again',
};

const AUTO_MODE_CHOICE_LABELS: Record<OpClass, string> = {
  read: 'On its own',
  local: 'On its own',
  external: 'After your approval',
  'human-only': 'Never',
};

const choiceLabelOf = (action: ClassedAction, opClass: OpClass) => {
  if (action.startsWith('autoMode.')) return AUTO_MODE_CHOICE_LABELS[opClass];

  return opClass === 'human-only' ? 'Approved one by one' : 'After your approval';
};

@Component({
  selector: 'ethlete-action-classes',
  template: `
    <div class="flex flex-col gap-2">
      @for (row of rows(); track row.action) {
        <et-form-field [attr.data-action]="row.action" class="w-96" appearance="underline" size="sm">
          <et-label>{{ row.label }}</et-label>
          <et-select [value]="row.value" (valueChange)="pick(row.action, $event)">
            @for (choice of row.choices; track choice.value) {
              <et-select-option [value]="choice.value" [label]="choice.label">{{ choice.label }}</et-select-option>
            }
          </et-select>
        </et-form-field>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, SELECT_IMPORTS],
})
export class ActionClassesComponent {
  public classes = input.required<ActionClasses>();

  public classChange = output<{ action: ClassedAction; opClass: OpClass }>();

  protected rows = computed(() =>
    CLASSED_ACTIONS.map((action) => ({
      action,
      label: ACTION_LABELS[action] ?? action,
      value: actionClassOf(action, this.classes()),
      choices: actionClassChoices(action).map((opClass) => ({
        value: opClass,
        label:
          opClass === tableClassOf(action)
            ? `${choiceLabelOf(action, opClass)} (default)`
            : choiceLabelOf(action, opClass),
      })),
    })),
  );

  protected pick(action: ClassedAction, value: unknown) {
    const opClass = OP_CLASS_ORDER.find((known) => known === value);

    if (opClass) this.classChange.emit({ action, opClass });
  }
}
