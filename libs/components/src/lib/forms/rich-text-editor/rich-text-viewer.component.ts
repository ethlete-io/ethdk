import { Component, computed, effect, ElementRef, inject, input, ViewEncapsulation } from '@angular/core';
import { injectRenderer, injectStyleManager, markdownToHtml } from '@ethlete/core';
import { mountRichTextContentStyles } from './rich-text-content-styles.component';
import { RICH_TEXT_EDITOR_TOKEN_CODEC } from './rich-text-editor-token-codec.token';
import { RichTextEditorImageStylesComponent } from './tools/rich-text-editor-image-styles.component';
import { RichTextEditorTableStylesComponent } from './tools/rich-text-editor-table-styles.component';

/**
 * Renders a stored `et-rich-text-editor` value (its Markdown) read-only, styled like the editor's
 * content area, without loading the editor. Raw HTML in the value is escaped and unsafe link and
 * image URLs are dropped. Provide `provideRichTextEditorTokenRendering(triggers)` to show `{{type:id}}`
 * tokens as chips.
 *
 * ```html
 * <et-rich-text-viewer [value]="article.body" />
 * ```
 */
@Component({
  selector: 'et-rich-text-viewer',
  template: '',
  styleUrl: './rich-text-viewer.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-rich-text-viewer et-rte-content',
  },
})
export class RichTextViewerComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private renderer = injectRenderer();
  private styleManager = injectStyleManager();
  private tokenCodec = inject(RICH_TEXT_EDITOR_TOKEN_CODEC, { optional: true });

  /** The Markdown value an `et-rich-text-editor` produced. */
  public value = input<string | null | undefined>('');

  private html = computed(() => {
    const html = markdownToHtml(this.value() ?? '');

    return this.tokenCodec ? this.tokenCodec.render(html) : html;
  });

  constructor() {
    mountRichTextContentStyles();

    effect(() => {
      const html = this.html();
      const host = this.host.nativeElement;

      if (html.includes('<table')) this.styleManager.mount(RichTextEditorTableStylesComponent);
      if (html.includes('<img')) this.styleManager.mount(RichTextEditorImageStylesComponent);

      this.renderer.setProperty(host, 'innerHTML', html);
      this.tokenCodec?.hydrate(host);
    });
  }
}
