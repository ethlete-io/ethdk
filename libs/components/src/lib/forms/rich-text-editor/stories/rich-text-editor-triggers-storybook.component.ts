import { Component, linkedSignal, ViewEncapsulation } from '@angular/core';
import { form, FormField, readonly } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { delay, Observable, of, throwError } from 'rxjs';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import {
  createRichTextEditorTrigger,
  RichTextEditorTrigger,
  RichTextEditorTriggerItem,
} from '../rich-text-editor-trigger';
import { RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS } from '../rich-text-editor-token-palette.imports';
import { provideRichTextEditorTokenRendering } from '../rich-text-editor-token-providers';
import { DEFAULT_RICH_TEXT_EDITOR_TOOLS, RichTextEditorTool } from '../rich-text-editor-tools';
import { RICH_TEXT_EDITOR_TRIGGERS_IMPORTS } from '../rich-text-editor-triggers.imports';
import { RICH_TEXT_EDITOR_IMPORTS } from '../rich-text-editor.imports';
import { provideRichTextEditorAlignmentTool } from '../tools/rich-text-editor-align.provider';
import { provideRichTextEditorDefaultTools } from '../tools/rich-text-editor-default-tools.provider';
import { provideRichTextEditorTableTool } from '../tools/rich-text-editor-table.provider';

/** The default tools plus the opt-in alignment + table tools, for the triggers demo. */
const TOOLS_WITH_EXTRAS: RichTextEditorTool[] = [...DEFAULT_RICH_TEXT_EDITOR_TOOLS, 'divider', 'align', 'table'];

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

/** Simulates a search-as-you-type backend for the `@` mention trigger. */
const searchUsers = (query: string): Observable<RichTextEditorTriggerItem[]> => {
  const needle = query.toLowerCase();

  return of(USERS.filter((user) => user.label.toLowerCase().includes(needle))).pipe(delay(350));
};

export const DEMO_TRIGGERS: RichTextEditorTrigger[] = [
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
  createRichTextEditorTrigger({
    char: '$',
    type: 'link',
    // demonstrates the error state - the source always fails
    items: () => throwError(() => new Error('Could not load links')).pipe(delay(300)),
  }),
];

@Component({
  selector: 'et-sb-rich-text-editor-triggers',
  template: `
    <div
      class="flex max-w-2xl flex-col gap-4 p-8 font-sans"
      style="--et-rich-text-editor-min-height: 220px"
      etProvideColor="brand"
    >
      <et-form-field>
        <et-label>Message</et-label>
        <et-rich-text-editor
          [triggers]="TRIGGERS"
          [tools]="TOOLS"
          [formField]="demoForm.value"
          etRichTextEditorTriggers
          placeholder="Type # for a building block or @ to mention someone…"
        />
        <et-hint
          >Type <b>#</b> for merge fields, <b>@</b> to mention a teammate, <b>$</b> to see the error state.</et-hint
        >
      </et-form-field>

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{
        demoForm.value().value() || '(empty value)'
      }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...RICH_TEXT_EDITOR_IMPORTS,
    ...RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
    FormField,
    ProvideColorDirective,
  ],
  providers: [
    provideRichTextEditorTableTool(),
    provideRichTextEditorAlignmentTool(),
    provideRichTextEditorDefaultTools(),
  ],
})
export class RichTextEditorTriggersStorybookComponent {
  protected readonly TRIGGERS = DEMO_TRIGGERS;
  protected readonly TOOLS = TOOLS_WITH_EXTRAS;

  private formModel = linkedSignal(() => ({ value: '' }));

  public demoForm = form(this.formModel);
}

@Component({
  selector: 'et-sb-rich-text-editor-token-display',
  template: `
    <div
      class="flex max-w-2xl flex-col gap-4 p-8 font-sans"
      style="--et-rich-text-editor-min-height: 220px"
      etProvideColor="brand"
    >
      <et-form-field>
        <et-label>Stored message (read-only)</et-label>
        <et-rich-text-editor [formField]="demoForm.value" />
      </et-form-field>

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{ demoForm.value().value() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...RICH_TEXT_EDITOR_IMPORTS, FormField, ProvideColorDirective],
  // render stored {{type:id}} tokens as labelled chips without the interactive picker
  providers: [provideRichTextEditorDefaultTools(), provideRichTextEditorTokenRendering(DEMO_TRIGGERS)],
})
export class RichTextEditorTokenDisplayStorybookComponent {
  private formModel = linkedSignal(() => ({
    value: 'Hi {{block:firstName}}, thanks for the update - I have looped in {{mention:jane}} from Product.',
  }));

  // read-only is owned by the form field state (signal forms), not an attribute on the control
  public demoForm = form(this.formModel, (s) => {
    readonly(s.value);
  });
}

/** Merge fields for the click-to-insert palette (a fixed set - the palette is not a search). */
const PLACEHOLDERS: RichTextEditorTriggerItem[] = [
  { id: 'firstName', label: 'First name' },
  { id: 'lastName', label: 'Last name' },
  { id: 'company', label: 'Company' },
  { id: 'email', label: 'Email address' },
  { id: 'unsubscribeUrl', label: 'Unsubscribe link' },
];

const PALETTE_TRIGGERS: RichTextEditorTrigger[] = [
  createRichTextEditorTrigger({
    char: '#',
    type: 'placeholder',
    items: PLACEHOLDERS,
    resolveItem: (id) => findById(PLACEHOLDERS, id),
  }),
];

@Component({
  selector: 'et-sb-rich-text-editor-token-palette',
  template: `
    <div
      class="flex max-w-2xl flex-col gap-4 p-8 font-sans"
      style="--et-rich-text-editor-min-height: 180px"
      etProvideColor="brand"
    >
      <et-form-field>
        <et-label>Message</et-label>
        <et-rich-text-editor
          #rte="etRichTextEditor"
          [triggers]="TRIGGERS"
          [formField]="demoForm.value"
          etRichTextEditorTriggers
          placeholder="Write a message, then click a field below to insert it…"
        />
        <et-hint>Click a chip to drop a merge field at the caret - or type <b>#</b> to pick one inline.</et-hint>
      </et-form-field>

      <et-rich-text-editor-token-palette [editor]="rte" [triggers]="TRIGGERS" />

      <pre class="rounded bg-black/5 p-3 text-xs whitespace-pre-wrap">{{
        demoForm.value().value() || '(empty value)'
      }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    ...FORM_FIELD_IMPORTS,
    ...RICH_TEXT_EDITOR_IMPORTS,
    ...RICH_TEXT_EDITOR_TRIGGERS_IMPORTS,
    ...RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS,
    FormField,
    ProvideColorDirective,
  ],
})
export class RichTextEditorTokenPaletteStorybookComponent {
  protected readonly TRIGGERS = PALETTE_TRIGGERS;

  private formModel = linkedSignal(() => ({ value: '' }));

  public demoForm = form(this.formModel);
}
