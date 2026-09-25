import { Component, ViewEncapsulation } from '@angular/core';
import { RichTextViewerComponent } from '@ethlete/components';

const MARKDOWN = `# Aligned table

| Left | Center | Right |
| :--- | :----: | ----: |
| a    | b      | c     |
`;

@Component({
  selector: 'app-markdown',
  template: '<et-rich-text-viewer data-testid="markdown" [value]="MARKDOWN" />',
  encapsulation: ViewEncapsulation.None,
  imports: [RichTextViewerComponent],
})
export class MarkdownRouteComponent {
  protected readonly MARKDOWN = MARKDOWN;
}
