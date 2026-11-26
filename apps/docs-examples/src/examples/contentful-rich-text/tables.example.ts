import { Component, ViewEncapsulation } from '@angular/core';
import { ContentfulRichTextRendererComponent, RichTextResponse } from '@ethlete/contentful';

type Node = Record<string, unknown>;

const text = (value: string): Node => ({ nodeType: 'text', value, marks: [], data: {} });

const block = (nodeType: string, content: Node[] = []): Node => ({ nodeType, content, data: {} });

const paragraph = (...content: Node[]) => block('paragraph', content);

const cell = (header: boolean, value: string) =>
  block(header ? 'table-header-cell' : 'table-cell', [paragraph(text(value))]);

const DOCUMENT_NODES = {
  nodeType: 'document',
  data: {},
  content: [
    block('heading-2', [text('Tables')]),
    block('table', [
      block('table-row', [cell(true, 'Plan'), cell(true, 'Seats'), cell(true, 'Price')]),
      block('table-row', [cell(false, 'Starter'), cell(false, '3'), cell(false, '$0')]),
      block('table-row', [cell(false, 'Team'), cell(false, '25'), cell(false, '$49')]),
      block('table-row', [cell(false, 'Enterprise'), cell(false, 'Unlimited'), cell(false, 'Custom')]),
    ]),
    paragraph(text('Cells hold full rich text, so each one is a paragraph node.')),
  ],
} as unknown as RichTextResponse;

@Component({
  selector: 'app-rich-text-tables-example',
  template: `<et-contentful-rich-text-renderer [richText]="DOCUMENT" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
})
export class RichTextTablesExampleComponent {
  protected readonly DOCUMENT = DOCUMENT_NODES;
}
