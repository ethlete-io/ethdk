import { Component, ViewEncapsulation } from '@angular/core';
import { ContentfulRichTextRendererComponent, RichTextResponse } from '@ethlete/contentful';

type Node = Record<string, unknown>;

const text = (value: string, marks: string[] = []): Node => ({
  nodeType: 'text',
  value,
  marks: marks.map((type) => ({ type })),
  data: {},
});

const block = (nodeType: string, content: Node[] = []): Node => ({ nodeType, content, data: {} });

const link = (uri: string, value: string): Node => ({ ...block('hyperlink', [text(value)]), data: { uri } });

const paragraph = (...content: Node[]) => block('paragraph', content);

const listItem = (...content: Node[]) => block('list-item', [paragraph(...content)]);

const DOCUMENT_NODES = {
  nodeType: 'document',
  data: {},
  content: [
    block('heading-2', [text('Lists and quotes')]),
    block('unordered-list', [
      listItem(text('A plain list item')),
      listItem(text('One with a '), link('https://example.com', 'link')),
      listItem(text('One with '), text('emphasis', ['italic'])),
    ]),
    block('ordered-list', [
      listItem(text('First')),
      listItem(text('Second')),
      block('list-item', [
        paragraph(text('Third, with a nested list')),
        block('unordered-list', [listItem(text('Nested one')), listItem(text('Nested two'))]),
      ]),
    ]),
    block('blockquote', [paragraph(text('A blockquote renders as its own block.'))]),
    block('hr'),
    paragraph(text('Content after the rule.')),
  ],
} as unknown as RichTextResponse;

@Component({
  selector: 'app-rich-text-lists-example',
  template: `<et-contentful-rich-text-renderer [richText]="DOCUMENT" />`,
  encapsulation: ViewEncapsulation.None,
  imports: [ContentfulRichTextRendererComponent],
})
export class RichTextListsExampleComponent {
  protected readonly DOCUMENT = DOCUMENT_NODES;
}
