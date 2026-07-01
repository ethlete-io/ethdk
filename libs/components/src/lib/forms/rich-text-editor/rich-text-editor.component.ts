import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ColorInteractiveContainerDirective, markdownToHtml } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { IconButtonComponent } from '../../button/icon-button.component';
import {
  BOLD_ICON,
  IconDirective,
  ITALIC_ICON,
  LINK_ICON,
  LIST_BULLETED_ICON,
  LIST_NUMBERED_ICON,
  provideIcons,
  STRIKETHROUGH_ICON,
} from '../../icon';
import { RichTextEditorDirective } from './headless';

@Component({
  selector: 'et-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, IconDirective],
  providers: [
    provideIcons(BOLD_ICON, ITALIC_ICON, STRIKETHROUGH_ICON, LIST_BULLETED_ICON, LIST_NUMBERED_ICON, LINK_ICON),
  ],
  hostDirectives: [
    {
      directive: RichTextEditorDirective,
      inputs: ['value', 'disabled', 'readonly', 'hidden', 'invalid', 'errors', 'required', 'name', 'placeholder'],
      outputs: ['valueChange', 'touchedChange'],
    },
    ColorInteractiveContainerDirective,
  ],
  host: {
    class: 'et-rich-text-editor',
    '(click)': 'dir.activate()',
  },
})
export class RichTextEditorComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  private editable = viewChild.required<ElementRef<HTMLElement>>('editable');

  constructor() {
    afterNextRender(() => {
      this.dir.editorDom.root.set(this.editable().nativeElement ?? null);
      this.renderExternalValue();
    });

    // Keep the toolbar's active-mark highlighting in sync with caret movement. The directive
    // ignores selection changes that land outside its editable root.
    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => this.dir.refreshActiveMarks()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // Render programmatic (external) value changes into the DOM. Skip the user's own edits -
    // those already match `lastEmittedMarkdown`, so re-rendering would reset the caret.
    effect(() => {
      const markdown = this.dir.value();

      if (markdown === this.dir.lastEmittedMarkdown) return;

      this.renderExternalValue(markdown);
    });
  }

  protected onInput() {
    this.dir.syncFromDom();
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Backspace') return;

    if (this.dir.handleBackspace()) {
      event.preventDefault();
    }
  }

  protected onBeforeInput(event: InputEvent) {
    // Keep keyboard shortcuts (Ctrl/Cmd+B, …) running through our Selection/Range commands
    // instead of the browser's deprecated execCommand-backed formatting.
    switch (event.inputType) {
      case 'formatBold':
        event.preventDefault();
        this.dir.toggleBold();
        break;
      case 'formatItalic':
        event.preventDefault();
        this.dir.toggleItalic();
        break;
      case 'formatStrikeThrough':
        event.preventDefault();
        this.dir.toggleStrikethrough();
        break;
    }
  }

  protected promptForLink() {
    // Mirror the other toolbar buttons' toggle behavior: with the caret already inside a link,
    // clicking again removes it instead of re-prompting for a URL to edit it.
    if (this.dir.linkActive()) {
      this.dir.setLink('');

      return;
    }

    const url = this.document.defaultView?.prompt('Link URL');

    if (url === null || url === undefined) return;

    this.dir.setLink(url);
  }

  private renderExternalValue(markdown = this.dir.value()) {
    const el = this.editable()?.nativeElement;

    if (!el) return;

    el.innerHTML = markdownToHtml(markdown);
    this.dir.lastEmittedMarkdown = markdown;
  }
}
