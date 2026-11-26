import { Component, signal, ViewEncapsulation } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import {
  FORM_FIELD_IMPORTS,
  RICH_TEXT_EDITOR_IMPORTS,
  RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
  RichTextEditorTrigger,
  RichTextEditorTriggerItem,
  createRichTextEditorTrigger,
  provideRichTextEditorDefaultTools,
} from '@ethlete/components';
import { Observable, delay, of } from 'rxjs';

const MERGE_FIELDS: RichTextEditorTriggerItem[] = [
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'company', label: 'Company' },
  { id: 'email', label: 'Email address' },
];

const USERS: RichTextEditorTriggerItem[] = [
  { id: 'jane', label: 'Jane Doe', description: 'Product' },
  { id: 'john', label: 'John Smith', description: 'Engineering' },
  { id: 'amir', label: 'Amir Khan', description: 'Design' },
  { id: 'lena', label: 'Lena Roth', description: 'Support' },
];

const findById = (items: RichTextEditorTriggerItem[], id: string) => items.find((item) => item.id === id) ?? null;

const searchUsers = (query: string): Observable<RichTextEditorTriggerItem[]> => {
  const needle = query.toLowerCase();

  return of(USERS.filter((user) => user.label.toLowerCase().includes(needle))).pipe(delay(350));
};

@Component({
  selector: 'app-rich-text-editor-triggers-example',
  template: `
    <et-form-field>
      <et-label>Message</et-label>
      <et-rich-text-editor
        [triggers]="TRIGGERS"
        [formField]="messageForm.message"
        etRichTextEditorTriggers
        placeholder="Type # for a building block or @ to mention someone…"
      />
      <et-hint>Type <b>#</b> for merge fields, <b>@</b> to mention a teammate.</et-hint>
    </et-form-field>

    <pre>{{ messageForm.message().value() || '(empty value)' }}</pre>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RICH_TEXT_EDITOR_IMPORTS, RICH_TEXT_EDITOR_TRIGGERS_IMPORTS, FormField],
  providers: [provideRichTextEditorDefaultTools()],
})
export class RichTextEditorTriggersExampleComponent {
  protected readonly TRIGGERS: RichTextEditorTrigger[] = [
    createRichTextEditorTrigger({
      char: '#',
      type: 'block',
      items: MERGE_FIELDS,
      resolveItem: (id) => findById(MERGE_FIELDS, id),
    }),
    createRichTextEditorTrigger({
      char: '@',
      type: 'mention',
      items: searchUsers,
      resolveItem: (id) => findById(USERS, id),
      debounceTime: 200,
    }),
  ];

  private model = signal({ message: '' });

  protected messageForm = form(this.model);
}
